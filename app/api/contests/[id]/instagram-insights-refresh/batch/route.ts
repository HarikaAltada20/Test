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
  hasStatsChanged,
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

    let successCount = 0;
    let permanentFailureCount = 0;
    let temporaryFailureCount = 0;
    let skippedRecentCount = 0;
    const now = new Date().toISOString();
    const tokenUpdatesByCreator = new Map<string, InstagramAccount>();
    const submissionUpdates: Array<{
      id: string;
      views: number;
      other_stats: Record<string, unknown>;
      last_insights_update: string;
      insights_status: string;
    }> = [];
    const creatorNeedsReconnect = new Set<string>();

    const creatorIdList = Object.keys(submissionsByCreator);

    await mapLimit(creatorIdList, 3, async (creatorId) => {
      const creator = creatorsById.get(creatorId);
      if (!creator) return;
      const account = creator.instagram_account;
      if (
        !account?.access_token ||
        (account.account_type !== "BUSINESS" &&
          account.account_type !== "MEDIA_CREATOR")
      ) {
        return;
      }
      if (account.needs_reconnect) {
        const allSubs = submissionsByCreator[creatorId] as Array<{
          id: string;
          creator_id: string;
          video_id: string | null;
          views: number | null;
          other_stats: Record<string, unknown> | null;
          last_insights_update: string | null;
        }>;

        // Only skip "recent" submissions; if last_insights_update is older than 1 day before the run started,
        // allow them to be retried even when needs_reconnect is true.
        const oneDayBeforeRun = dayjs(runStartedAt).subtract(1, "day");
        const eligibleSubs: typeof allSubs = [];
        let skippedForCreator = 0;

        for (const sub of allSubs) {
          if (!sub.last_insights_update) {
            // Never refreshed or unknown timestamp: treat as eligible to retry.
            eligibleSubs.push(sub);
            continue;
          }
          const last = dayjs(sub.last_insights_update);
          const olderThanOneDayBeforeRun = last.isBefore(oneDayBeforeRun);
          if (olderThanOneDayBeforeRun) {
            eligibleSubs.push(sub);
          } else {
            skippedForCreator += 1;
          }
        }

        if (skippedForCreator > 0) {
          skippedRecentCount += skippedForCreator;
        }

        if (eligibleSubs.length === 0) {
          // Nothing old enough to retry for this creator
          return;
        }

        // Replace with the filtered list so the rest of the pipeline only processes eligible submissions.
        submissionsByCreator[creatorId] = eligibleSubs as BatchRow[];
      }

      let accessToken = account.access_token;
      if (account.token_expiry && isTokenExpiring(account.token_expiry)) {
        const newToken = await refreshToken(creatorId, accessToken);
        if (!newToken) {
          creatorNeedsReconnect.add(creatorId);
          temporaryFailureCount += submissionsByCreator[creatorId].length;
          // Add submissions to updates array with temporary_failure status
          submissionsByCreator[creatorId].forEach((sub) => {
            submissionUpdates.push({
              id: sub.id,
              views: sub.views || 0,
              other_stats: sub.other_stats || {},
              last_insights_update: now,
              insights_status: "temporary_failure",
            });
          });
          return;
        }
        accessToken = newToken;
        tokenUpdatesByCreator.set(creatorId, {
          ...account,
          access_token: newToken,
          token_expiry: dayjs().add(3600, "second").toISOString(),
        });
      }

      const subs = submissionsByCreator[creatorId] as Array<{
        id: string;
        creator_id: string;
        video_id: string;
        views: number | null;
        other_stats: Record<string, unknown> | null;
        last_insights_update: string | null;
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

        if (result.kind === "success") {
          const { views, stats } = result;
          const oldStats =
            sub.other_stats &&
            typeof sub.other_stats === "object" &&
            "instagram" in sub.other_stats
              ? (sub.other_stats as { instagram?: Record<string, number> })
                  .instagram
              : undefined;
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
          });
          successCount += hasStatsChanged(sub.views, views, oldStats, stats)
            ? 1
            : 1;
        } else {
          if (result.classification === "permanent_media") {
            permanentFailureCount++;
            submissionUpdates.push({
              id: sub.id,
              views: sub.views ?? 0,
              other_stats: (sub.other_stats as Record<string, unknown>) || {},
              last_insights_update: now,
              insights_status: "permanent_failure",
            });
          } else if (result.classification === "account_token") {
            creatorNeedsReconnect.add(creatorId);
            temporaryFailureCount++;
            submissionUpdates.push({
              id: sub.id,
              views: sub.views ?? 0,
              other_stats: (sub.other_stats as Record<string, unknown>) || {},
              last_insights_update: now,
              insights_status: "temporary_failure",
            });
          } else {
            temporaryFailureCount++;
            submissionUpdates.push({
              id: sub.id,
              views: sub.views ?? 0,
              other_stats: (sub.other_stats as Record<string, unknown>) || {},
              last_insights_update: now,
              insights_status: "temporary_failure",
            });
          }
        }
      });
    });

    // Write submission updates with bounded concurrency (avoid 120 sequential HTTP calls to Supabase).
    await mapLimit(submissionUpdates, 10, async (up) => {
      await supabaseAdmin
        .from("submissions")
        .update({
          views: up.views,
          other_stats: up.other_stats,
          last_insights_update: up.last_insights_update,
          insights_status: up.insights_status,
          updated_at: now,
        })
        .eq("id", up.id)
        .or(`last_insights_update.is.null,last_insights_update.lt.${runStartedAt}`);
    });

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
      const acc = { ...creator.instagram_account, needs_reconnect: true };
      await supabaseAdmin
        .from("creator_profiles")
        .update({ instagram_account: acc, updated_at: now })
        .eq("id", creatorId);
    });

    const processedInBatch = submissionUpdates.length;
    const { data: runRow } = await supabaseAdmin
      .from("instagram_insights_refresh_runs")
      .select("processed_submissions, success_count, permanent_failure_count, temporary_failure_count, skipped_recent_count")
      .eq("id", runId)
      .eq("current_batch_index", batchIndex)
      .single();

    if (runRow) {
      await supabaseAdmin
        .from("instagram_insights_refresh_runs")
        .update({
          processed_submissions: (runRow.processed_submissions ?? 0) + processedInBatch,
          success_count: (runRow.success_count ?? 0) + successCount,
          permanent_failure_count: (runRow.permanent_failure_count ?? 0) + permanentFailureCount,
          temporary_failure_count: (runRow.temporary_failure_count ?? 0) + temporaryFailureCount,
          skipped_recent_count: (runRow.skipped_recent_count ?? 0) + skippedRecentCount,
          current_batch_index: batchIndex + 1,
          last_batch_completed_at: now,
        })
        .eq("id", runId)
        .eq("current_batch_index", batchIndex);
    }

    return NextResponse.json({
      hasMore,
      nextCursor,
      successCount,
      permanentFailureCount,
      temporaryFailureCount,
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
