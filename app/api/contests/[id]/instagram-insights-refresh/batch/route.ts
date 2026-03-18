/**
 * POST: Batch worker for Instagram insights refresh.
 * Called by the processor with fromQueue, runId, batchIndex, batchSize, totalBatches, cursor.
 * Worker does NOT set run.status = 'completed'; it returns hasMore and nextCursor.
 */

import { NextResponse } from "next/server";
import dayjs from "dayjs";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import {
  refreshToken,
  fetchInsights,
  isTokenExpiring,
  type InstagramAccount,
  type SubmissionForInsights,
  type FetchInsightsResult,
} from "@/lib/instagram-insights";

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
    const batchSize = typeof body.batchSize === "number" ? body.batchSize : 100;
    const cursor = body.cursor as { last_insights_update: string | null; id: string } | undefined;

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: run, error: runError } = await supabaseAdmin
      .from("instagram_insights_refresh_runs")
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
      .select("id, creator_id, video_id, views, other_stats, last_insights_update, insights_status")
      .eq("contest_id", contestId)
      .eq("platform", "instagram")
      .neq("status", "rejected")
      .not("video_id", "is", null)
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
      console.error("[instagram-insights-refresh batch] select error:", selectError);
      return NextResponse.json({ error: "Batch select failed" }, { status: 500 });
    }

    type BatchRow = {
      id: string;
      creator_id: string;
      video_id: string | null;
      views: number | null;
      other_stats: Record<string, unknown> | null;
      last_insights_update: string | null;
      insights_status: string | null;
    };

    const batch: BatchRow[] = (rows ?? []).slice(0, batchSize) as BatchRow[];
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

    const creatorIds = [...new Set(batch.map((r) => r.creator_id))];
    const { data: creators } = await supabaseAdmin
      .from("creator_profiles")
      .select("id, instagram_account")
      .in("id", creatorIds)
      .not("instagram_account", "is", null);

    const creatorsById = new Map<string | number, { id: string; instagram_account: InstagramAccount }>();
    for (const c of creators ?? []) {
      const acc = (c as { instagram_account?: unknown }).instagram_account;
      if (acc && typeof acc === "object" && "access_token" in acc) {
        creatorsById.set(c.id, c as { id: string; instagram_account: InstagramAccount });
      }
    }

    const submissionsByCreator = batch.reduce<Record<string, BatchRow[]>>((acc, row) => {
      const cid = row.creator_id;
      if (!acc[cid]) acc[cid] = [];
      acc[cid].push(row);
      return acc;
    }, {});

    let skippedRecentCount = 0;
    const now = new Date().toISOString();
    const tokenUpdatesByCreator = new Map<string, InstagramAccount>();
    const submissionUpdates: Array<{
      id: string;
      views: number;
      other_stats: Record<string, unknown>;
      last_insights_update: string;
      insights_status: string;
      previous_insights_status: string | null;
    }> = [];
    const creatorNeedsReconnect = new Set<string>();

    const creatorIdList = Object.keys(submissionsByCreator);

    await mapLimit(creatorIdList, 3, async (creatorId) => {
      const creator = creatorsById.get(creatorId);
      const allSubsForCreator = submissionsByCreator[creatorId] as BatchRow[];

      // Creator has no valid Instagram account: mark all their submissions as temporary_failure (no API calls).
      if (!creator) {
        allSubsForCreator.forEach((sub) => {
          submissionUpdates.push({
            id: sub.id,
            views: sub.views ?? 0,
            other_stats: (sub.other_stats as Record<string, unknown>) || {},
            last_insights_update: now,
            insights_status: "temporary_failure",
            previous_insights_status: sub.insights_status ?? null,
          });
        });
        return;
      }

      const account = creator.instagram_account;
      if (
        !account?.access_token ||
        (account.account_type !== "BUSINESS" &&
          account.account_type !== "MEDIA_CREATOR")
      ) {
        allSubsForCreator.forEach((sub) => {
          submissionUpdates.push({
            id: sub.id,
            views: sub.views ?? 0,
            other_stats: (sub.other_stats as Record<string, unknown>) || {},
            last_insights_update: now,
            insights_status: "temporary_failure",
            previous_insights_status: sub.insights_status ?? null,
          });
        });
        return;
      }

      // needs_reconnect: skip if last attempt was < 1 day ago; else attempt again. Set last_connection_check_at on attempt.
      if (account.needs_reconnect) {
        const lastCheck = account.last_connection_check_at
          ? dayjs(account.last_connection_check_at)
          : null;
        const oneDayAgo = dayjs().subtract(1, "day");
        if (lastCheck && lastCheck.isAfter(oneDayAgo)) {
          // Skip: mark all their submissions as temporary_failure without calling API.
          skippedRecentCount += allSubsForCreator.length;
          allSubsForCreator.forEach((sub) => {
            submissionUpdates.push({
              id: sub.id,
              views: sub.views ?? 0,
              other_stats: (sub.other_stats as Record<string, unknown>) || {},
              last_insights_update: now,
              insights_status: "temporary_failure",
              previous_insights_status: sub.insights_status ?? null,
            });
          });
          return;
        }
      }

      let accessToken = account.access_token;
      if (account.token_expiry && isTokenExpiring(account.token_expiry)) {
        const refreshResult = await refreshToken(creatorId, accessToken);
        if (!refreshResult) {
          creatorNeedsReconnect.add(creatorId);
          allSubsForCreator.forEach((sub) => {
            submissionUpdates.push({
              id: sub.id,
              views: sub.views ?? 0,
              other_stats: (sub.other_stats as Record<string, unknown>) || {},
              last_insights_update: now,
              insights_status: "temporary_failure",
              previous_insights_status: sub.insights_status ?? null,
            });
          });
          return;
        }
        accessToken = refreshResult.access_token;
        const expirySeconds = refreshResult.expires_in ?? 3600;
        tokenUpdatesByCreator.set(creatorId, {
          ...account,
          access_token: refreshResult.access_token,
          token_expiry: dayjs().add(expirySeconds, "second").toISOString(),
          last_connection_check_at: now,
        });
      }

      const subs = submissionsByCreator[creatorId] as Array<{
        id: string;
        creator_id: string;
        video_id: string;
        views: number | null;
        other_stats: Record<string, unknown> | null;
        last_insights_update: string | null;
        insights_status: string | null;
      }>;

      await mapLimit(subs, 4, async (sub) => {
        const submission: SubmissionForInsights = {
          id: sub.id,
          creator_id: sub.creator_id,
          video_id: sub.video_id!,
          views: sub.views,
          other_stats: sub.other_stats ?? undefined,
        };
        const result: FetchInsightsResult = await fetchInsights(
          submission,
          accessToken
        );
        const previousStatus = sub.insights_status ?? null;

        if (result.kind === "success") {
          const { views, stats } = result;
          submissionUpdates.push({
            id: sub.id,
            views,
            other_stats: {
              ...(((sub.other_stats as Record<string, unknown>) || {}) as Record<
                string,
                unknown
              >),
              instagram: stats,
            },
            last_insights_update: now,
            insights_status: "ok",
            previous_insights_status: previousStatus,
          });
        } else {
          if (result.classification === "permanent_media") {
            submissionUpdates.push({
              id: sub.id,
              views: sub.views ?? 0,
              other_stats: (sub.other_stats as Record<string, unknown>) || {},
              last_insights_update: now,
              insights_status: "permanent_failure",
              previous_insights_status: previousStatus,
            });
          } else if (result.classification === "account_token") {
            creatorNeedsReconnect.add(creatorId);
            submissionUpdates.push({
              id: sub.id,
              views: sub.views ?? 0,
              other_stats: (sub.other_stats as Record<string, unknown>) || {},
              last_insights_update: now,
              insights_status: "temporary_failure",
              previous_insights_status: previousStatus,
            });
          } else {
            submissionUpdates.push({
              id: sub.id,
              views: sub.views ?? 0,
              other_stats: (sub.other_stats as Record<string, unknown>) || {},
              last_insights_update: now,
              insights_status: "temporary_failure",
              previous_insights_status: previousStatus,
            });
          }
        }
      });
    });

    // Write submission updates; only count as processed when a row was actually updated. Count transitions for success/permanent/temporary.
    // We update by id only: the batch was already selected with last_insights_update < runStartedAt (or null), and we have one active run per contest, so no need to re-check last_insights_update here (that check was causing 0 rows updated when timestamps or concurrency made the condition fail).
    type UpdateResult = { updated: boolean; newStatus: string; previousStatus: string | null };
    const updateResults: UpdateResult[] = await mapLimit(submissionUpdates, 10, async (up) => {
      const { data, error } = await supabaseAdmin
        .from("submissions")
        .update({
          views: up.views,
          other_stats: up.other_stats,
          last_insights_update: up.last_insights_update,
          insights_status: up.insights_status,
          updated_at: now,
        })
        .eq("id", up.id)
        .select("id")
        .maybeSingle();
      return {
        updated: !error && data != null,
        newStatus: up.insights_status,
        previousStatus: up.previous_insights_status,
      };
    });

    let processedInBatch = 0;
    let successTransitions = 0;
    let permanentTransitions = 0;
    let temporaryTransitions = 0;
    for (const r of updateResults) {
      if (!r.updated) continue;
      processedInBatch += 1;
      if (r.newStatus === "ok" && r.previousStatus !== "ok") successTransitions += 1;
      else if (r.newStatus === "permanent_failure" && r.previousStatus !== "permanent_failure") permanentTransitions += 1;
      else if (r.newStatus === "temporary_failure" && r.previousStatus !== "temporary_failure") temporaryTransitions += 1;
    }

    await mapLimit([...tokenUpdatesByCreator.entries()], 5, async ([creatorId, newAccount]) => {
      await supabaseAdmin
        .from("creator_profiles")
        .update({
          instagram_account: newAccount,
          updated_at: now,
        })
        .eq("id", creatorId);
    });

    await mapLimit([...creatorNeedsReconnect.values()], 5, async (creatorId) => {
      const creator = creatorsById.get(creatorId);
      if (!creator) return;
      const acc = {
        ...creator.instagram_account,
        needs_reconnect: true,
        last_connection_check_at: now,
      };
      await supabaseAdmin
        .from("creator_profiles")
        .update({ instagram_account: acc, updated_at: now })
        .eq("id", creatorId);
    });

    const reviewedInBatch = batch.length;
    const { data: runRow } = await supabaseAdmin
      .from("instagram_insights_refresh_runs")
      .select("processed_submissions, success_count, permanent_failure_count, temporary_failure_count, skipped_recent_count, reviewed_count")
      .eq("id", runId)
      .eq("current_batch_index", batchIndex)
      .single();

    if (runRow) {
      await supabaseAdmin
        .from("instagram_insights_refresh_runs")
        .update({
          reviewed_count: (runRow.reviewed_count ?? 0) + reviewedInBatch,
          processed_submissions: (runRow.processed_submissions ?? 0) + processedInBatch,
          success_count: (runRow.success_count ?? 0) + successTransitions,
          permanent_failure_count: (runRow.permanent_failure_count ?? 0) + permanentTransitions,
          temporary_failure_count: (runRow.temporary_failure_count ?? 0) + temporaryTransitions,
          skipped_recent_count: (runRow.skipped_recent_count ?? 0) + skippedRecentCount,
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
      skippedRecentCount,
    });
  } catch (e) {
    console.error("[instagram-insights-refresh batch]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Batch failed" },
      { status: 500 }
    );
  }
}
