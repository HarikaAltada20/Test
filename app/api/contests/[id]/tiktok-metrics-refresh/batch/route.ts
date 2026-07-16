/**
 * POST: Batch worker for TikTok metrics refresh.
 */

import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { syncCreatorTikTokDisplayMetrics } from "@/lib/tiktok/sync-tiktok-display-metrics";
import { insightsRefreshInsightsStatusOrFilter } from "@/lib/insights-refresh-eligibility";
import { isContestEligibleForScheduledMetricsRefresh } from "@/lib/contest-metrics-refresh-eligibility";
import {
  isMetricsTargetMismatch,
  type MetricsRefreshTarget,
} from "@/lib/post-campaign-enqueue-guards";

type SubmissionCandidate = {
  id: string;
  creator_id: string;
  content_link: string | null;
  video_id: string | null;
  views: number | null;
  other_stats: unknown;
  last_insights_update: string | null;
  insights_status: string | null;
};

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (true) {
      const current = idx++;
      if (current >= items.length) return;
      results[current] = await fn(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const fromQueue = request.headers.get("X-From-Queue") === "1" || request.headers.get("x-from-queue") === "1";
    const auth = request.headers.get("Authorization");
    if (!fromQueue || !cronSecret || auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contestId } = await params;
    if (!contestId) {
      return NextResponse.json({ error: "Contest ID required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const runId = body.runId as string | undefined;
    const batchIndex = typeof body.batchIndex === "number" ? body.batchIndex : 0;
    const batchSize = typeof body.batchSize === "number" ? body.batchSize : 50;
    const cursor = body.cursor as { last_insights_update: string | null; id: string } | undefined;
    const metricsTarget: MetricsRefreshTarget =
      body?.metricsTarget === "post_campaign" ? "post_campaign" : "submissions";
    const isPostCampaignTarget = metricsTarget === "post_campaign";
    const writeTarget = isPostCampaignTarget
      ? "post_campaign_submission_metrics"
      : "submissions";

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: run, error: runError } = await supabaseAdmin
      .from("tiktok_metrics_refresh_runs")
      .select("id, status, started_at, metrics_target")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    if (run.status !== "running") {
      return NextResponse.json({
        hasMore: false,
        cancelled: run.status === "cancelled",
        runStatus: run.status,
      });
    }

    if (isMetricsTargetMismatch(run.metrics_target, metricsTarget)) {
      console.error(
        "[tiktok-metrics-refresh batch] metrics_target mismatch",
        {
          runId,
          contestId,
          jobTarget: metricsTarget,
          runTarget: run.metrics_target,
        },
      );
      return NextResponse.json(
        {
          error: "metrics_target mismatch between job and run",
          jobTarget: metricsTarget,
          runTarget: run.metrics_target ?? "submissions",
        },
        { status: 409 },
      );
    }

    console.info("[tiktok-metrics-refresh batch] start", {
      contestId,
      runId,
      batchIndex,
      metricsTarget,
    });

    const { data: contest } = await supabaseAdmin
      .from("contests")
      .select("id, views_locked_at, post_contest_status")
      .eq("id", contestId)
      .maybeSingle();

    if (
      !isPostCampaignTarget &&
      (!contest || !isContestEligibleForScheduledMetricsRefresh(contest))
    ) {
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("tiktok_metrics_refresh_runs")
        .update({
          status: "cancelled",
          error_message: "Contest locked for review or finalized",
          finished_at: now,
          updated_at: now,
        })
        .eq("id", runId)
        .eq("status", "running");
      return NextResponse.json({
        hasMore: false,
        cancelled: true,
        runStatus: "cancelled",
      });
    }

    const runStartedAt = run.started_at;
    let query = isPostCampaignTarget
      ? supabaseAdmin
          .from("post_campaign_submission_metrics")
          .select(
            "submission_id, creator_id, content_link, video_id, views, other_stats, last_insights_update, insights_status",
          )
          .eq("contest_id", contestId)
          .ilike("platform", "%tiktok%")
          .neq("status", "rejected")
          .or("video_id.not.is.null,content_link.not.is.null")
          .or(insightsRefreshInsightsStatusOrFilter())
          .or(`last_insights_update.is.null,last_insights_update.lt.${runStartedAt}`)
          .order("last_insights_update", { ascending: true, nullsFirst: true })
          .order("submission_id", { ascending: true })
          .limit(batchSize + 1)
      : supabaseAdmin
          .from("submissions")
          .select(
            "id, creator_id, content_link, video_id, views, other_stats, last_insights_update, insights_status",
          )
          .eq("contest_id", contestId)
          .eq("platform", "tiktok")
          .neq("status", "rejected")
          .or("video_id.not.is.null,content_link.not.is.null")
          .or(insightsRefreshInsightsStatusOrFilter())
          .or(`last_insights_update.is.null,last_insights_update.lt.${runStartedAt}`)
          .order("last_insights_update", { ascending: true, nullsFirst: true })
          .order("id", { ascending: true })
          .limit(batchSize + 1);

    if (cursor && cursor.id) {
      const idCol = isPostCampaignTarget ? "submission_id" : "id";
      if (cursor.last_insights_update == null) {
        query = query.or(
          `and(last_insights_update.is.null,${idCol}.gt.${cursor.id}),last_insights_update.not.is.null`,
        );
      } else {
        query = query.or(
          `last_insights_update.gt.${cursor.last_insights_update},and(last_insights_update.eq.${cursor.last_insights_update},${idCol}.gt.${cursor.id})`,
        );
      }
    }

    const { data: rows, error: selectError } = await query;
    if (selectError) {
      console.error("[tiktok-metrics-refresh batch] select error:", selectError);
      return NextResponse.json({ error: "Batch select failed" }, { status: 500 });
    }

    const batch: SubmissionCandidate[] = ((rows ?? []).slice(0, batchSize) as any[]).map(
      (row) => ({
        id: isPostCampaignTarget ? row.submission_id : row.id,
        creator_id: row.creator_id,
        content_link: row.content_link,
        video_id: row.video_id,
        views: row.views,
        other_stats: row.other_stats,
        last_insights_update: row.last_insights_update,
        insights_status: row.insights_status,
      }),
    );
    const hasMore = (rows?.length ?? 0) > batchSize;
    const lastRow = batch[batch.length - 1];
    const nextCursor =
      lastRow && hasMore
        ? {
            last_insights_update: lastRow.last_insights_update ?? null,
            id: lastRow.id,
          }
        : undefined;

    if (batch.length === 0) {
      return NextResponse.json({
        hasMore,
        nextCursor,
        reviewedCount: 0,
        processedCount: 0,
        successCount: 0,
        permanentFailureCount: 0,
        temporaryFailureCount: 0,
        skippedRecentCount: 0,
      });
    }

    const submissionsByCreator = batch.reduce<Record<string, SubmissionCandidate[]>>(
      (acc, row) => {
        const cid = row.creator_id;
        if (!acc[cid]) acc[cid] = [];
        acc[cid].push(row);
        return acc;
      },
      {},
    );

    const creatorIds = Object.keys(submissionsByCreator);
    const now = new Date().toISOString();

    await mapLimit(creatorIds, 3, async (creatorId) => {
      const subs = submissionsByCreator[creatorId];
      const result = await syncCreatorTikTokDisplayMetrics(
        supabaseAdmin,
        creatorId,
        subs,
        { metricsTarget: writeTarget },
      );

      if (!result.success) {
        // If sync failed for creator (e.g. token error), mark their submissions as temporary_failure
        // and record the error message for debugging.
        const errorMsg = result.error || "Unknown error during TikTok sync";

        if (isPostCampaignTarget) {
          await mapLimit(subs, 8, async (sub) => {
            await supabaseAdmin
              .from("post_campaign_submission_metrics")
              .update({
                last_insights_update: now,
                insights_status: "temporary_failure",
                updated_at: now,
                other_stats: {
                  ...(typeof sub.other_stats === "object" && sub.other_stats
                    ? (sub.other_stats as Record<string, unknown>)
                    : {}),
                  tiktok_error: errorMsg,
                },
              })
              .eq("submission_id", sub.id);
          });
        } else {
          const updates = subs.map((sub) => ({
            id: sub.id,
            last_insights_update: now,
            insights_status: "temporary_failure",
            updated_at: now,
            other_stats: {
              ...(typeof sub.other_stats === "object" ? sub.other_stats : {}),
              tiktok_error: errorMsg,
            },
          }));

          const { error: batchUpdateError } = await supabaseAdmin
            .from("submissions")
            .upsert(updates, { onConflict: "id" });
          if (batchUpdateError) {
            console.error(
              "[tiktok-metrics-refresh batch] failed to persist temporary_failure updates:",
              batchUpdateError,
            );
          }
        }
      }
    });

    // Instagram-style run accounting:
    // - processedInBatch: only rows actually updated in this run
    // - status counters: transitions from previous -> new state (not raw attempts)
    const previousStatusById = new Map(
      batch.map((row) => [row.id, row.insights_status ?? null]),
    );
    const runStartedAtMs = new Date(runStartedAt).getTime();
    const batchIds = batch.map((row) => row.id);
    const { data: afterRows, error: afterRowsError } = isPostCampaignTarget
      ? await supabaseAdmin
          .from("post_campaign_submission_metrics")
          .select("submission_id, insights_status, last_insights_update")
          .in("submission_id", batchIds)
      : await supabaseAdmin
          .from("submissions")
          .select("id, insights_status, last_insights_update")
          .in("id", batchIds);
    if (afterRowsError) {
      console.error("[tiktok-metrics-refresh batch] post-update read failed:", afterRowsError);
      return NextResponse.json(
        { error: "Failed to calculate batch counters" },
        { status: 500 },
      );
    }

    let processedInBatch = 0;
    let successTransitions = 0;
    let permanentTransitions = 0;
    let temporaryTransitions = 0;
    for (const row of afterRows ?? []) {
      const rowId = isPostCampaignTarget
        ? (row as { submission_id: string }).submission_id
        : (row as { id: string }).id;
      const updatedAtMs = row.last_insights_update
        ? new Date(row.last_insights_update).getTime()
        : Number.NaN;
      const wasProcessed =
        !Number.isNaN(updatedAtMs) &&
        (Number.isNaN(runStartedAtMs) || updatedAtMs >= runStartedAtMs);
      if (!wasProcessed) continue;

      processedInBatch += 1;
      const previousStatus = previousStatusById.get(rowId) ?? null;
      const newStatus = row.insights_status ?? null;
      if (newStatus === "ok" && previousStatus !== "ok") successTransitions += 1;
      else if (
        newStatus === "permanent_failure" &&
        previousStatus !== "permanent_failure"
      ) {
        permanentTransitions += 1;
      } else if (
        newStatus === "temporary_failure" &&
        previousStatus !== "temporary_failure"
      ) {
        temporaryTransitions += 1;
      }
    }

    const reviewedInBatch = batch.length;
    const { data: runRow } = await supabaseAdmin
      .from("tiktok_metrics_refresh_runs")
      .select("processed_submissions, success_count, permanent_failure_count, temporary_failure_count, reviewed_count")
      .eq("id", runId)
      .eq("current_batch_index", batchIndex)
      .single();

    if (runRow) {
      await supabaseAdmin
        .from("tiktok_metrics_refresh_runs")
        .update({
          reviewed_count: (runRow.reviewed_count ?? 0) + reviewedInBatch,
          processed_submissions: (runRow.processed_submissions ?? 0) + processedInBatch,
          success_count: (runRow.success_count ?? 0) + successTransitions,
          permanent_failure_count: (runRow.permanent_failure_count ?? 0) + permanentTransitions,
          temporary_failure_count: (runRow.temporary_failure_count ?? 0) + temporaryTransitions,
          current_batch_index: batchIndex + 1,
          last_batch_completed_at: now,
          updated_at: now,
        })
        .eq("id", runId)
        .eq("current_batch_index", batchIndex);
    }

    return NextResponse.json({
      hasMore,
      nextCursor,
      reviewedCount: reviewedInBatch,
      processedCount: processedInBatch,
      successCount: successTransitions,
      permanentFailureCount: permanentTransitions,
      temporaryFailureCount: temporaryTransitions,
      skippedRecentCount: 0,
    });
  } catch (e) {
    console.error("[tiktok-metrics-refresh batch]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Batch failed" },
      { status: 500 }
    );
  }
}
