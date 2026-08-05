/**
 * Process TikTok metrics refresh queue: pop one job (LMOVE to processing),
 * call batch worker, on success LREM from processing; if hasMore enqueue next + trigger self;
 * if !hasMore set run.status = 'completed'. Triggered by QStash or CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import {
  popTikTokMetricsJob,
  enqueueTikTokMetricsJob,
  removeFromProcessing,
  isTikTokMetricsQueueEnabled,
  type TikTokMetricsJob,
  recoverProcessingJobsToQueue,
} from "@/lib/queue/tiktok-metrics-queue";
import {
  authorizeProcessTikTokMetricsQueue,
  isQStashEnabled,
  triggerProcessTikTokMetricsQueue,
} from "@/lib/qstash";
import { refreshContestStats } from "@/lib/contest-stats";
import { persistContestBudgetSpent } from "@/lib/persist-contest-budget-spent";

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

export async function GET(request: Request) {
  const rawBody = "";
  const authorized = await authorizeProcessTikTokMetricsQueue(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleRequest(getBaseUrlFromRequest(request));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const authorized = await authorizeProcessTikTokMetricsQueue(request, rawBody);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viaQStash = !!request.headers.get("Upstash-Signature");
  console.log(
    `[process-tiktok-metrics-queue] Invoked by ${viaQStash ? "QStash" : "CRON/direct"}`
  );
  return handleRequest(getBaseUrlFromRequest(request));
}

async function handleRequest(baseUrl: string): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const supabaseAdmin = createAdminSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  if (!isTikTokMetricsQueueEnabled()) {
    return NextResponse.json(
      { processed: 0, message: "TikTok metrics queue not configured" },
      { status: 200 }
    );
  }

  let popped = await popTikTokMetricsJob();
  if (!popped) {
    const recovered = await recoverProcessingJobsToQueue({ maxToMove: 25 });
    if (recovered.moved > 0) {
      popped = await popTikTokMetricsJob();
    }
  }
  if (!popped) {
    return NextResponse.json({ processed: 0, message: "Queue empty" });
  }
  const { job, raw: rawJobString } = popped;
  const failRunAndClearProcessing = async (reason: string) => {
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("tiktok_metrics_refresh_runs")
      .update({
        status: "failed",
        finished_at: now,
        updated_at: now,
        error_message: reason.slice(0, 2000),
      })
      .eq("id", job.runId);
    await removeFromProcessing(rawJobString);
  };

  const batchUrl = `${baseUrl}/api/contests/${job.contestId}/tiktok-metrics-refresh/batch`;

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
    console.error("[process-tiktok-metrics-queue] Batch fetch error:", err);
    const message =
      err instanceof Error ? err.message : "Batch request failed";
    await failRunAndClearProcessing(`Batch fetch error: ${message}`);
    return NextResponse.json(
      { processed: 1, error: message },
      { status: 500 }
    );
  }

  const batchData = await batchRes.json().catch(() => ({}));

  if (!batchRes.ok) {
    console.error("[process-tiktok-metrics-queue] Batch failed:", batchRes.status, batchData);
    await failRunAndClearProcessing(
      `Batch worker failed with status ${batchRes.status}`,
    );
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
    const nextJob: TikTokMetricsJob = {
      contestId: job.contestId,
      runId: job.runId,
      batchIndex: job.batchIndex + 1,
      batchSize: job.batchSize,
      totalBatches: job.totalBatches,
      cursor: batchData.nextCursor,
      metricsTarget: job.metricsTarget ?? "submissions",
    };
    const enqueueResult = await enqueueTikTokMetricsJob(nextJob);
    if (enqueueResult.error) {
      console.error(
        "[process-tiktok-metrics-queue] Failed to enqueue next batch",
        {
          contestId: job.contestId,
          runId: job.runId,
          batchIndex: job.batchIndex,
          metricsTarget: job.metricsTarget ?? "submissions",
          error: enqueueResult.error,
        },
      );
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("tiktok_metrics_refresh_runs")
        .update({
          status: "failed",
          finished_at: now,
          updated_at: now,
          error_message: `Failed to enqueue next batch: ${enqueueResult.error}`,
        })
        .eq("id", job.runId);
      return NextResponse.json(
        {
          processed: 1,
          contestId: job.contestId,
          runId: job.runId,
          error: "Failed to enqueue next TikTok metrics batch",
          details: enqueueResult.error,
        },
        { status: 500 },
      );
    }
    console.info("[process-tiktok-metrics-queue] Enqueued next batch", {
      contestId: job.contestId,
      runId: job.runId,
      batchIndex: job.batchIndex,
      nextBatchIndex: job.batchIndex + 1,
      metricsTarget: job.metricsTarget ?? "submissions",
    });
    
    const doFetch = () =>
      fetch(`${baseUrl}/api/cron/process-tiktok-metrics-queue`, {
        method: "POST",
        headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      }).catch((e) =>
        console.warn("[process-tiktok-metrics-queue] Trigger next failed:", e)
      );
      
    if (isQStashEnabled()) {
      triggerProcessTikTokMetricsQueue(baseUrl).then((res) => {
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
      "[process-tiktok-metrics-queue] Queue stall: hasMore without nextCursor",
      {
        contestId: job.contestId,
        runId: job.runId,
        batchIndex: job.batchIndex,
        metricsTarget: job.metricsTarget ?? "submissions",
      },
    );
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("tiktok_metrics_refresh_runs")
      .update({
        status: "failed",
        finished_at: now,
        updated_at: now,
        error_message: "Queue stall: hasMore without nextCursor",
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
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("tiktok_metrics_refresh_runs")
      .update({ status: "completed", finished_at: now, updated_at: now })
      .eq("id", job.runId);

    const isPostCampaignTarget = job.metricsTarget === "post_campaign";
    await supabaseAdmin
      .from("contests")
      .update(
        isPostCampaignTarget
          ? { post_campaign_last_metrics_updated: now }
          : { last_metrics_updated: now },
      )
      .eq("id", job.contestId);

    if (!isPostCampaignTarget) {
      await refreshContestStats(job.contestId);
      await persistContestBudgetSpent(job.contestId, supabaseAdmin);
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
