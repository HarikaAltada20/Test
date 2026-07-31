/**
 * Process YouTube metrics refresh queue (Redis + batch worker).
 */

import { NextResponse } from "next/server";
import {
  createClient as createAdminSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  popYouTubeMetricsJob,
  enqueueYouTubeMetricsJob,
  removeFromProcessingYouTube,
  retryOrDeadLetterFromProcessingYouTube,
  isYouTubeMetricsQueueEnabled,
  type YouTubeMetricsJob,
  type YouTubeRefreshScope,
  recoverProcessingJobsToQueueYouTube,
} from "@/lib/queue/youtube-metrics-queue";
import { updateYouTubeCpmContestBudgets } from "@/lib/youtube-cpm-contest-budgets";
import { refreshContestStats } from "@/lib/contest-stats";
import { revalidateLeaderboardCache } from "@/lib/leaderboard-cache";
import { persistContestBudgetSpent } from "@/lib/persist-contest-budget-spent";
import { isYouTubeAllLikeScope, mergePostCampaignYouTubeTimestamps } from "@/lib/youtube-submission-refresh-by-scope";
import {
  authorizeProcessYouTubeMetricsQueue,
  isQStashEnabled,
  triggerProcessYouTubeMetricsQueue,
} from "@/lib/qstash";
function getBaseUrlFromRequest(request: Request): string {
  try {
    const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (xfHost && xfProto) return `${xfProto}://${xfHost}`;

    const u = new URL(request.url);
    return u.origin;
  } catch {
    const url = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
    return url.replace(/\/$/, "");
  }
}

async function finalizePostCampaignYoutubeRun(
  supabaseAdmin: SupabaseClient,
  contestId: string,
  scope: YouTubeRefreshScope,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: contestRow } = await supabaseAdmin
    .from("contests")
    .select("contest_based_details")
    .eq("id", contestId)
    .maybeSingle();

  const patch = mergePostCampaignYouTubeTimestamps(
    (contestRow?.contest_based_details as Record<string, unknown>) || {},
    scope,
    now,
  );

  await supabaseAdmin.from("contests").update(patch).eq("id", contestId);
  // Overlay-only: do not recalculate live contest budgets / leaderboard.
}

async function finalizeContestAfterYoutubeRun(
  supabaseAdmin: SupabaseClient,
  contestId: string,
  scope: YouTubeRefreshScope
): Promise<void> {
  const now = new Date().toISOString();
  await supabaseAdmin.from("contests").update({ last_metrics_updated: now }).eq("id", contestId);
  await refreshContestStats(contestId);

  if (scope !== "basic") {
    const { data: contestRow } = await supabaseAdmin
      .from("contests")
      .select("contest_based_details")
      .eq("id", contestId)
      .maybeSingle();

    const existing = (contestRow?.contest_based_details as Record<string, unknown>) || {};
    const existingYt =
      (existing.youtube_metrics_last_updated as Record<string, string>) || {};
    const nextYt = { ...existingYt };
    if (scope === "core" || isYouTubeAllLikeScope(scope)) nextYt.core = now;
    if (scope === "traffic" || isYouTubeAllLikeScope(scope))
      nextYt.traffic = now;
    if (scope === "demographics" || isYouTubeAllLikeScope(scope))
      nextYt.demographics = now;

    await supabaseAdmin
      .from("contests")
      .update({
        contest_based_details: { ...existing, youtube_metrics_last_updated: nextYt },
      })
      .eq("id", contestId);
  }

  if (scope === "basic" || isYouTubeAllLikeScope(scope)) {
    await updateYouTubeCpmContestBudgets(supabaseAdmin, contestId);
  }

  // Milestone/leaderboard/dual list trackers read persisted budget_spent;
  // CPM-only rollup above does not cover those contest types.
  await persistContestBudgetSpent(contestId, supabaseAdmin);
}

export async function GET(request: Request) {
  const rawBody = "";
  const authorized = await authorizeProcessYouTubeMetricsQueue(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRequest(getBaseUrlFromRequest(request));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorized = await authorizeProcessYouTubeMetricsQueue(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viaQStash = !!request.headers.get("Upstash-Signature");
  console.log(`[process-youtube-metrics-queue] Invoked by ${viaQStash ? "QStash" : "CRON/direct"}`);
  return handleRequest(getBaseUrlFromRequest(request));
}

async function handleRequest(baseUrl: string): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;

  if (!isYouTubeMetricsQueueEnabled()) {
    return NextResponse.json(
      { processed: 0, message: "YouTube metrics queue not configured" },
      { status: 200 }
    );
  }

  let popped = await popYouTubeMetricsJob();
  if (!popped) {
    const recovered = await recoverProcessingJobsToQueueYouTube({ maxToMove: 25 });
    if (recovered.moved > 0) {
      popped = await popYouTubeMetricsJob();
    }
  }
  if (!popped) {
    return NextResponse.json({ processed: 0, message: "Queue empty" });
  }
  const { job, raw: rawJobString } = popped;

  const batchUrl = `${baseUrl}/api/contests/${job.contestId}/youtube-metrics-refresh/batch`;

  let batchRes: Response;
  try {
    batchRes = await fetch(batchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-From-Queue": "1",
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
      body: JSON.stringify({
        runId: job.runId,
        batchIndex: job.batchIndex,
        batchSize: job.batchSize,
        totalBatches: job.totalBatches,
        cursor: job.cursor,
        metricsTarget: job.metricsTarget ?? "submissions",
      }),
    });
  } catch (err) {
    console.error("[process-youtube-metrics-queue] Batch fetch error:", err);
    const retryResult = await retryOrDeadLetterFromProcessingYouTube({
      rawJobString,
      reason: `batch fetch failed: ${err instanceof Error ? err.message : "unknown error"}`,
    });
    if (retryResult.deadLettered) {
      const supabaseAdmin = createAdminSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("youtube_metrics_refresh_runs")
        .update({
          status: "failed",
          error_message: "Job dead-lettered after repeated batch fetch failures",
          finished_at: now,
          updated_at: now,
        })
        .eq("id", job.runId)
        .eq("status", "running");
    }
    return NextResponse.json(
      {
        processed: 1,
        error: err instanceof Error ? err.message : "Batch request failed",
        retry: retryResult,
      },
      { status: 500 }
    );
  }

  const batchData = await batchRes.json().catch(() => ({}));

  if (!batchRes.ok) {
    console.error("[process-youtube-metrics-queue] Batch failed:", batchRes.status, batchData);
    const retryResult = await retryOrDeadLetterFromProcessingYouTube({
      rawJobString,
      reason: `batch status ${batchRes.status}`,
    });
    if (retryResult.deadLettered) {
      const supabaseAdmin = createAdminSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("youtube_metrics_refresh_runs")
        .update({
          status: "failed",
          error_message: `Job dead-lettered after repeated batch failures (status ${batchRes.status})`,
          finished_at: now,
          updated_at: now,
        })
        .eq("id", job.runId)
        .eq("status", "running");
    }
    return NextResponse.json(
      { processed: 1, error: "Batch failed", details: batchData, retry: retryResult },
      { status: 500 }
    );
  }

  const runStatus = typeof batchData.runStatus === "string" ? batchData.runStatus : undefined;
  const hasMore = batchData.hasMore === true && !batchData.cancelled;
  if (batchData.cancelled) {
    await removeFromProcessingYouTube(rawJobString);
    return NextResponse.json({
      processed: 1,
      contestId: job.contestId,
      runId: job.runId,
      cancelled: true,
    });
  }
  if (runStatus && runStatus !== "running") {
    await removeFromProcessingYouTube(rawJobString);
    return NextResponse.json({
      processed: 1,
      contestId: job.contestId,
      runId: job.runId,
      hasMore: false,
      runStatus,
    });
  }

  if (hasMore && batchData.nextCursor != null) {
    const nextJob: YouTubeMetricsJob = {
      contestId: job.contestId,
      runId: job.runId,
      scope: job.scope,
      batchIndex: job.batchIndex + 1,
      batchSize: job.batchSize,
      totalBatches: job.totalBatches,
      cursor: batchData.nextCursor,
      metricsTarget: job.metricsTarget ?? "submissions",
    };
    const enqueueNext = await enqueueYouTubeMetricsJob(nextJob);
    if (enqueueNext.error) {
      console.error(
        "[process-youtube-metrics-queue] Failed to enqueue next batch",
        {
          contestId: job.contestId,
          runId: job.runId,
          batchIndex: job.batchIndex,
          metricsTarget: job.metricsTarget ?? "submissions",
          error: enqueueNext.error,
        },
      );
      const supabaseAdmin = createAdminSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("youtube_metrics_refresh_runs")
        .update({
          status: "failed",
          error_message: `Failed to enqueue next batch: ${enqueueNext.error}`,
          finished_at: now,
          updated_at: now,
        })
        .eq("id", job.runId);
      return NextResponse.json(
        {
          processed: 1,
          contestId: job.contestId,
          runId: job.runId,
          error: "Failed to enqueue next batch",
          details: enqueueNext.error,
        },
        { status: 500 }
      );
    }
    console.info("[process-youtube-metrics-queue] Enqueued next batch", {
      contestId: job.contestId,
      runId: job.runId,
      batchIndex: job.batchIndex,
      nextBatchIndex: job.batchIndex + 1,
      metricsTarget: job.metricsTarget ?? "submissions",
    });
    // Remove only after the continuation job is safely queued to avoid gaps.
    await removeFromProcessingYouTube(rawJobString);
    const doFetch = () =>
      fetch(`${baseUrl}/api/cron/process-youtube-metrics-queue`, {
        method: "POST",
        headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      }).catch((e) => console.warn("[process-youtube-metrics-queue] Trigger next failed:", e));
    if (isQStashEnabled()) {
      triggerProcessYouTubeMetricsQueue(baseUrl)
        .then((res) => {
          if (res?.error) doFetch();
        })
        .catch(() => doFetch());
    } else {
      doFetch();
    }
    return NextResponse.json({
      processed: 1,
      contestId: job.contestId,
      runId: job.runId,
      batchIndex: job.batchIndex,
      hasMore: true,
    });
  }

  if (hasMore && batchData.nextCursor == null) {
    console.error(
      "[process-youtube-metrics-queue] Queue stall: hasMore without nextCursor",
      {
        contestId: job.contestId,
        runId: job.runId,
        batchIndex: job.batchIndex,
        metricsTarget: job.metricsTarget ?? "submissions",
      },
    );
    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("youtube_metrics_refresh_runs")
      .update({
        status: "failed",
        error_message: "Queue stall: hasMore without nextCursor",
        finished_at: now,
        updated_at: now,
      })
      .eq("id", job.runId)
      .eq("status", "running");
    await removeFromProcessingYouTube(rawJobString);
    return NextResponse.json(
      {
        processed: 1,
        contestId: job.contestId,
        runId: job.runId,
        error: "Queue stall: hasMore without nextCursor",
      },
      { status: 500 },
    );
  }

  if (!hasMore) {
    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const now = new Date().toISOString();
    const { data: completedRun } = await supabaseAdmin
      .from("youtube_metrics_refresh_runs")
      .update({ status: "completed", finished_at: now, updated_at: now })
      .eq("id", job.runId)
      .eq("status", "running")
      .select("id")
      .maybeSingle();
    if (completedRun) {
      const isPostCampaignTarget = job.metricsTarget === "post_campaign";
      if (isPostCampaignTarget) {
        await finalizePostCampaignYoutubeRun(
          supabaseAdmin,
          job.contestId,
          job.scope,
        );
      } else {
        await finalizeContestAfterYoutubeRun(supabaseAdmin, job.contestId, job.scope);
        revalidateLeaderboardCache(job.contestId);
      }
    }
  }
  await removeFromProcessingYouTube(rawJobString);

  return NextResponse.json({
    processed: 1,
    contestId: job.contestId,
    runId: job.runId,
    batchIndex: job.batchIndex,
    hasMore: false,
  });
}
