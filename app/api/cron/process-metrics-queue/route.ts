/**
 * Cron: process Twitter metrics refresh queue (Redis only, no QStash).
 * Pops one job from Redis and processes it (raid or one batch of awareness).
 * Call with Authorization: Bearer CRON_SECRET. Schedule via Vercel cron (e.g. every 1–2 min).
 */

import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import {
  popJob,
  enqueueMetricsRefreshJob,
  isMetricsQueueEnabled,
  type MetricsRefreshJob,
} from "@/lib/queue/metrics-refresh-queue";

function getBaseUrl(): string {
  const url = process.env.VERCEL_URL;
  if (url) return `https://${url}`;
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}

async function handleRequest(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMetricsQueueEnabled()) {
    return NextResponse.json(
      { processed: 0, message: "Queue not configured (Redis env missing)" },
      { status: 200 }
    );
  }

  const job = await popJob();
  if (!job) {
    return NextResponse.json({ processed: 0, message: "Queue empty" });
  }

  const jobStartMs = Date.now();
  const baseUrl = getBaseUrl();
  const { contestId } = job;
  console.log(`[process-metrics-queue] Processing job contestId=${contestId} job.isRaid=${job.isRaid}`);

  // Always verify campaign type from DB so awareness campaigns never run fetch-raid-engagements
  const supabaseAdmin = createAdminSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: contest } = await supabaseAdmin
    .from("contests")
    .select("contest_based_details, platform")
    .eq("id", contestId)
    .maybeSingle();

  const platform = (contest?.platform ?? "").toString().toLowerCase();
  const isTwitterPlatform = platform === "twitter" || platform === "x";
  const campaignType =
    (contest as { contest_based_details?: { twitter_campaign?: { campaign_type?: string } } })
      ?.contest_based_details?.twitter_campaign?.campaign_type ?? "";
  const isRaidCampaign =
    isTwitterPlatform &&
    typeof campaignType === "string" &&
    campaignType.toLowerCase().trim() === "raid";

  console.log(`[process-metrics-queue] contestId=${contestId} campaign_type=${campaignType} isRaidCampaign=${isRaidCampaign} → ${isRaidCampaign ? "fetch-raid-engagements" : "twitter-refresh-tweets"}`);

  // Raid campaign → fetch-raid-engagements only. Awareness → twitter-refresh-tweets only.
  if (job.isRaid && isRaidCampaign) {
    const raidUrl = `${baseUrl}/api/contests/${contestId}/fetch-raid-engagements`;
    try {
      const raidRes = await fetch(raidUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
        },
        body: JSON.stringify({}),
      });
      if (!raidRes.ok) {
        const text = await raidRes.text();
        console.error("[process-metrics-queue] Raid fetch failed:", raidRes.status, text);
        return NextResponse.json(
          { processed: 1, error: "Raid fetch failed", details: text },
          { status: 500 }
        );
      }
    } catch (err) {
      console.error("[process-metrics-queue] Raid fetch error:", err);
      return NextResponse.json(
        { processed: 1, error: err instanceof Error ? err.message : "Raid fetch failed" },
        { status: 500 }
      );
    }

    const doneTime = new Date().toISOString();
    await supabaseAdmin
      .from("contests")
      .update({ last_metrics_updated: doneTime })
      .eq("id", contestId);

    const raidElapsedMs = Date.now() - jobStartMs;
    console.log(
      `[process-metrics-queue] contestId=${contestId} raid refresh completed in ${raidElapsedMs}ms`
    );
    return NextResponse.json({
      processed: 1,
      contestId,
      isRaid: true,
      lastMetricsUpdated: doneTime,
    });
  }

  // Awareness campaign → twitter-refresh-tweets only (never fetch-raid-engagements)
  // Need batchIndex and totalBatches (from job or compute if job was wrongly isRaid)
  let batchIndex: number;
  let totalBatches: number;
  const BATCH_SIZE = 5;

  if (job.isRaid && !isRaidCampaign) {
    // Job said raid but contest is awareness → run twitter-refresh-tweets (batch 0)
    batchIndex = 0;
    const { count } = await supabaseAdmin
      .from("twitter_campaign_participants")
      .select("*", { count: "exact", head: true })
      .eq("contest_id", contestId)
      .eq("is_active", true);
    const participantCount = count ?? 0;
    totalBatches = Math.max(1, Math.ceil(participantCount / BATCH_SIZE));
  } else if (!job.isRaid && "batchIndex" in job && "totalBatches" in job) {
    batchIndex = job.batchIndex;
    totalBatches = job.totalBatches;
  } else {
    return NextResponse.json(
      { processed: 1, error: "Invalid job: missing batchIndex/totalBatches for awareness" },
      { status: 400 }
    );
  }

  if (
    totalBatches < 1 ||
    batchIndex < 0 ||
    batchIndex >= totalBatches
  ) {
    return NextResponse.json(
      { processed: 1, error: "Invalid batchIndex/totalBatches" },
      { status: 400 }
    );
  }

  const refreshUrl = `${baseUrl}/api/contests/${contestId}/twitter-refresh-tweets`;
  try {
    const refreshRes = await fetch(refreshUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-From-Queue": "1",
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
      body: JSON.stringify({
        fromQueue: true,
        batchIndex,
        totalBatches,
      }),
    });

    const refreshData = await refreshRes.json().catch(() => ({}));

    if (!refreshRes.ok) {
      console.error("[process-metrics-queue] Refresh batch failed:", refreshRes.status, refreshData);
      return NextResponse.json(
        { processed: 1, error: "Refresh batch failed", details: refreshData },
        { status: 500 }
      );
    }

    const hasMore =
      batchIndex + 1 < totalBatches &&
      (refreshData.hasMore === true || refreshData.hasMore === undefined);

    if (hasMore) {
      const nextJob: MetricsRefreshJob = {
        contestId,
        isRaid: false,
        batchIndex: batchIndex + 1,
        totalBatches,
      };
      await enqueueMetricsRefreshJob(nextJob);
    }

    const batchElapsedMs = Date.now() - jobStartMs;
    console.log(
      `[process-metrics-queue] contestId=${contestId} batch ${batchIndex + 1}/${totalBatches} completed in ${batchElapsedMs}ms hasMore=${hasMore}`
    );
    return NextResponse.json({
      processed: 1,
      contestId,
      batchIndex,
      totalBatches,
      hasMore,
    });
  } catch (err) {
    const errElapsedMs = Date.now() - jobStartMs;
    console.error(
      `[process-metrics-queue] Refresh error after ${errElapsedMs}ms:`,
      err
    );
    return NextResponse.json(
      { processed: 1, error: err instanceof Error ? err.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
