/**
 * Process Instagram insights refresh queue: pop one job (LMOVE to processing),
 * call batch worker, on success LREM from processing; if hasMore enqueue next + trigger self;
 * if !hasMore set run.status = 'completed'. Triggered by QStash or CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import {
  popInstagramInsightsJob,
  enqueueInstagramInsightsJob,
  removeFromProcessing,
  isInstagramInsightsQueueEnabled,
  type InstagramInsightsJob,
  recoverProcessingJobsToQueue,
} from "@/lib/queue/instagram-insights-queue";
import { updateCpmContestBudgets } from "@/lib/instagram-insights";
import { revalidateLeaderboardCache } from "@/lib/leaderboard-cache";
import { refreshContestStats } from "@/lib/contest-stats";
import {
  authorizeProcessInstagramInsightsQueue,
  isQStashEnabled,
  triggerProcessInstagramInsightsQueue,
} from "@/lib/qstash";

function getBaseUrlFromRequest(request: Request): string {
  try {
    // Prefer forwarded public origin (e.g. Cloudflare Tunnel) but only when forwarded host is provided.
    // If we combine x-forwarded-proto=https with host=localhost:3000, we'd incorrectly call https://localhost:3000
    // and hit ERR_SSL_PACKET_LENGTH_TOO_LONG.
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

export async function GET(request: Request) {
  const rawBody = "";
  const authorized = await authorizeProcessInstagramInsightsQueue(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRequest(getBaseUrlFromRequest(request));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorized = await authorizeProcessInstagramInsightsQueue(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viaQStash = !!request.headers.get("Upstash-Signature");
  console.log(
    `[process-instagram-insights-queue] Invoked by ${viaQStash ? "QStash" : "CRON/direct"}`
  );
  return handleRequest(getBaseUrlFromRequest(request));
}

async function handleRequest(baseUrl: string): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;

  if (!isInstagramInsightsQueueEnabled()) {
    return NextResponse.json(
      { processed: 0, message: "Instagram insights queue not configured" },
      { status: 200 }
    );
  }

  // Pop one job. If the queue looks empty, attempt recovery from the processing list
  // (processor crash after LMOVE can strand jobs there) and pop again.
  let popped = await popInstagramInsightsJob();
  if (!popped) {
    const recovered = await recoverProcessingJobsToQueue({ maxToMove: 25 });
    if (recovered.moved > 0) {
      popped = await popInstagramInsightsJob();
    }
  }
  if (!popped) {
    return NextResponse.json({ processed: 0, message: "Queue empty" });
  }
  const { job, raw: rawJobString } = popped;

  const batchUrl = `${baseUrl}/api/contests/${job.contestId}/instagram-insights-refresh/batch`;

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
    console.error("[process-instagram-insights-queue] Batch fetch error:", err);
    return NextResponse.json(
      { processed: 1, error: err instanceof Error ? err.message : "Batch request failed" },
      { status: 500 }
    );
  }

  const batchData = await batchRes.json().catch(() => ({}));

  if (!batchRes.ok) {
    console.error("[process-instagram-insights-queue] Batch failed:", batchRes.status, batchData);
    return NextResponse.json(
      { processed: 1, error: "Batch failed", details: batchData },
      { status: 500 }
    );
  }

  await removeFromProcessing(rawJobString);

  const hasMore = batchData.hasMore === true && !batchData.cancelled;
  if (batchData.cancelled) {
    return NextResponse.json({
      processed: 1,
      contestId: job.contestId,
      runId: job.runId,
      cancelled: true,
    });
  }

  if (hasMore && batchData.nextCursor != null) {
    const nextJob: InstagramInsightsJob = {
      contestId: job.contestId,
      runId: job.runId,
      batchIndex: job.batchIndex + 1,
      batchSize: job.batchSize,
      totalBatches: job.totalBatches,
      cursor: batchData.nextCursor,
      metricsTarget: job.metricsTarget ?? "submissions",
    };
    const enqueueNext = await enqueueInstagramInsightsJob(nextJob);
    if (enqueueNext?.error) {
      console.error(
        "[process-instagram-insights-queue] Failed to enqueue next batch",
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
        .from("instagram_insights_refresh_runs")
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
        { status: 500 },
      );
    }
    console.info("[process-instagram-insights-queue] Enqueued next batch", {
      contestId: job.contestId,
      runId: job.runId,
      batchIndex: job.batchIndex,
      nextBatchIndex: job.batchIndex + 1,
      metricsTarget: job.metricsTarget ?? "submissions",
    });
    const doFetch = () =>
      fetch(`${baseUrl}/api/cron/process-instagram-insights-queue`, {
        method: "POST",
        headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      }).catch((e) =>
        console.warn("[process-instagram-insights-queue] Trigger next failed:", e)
      );
    if (isQStashEnabled()) {
      triggerProcessInstagramInsightsQueue(baseUrl).then((res) => {
        if (res?.error) doFetch();
      }).catch(() => doFetch());
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
      "[process-instagram-insights-queue] Queue stall: hasMore without nextCursor",
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
      .from("instagram_insights_refresh_runs")
      .update({
        status: "failed",
        error_message: "Queue stall: hasMore without nextCursor",
        finished_at: now,
        updated_at: now,
      })
      .eq("id", job.runId)
      .eq("status", "running");
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
    await supabaseAdmin
      .from("instagram_insights_refresh_runs")
      .update({ status: "completed", finished_at: now, updated_at: now })
      .eq("id", job.runId);

    // Bump the correct cooldown timestamp for the metrics target.
    const isPostCampaignTarget = job.metricsTarget === "post_campaign";
    await supabaseAdmin
      .from("contests")
      .update(
        isPostCampaignTarget
          ? { post_campaign_last_metrics_updated: now }
          : { last_metrics_updated: now },
      )
      .eq("id", job.contestId);

    // Overlay refresh must not recalculate live contest budgets / leaderboard.
    if (!isPostCampaignTarget) {
      await refreshContestStats(job.contestId);
      await updateCpmContestBudgets(supabaseAdmin, job.contestId);
      revalidateLeaderboardCache(job.contestId);
    } else {
      console.info(
        "[process-instagram-insights-queue] post_campaign run completed",
        { contestId: job.contestId, runId: job.runId },
      );
    }
  }

  return NextResponse.json({
    processed: 1,
    contestId: job.contestId,
    runId: job.runId,
    batchIndex: job.batchIndex,
    hasMore: false,
  });
}
