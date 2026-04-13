/**
 * POST: Batch worker for TikTok metrics refresh.
 */

import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { syncCreatorTikTokDisplayMetrics } from "@/lib/tiktok/sync-tiktok-display-metrics";

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

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: run, error: runError } = await supabaseAdmin
      .from("tiktok_metrics_refresh_runs")
      .select("id, status, started_at")
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

    const runStartedAt = run.started_at;

    let query = supabaseAdmin
      .from("submissions")
      .select("id, creator_id, content_link, video_id, views, other_stats, last_insights_update, insights_status")
      .eq("contest_id", contestId)
      .eq("platform", "tiktok")
      .neq("status", "rejected")
      .or("video_id.not.is.null,content_link.not.is.null")
      .or("insights_status.is.null,insights_status.neq.permanent_failure")
      .or(`last_insights_update.is.null,last_insights_update.lt.${runStartedAt}`)
      .order("last_insights_update", { ascending: true, nullsFirst: true })
      .order("id", { ascending: true })
      .limit(batchSize + 1);

    if (cursor && cursor.id) {
      if (cursor.last_insights_update == null) {
        query = query.or(`and(last_insights_update.is.null,id.gt.${cursor.id}),last_insights_update.not.is.null`);
      } else {
        query = query.or(
          `last_insights_update.gt.${cursor.last_insights_update},and(last_insights_update.eq.${cursor.last_insights_update},id.gt.${cursor.id})`
        );
      }
    }

    const { data: rows, error: selectError } = await query;

    if (selectError) {
      console.error("[tiktok-metrics-refresh batch] select error:", selectError);
      return NextResponse.json({ error: "Batch select failed" }, { status: 500 });
    }

    const batch = (rows ?? []).slice(0, batchSize);
    const hasMore = (rows?.length ?? 0) > batchSize;
    const lastRow = batch[batch.length - 1];
    const nextCursor =
      lastRow && hasMore
        ? { last_insights_update: lastRow.last_insights_update ?? null, id: lastRow.id }
        : undefined;

    if (batch.length === 0) {
      return NextResponse.json({
        hasMore: false,
        nextCursor: undefined,
        reviewedCount: 0,
        processedCount: 0,
        successCount: 0,
        permanentFailureCount: 0,
        temporaryFailureCount: 0,
        skippedRecentCount: 0,
      });
    }

    const submissionsByCreator = batch.reduce<Record<string, any[]>>((acc, row) => {
      const cid = row.creator_id;
      if (!acc[cid]) acc[cid] = [];
      acc[cid].push(row);
      return acc;
    }, {});

    const creatorIds = Object.keys(submissionsByCreator);
    let totalSyncedSubmissions = 0;
    let permanentFailures = 0;
    let temporaryFailures = 0;
    const now = new Date().toISOString();

    await mapLimit(creatorIds, 3, async (creatorId) => {
      const subs = submissionsByCreator[creatorId];
      const result = await syncCreatorTikTokDisplayMetrics(
        supabaseAdmin,
        creatorId,
        subs
      );

      if (result.success) {
        totalSyncedSubmissions += result.videosSynced || 0;
        permanentFailures += result.videosFailed || 0;
      } else {
        // If sync failed for creator (e.g. token error), mark their submissions as temporary_failure
        // and record the error message for debugging.
        temporaryFailures += subs.length;
        const errorMsg = result.error || "Unknown error during TikTok sync";
        
        for (const sub of subs) {
           await supabaseAdmin
            .from("submissions")
            .update({
              last_insights_update: now,
              insights_status: "temporary_failure",
              updated_at: now,
              other_stats: {
                ...(typeof sub.other_stats === "object" ? sub.other_stats : {}),
                tiktok_error: errorMsg,
              }
            })
            .eq("id", sub.id);
        }
      }
    });

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
          processed_submissions: (runRow.processed_submissions ?? 0) + totalSyncedSubmissions + permanentFailures + temporaryFailures,
          success_count: (runRow.success_count ?? 0) + totalSyncedSubmissions,
          permanent_failure_count: (runRow.permanent_failure_count ?? 0) + permanentFailures,
          temporary_failure_count: (runRow.temporary_failure_count ?? 0) + temporaryFailures,
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
      processedCount: totalSyncedSubmissions + permanentFailures + temporaryFailures,
      successCount: totalSyncedSubmissions,
      permanentFailureCount: permanentFailures,
      temporaryFailureCount: temporaryFailures,
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
