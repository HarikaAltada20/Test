/**
 * POST: Batch worker for YouTube metrics refresh (queue only).
 */

import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { refreshAccessToken, extractYoutubeId } from "@/lib/youtube-api";
import type { YouTubeRefreshScope } from "@/lib/queue/youtube-metrics-queue";
import {
  updateYouTubeSubmissionForScope,
  fetchYouTubeBasicStatsByVideoId,
  isYouTubeAllLikeScope,
  type PrefetchedBasic,
} from "@/lib/youtube-submission-refresh-by-scope";
import { insightsRefreshInsightsStatusOrFilter } from "@/lib/insights-refresh-eligibility";
import { isContestEligibleForScheduledMetricsRefresh } from "@/lib/contest-metrics-refresh-eligibility";
import {
  buildOtherStatsWithYoutube,
  getExistingYouTubeStats,
} from "@/lib/youtube-other-stats";

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

type BatchRow = {
  id: string;
  creator_id: string;
  content_link: string;
  views: number | null;
  other_stats: Record<string, unknown> | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: "YouTube queue auth misconfigured: CRON_SECRET missing" },
        { status: 503 },
      );
    }
    const fromQueue =
      request.headers.get("X-From-Queue") === "1" || request.headers.get("x-from-queue") === "1";
    const auth = request.headers.get("Authorization");
    if (!fromQueue || auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contestId } = await params;
    if (!contestId) {
      return NextResponse.json({ error: "Contest ID required" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const runId = body.runId as string | undefined;
    const batchIndex = typeof body.batchIndex === "number" ? body.batchIndex : 0;
    const batchSize = typeof body.batchSize === "number" ? body.batchSize : 25;
    const cursor = body.cursor as { id: string } | undefined;

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: run, error: runError } = await supabaseAdmin
      .from("youtube_metrics_refresh_runs")
      .select("id, status, scope")
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

    const scope = run.scope as YouTubeRefreshScope;

    const { data: contest } = await supabaseAdmin
      .from("contests")
      .select("id, views_locked_at, post_contest_status")
      .eq("id", contestId)
      .maybeSingle();

    if (!contest || !isContestEligibleForScheduledMetricsRefresh(contest)) {
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("youtube_metrics_refresh_runs")
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

    let query = supabaseAdmin
      .from("submissions")
      .select("id, creator_id, content_link, views, other_stats")
      .eq("contest_id", contestId)
      .ilike("platform", "%youtube%")
      .neq("status", "rejected")
      .not("content_link", "is", null)
      .or(insightsRefreshInsightsStatusOrFilter())
      .order("id", { ascending: true })
      .limit(batchSize + 1);

    if (cursor?.id) {
      query = query.gt("id", cursor.id);
    }

    const { data: rows, error: selectError } = await query;

    if (selectError) {
      console.error("[youtube-metrics-refresh batch] select error:", selectError);
      return NextResponse.json({ error: "Batch select failed" }, { status: 500 });
    }

    const batch = (rows ?? []).slice(0, batchSize) as BatchRow[];
    const hasMore = (rows?.length ?? 0) > batchSize;
    const lastRow = batch[batch.length - 1];
    const nextCursor = lastRow && hasMore ? { id: lastRow.id } : undefined;

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
    const byCreator = batch.reduce<Record<string, BatchRow[]>>((acc, row) => {
      if (!acc[row.creator_id]) acc[row.creator_id] = [];
      acc[row.creator_id].push(row);
      return acc;
    }, {});
    const { data: creators } = await supabaseAdmin
      .from("creator_profiles")
      .select("id, youtube_account")
      .in("id", creatorIds);

    const tokenMap = new Map<string, string>();
    const skippedCreatorIds = new Set<string>();
    const now = new Date().toISOString();
    let skippedRecentCount = 0;

    for (const creator of creators ?? []) {
      const account = creator.youtube_account as Record<string, unknown> | null;
      if (!account?.access_token) {
        // Disconnected or missing token - handle as temporary failure
        const creatorSubs = byCreator[creator.id] ?? [];
        skippedRecentCount += creatorSubs.length;
        await mapLimit(creatorSubs, 8, async (sub) => {
          const existingYoutube = getExistingYouTubeStats(sub.other_stats);
          await supabaseAdmin
            .from("submissions")
            .update({
              insights_status: "temporary_failure",
              last_insights_update: now,
              updated_at: now,
              other_stats: buildOtherStatsWithYoutube(sub.other_stats, {
                ...existingYoutube,
                analytics_needs_reauth: true,
                insights_error: "Account disconnected or missing token",
              }),
            })
            .eq("id", sub.id);
        });
        skippedCreatorIds.add(creator.id);
        continue;
      }

      // Mirror Instagram skip behavior: if a creator is flagged needs_reconnect and
      // was checked recently, skip API calls for this run and count them as skipped.
      if (account.needs_reconnect === true) {
        const lastCheckRaw =
          (account.last_connection_check_at as string | undefined) ??
          (account.updated_at as string | undefined);
        const lastCheckMs = lastCheckRaw ? new Date(lastCheckRaw).getTime() : NaN;
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (!Number.isNaN(lastCheckMs) && Date.now() - lastCheckMs < oneDayMs) {
          const creatorSubs = byCreator[creator.id] ?? [];
          skippedRecentCount += creatorSubs.length;
          await mapLimit(creatorSubs, 8, async (sub) => {
            const existingYoutube = getExistingYouTubeStats(sub.other_stats);
            await supabaseAdmin
              .from("submissions")
              .update({
                insights_status: "temporary_failure",
                last_insights_update: now,
                updated_at: now,
                other_stats: buildOtherStatsWithYoutube(sub.other_stats, {
                  ...existingYoutube,
                  analytics_needs_reauth: true,
                }),
              })
              .eq("id", sub.id);
          });
          skippedCreatorIds.add(creator.id);
          continue;
        }
      }

      let token = String(account.access_token);
      const expiresAt = account.expires_at as string | undefined;
      const isExpired = expiresAt && new Date(expiresAt) <= new Date();
      if (isExpired && account.refresh_token) {
        try {
          const newTokens = await refreshAccessToken(String(account.refresh_token));
          token = newTokens.access_token;
          await supabaseAdmin
            .from("creator_profiles")
            .update({
              youtube_account: {
                ...account,
                access_token: newTokens.access_token,
                expires_at: newTokens.expires_at,
                refresh_token: newTokens.refresh_token || account.refresh_token,
                needs_reconnect: false,
                last_connection_check_at: now,
              },
              updated_at: now,
            })
            .eq("id", creator.id);
        } catch (e) {
          await supabaseAdmin
            .from("creator_profiles")
            .update({
              youtube_account: {
                ...account,
                needs_reconnect: true,
                last_connection_check_at: now,
                updated_at: now,
              },
              updated_at: now,
            })
            .eq("id", creator.id);

          // Mark submissions as temporary failure since we discovered token refresh failed
          const creatorSubs = byCreator[creator.id] ?? [];
          skippedRecentCount += creatorSubs.length;
          await mapLimit(creatorSubs, 8, async (sub) => {
            const existingYoutube = getExistingYouTubeStats(sub.other_stats);
            await supabaseAdmin
              .from("submissions")
              .update({
                insights_status: "temporary_failure",
                last_insights_update: now,
                updated_at: now,
                other_stats: buildOtherStatsWithYoutube(sub.other_stats, {
                  ...existingYoutube,
                  analytics_needs_reauth: true,
                  insights_error: "Token refresh failed",
                }),
              })
              .eq("id", sub.id);
          });
          skippedCreatorIds.add(creator.id);
          continue;
        }
      }
      tokenMap.set(creator.id, token);
    }

    const batchToProcess = batch.filter(
      (sub) => !skippedCreatorIds.has(sub.creator_id)
    );

    const prefetchBasic = scope === "basic" || isYouTubeAllLikeScope(scope);
    const basicByCreator = new Map<string, Map<string, PrefetchedBasic>>();

    if (prefetchBasic) {
      await mapLimit(Object.keys(byCreator), 4, async (creatorId) => {
        const token = tokenMap.get(creatorId);
        if (!token) return;
        const subs = byCreator[creatorId];
        const videoIds = subs
          .map((s) => extractYoutubeId(s.content_link))
          .filter((id): id is string => !!id);
        const statsMap = await fetchYouTubeBasicStatsByVideoId(token, videoIds);
        basicByCreator.set(creatorId, statsMap);
      });
    }

    const results = await mapLimit(batchToProcess, 5, async (sub) => {
      const token = tokenMap.get(sub.creator_id);
      if (!token) {
        // Fallback for any creators who didn't even have a record in creators list
        // Update DB so it turns yellow
        const existingYoutube = getExistingYouTubeStats(sub.other_stats);
        await supabaseAdmin
          .from("submissions")
          .update({
            insights_status: "temporary_failure",
            last_insights_update: now,
            updated_at: now,
            other_stats: buildOtherStatsWithYoutube(sub.other_stats, {
              ...existingYoutube,
              analytics_needs_reauth: true,
              insights_error: "Missing creator profile or token",
            }),
          })
          .eq("id", sub.id);
        return {
          ok: false,
          auth: false,
          failureType: "temporary_failure" as const,
        };
      }
      const videoId = extractYoutubeId(sub.content_link);
      let prefetched: PrefetchedBasic | null | undefined = undefined;
      if (prefetchBasic && videoId) {
        prefetched = basicByCreator.get(sub.creator_id)?.get(videoId) ?? null;
      }
      const res = await updateYouTubeSubmissionForScope(
        supabaseAdmin,
        sub,
        token,
        scope,
        now,
        prefetchBasic ? { prefetchedBasic: prefetched } : undefined
      );
      return { ok: res.ok, auth: res.authError, failureType: res.failureType };
    });

    let success = 0;
    let tempFail = 0;
    let permFail = 0;
    for (const r of results) {
      if (r.ok) {
        success += 1;
      } else if (r.failureType === "permanent_failure") {
        permFail += 1;
      } else {
        tempFail += 1;
      }
    }

    const reviewedInBatch = batch.length;
    const { data: runRow } = await supabaseAdmin
      .from("youtube_metrics_refresh_runs")
      .select(
        "processed_submissions, success_count, permanent_failure_count, temporary_failure_count, skipped_recent_count, reviewed_count"
      )
      .eq("id", runId)
      .eq("current_batch_index", batchIndex)
      .single();

    if (runRow) {
      await supabaseAdmin
        .from("youtube_metrics_refresh_runs")
        .update({
          reviewed_count: (runRow.reviewed_count ?? 0) + reviewedInBatch,
          processed_submissions:
            (runRow.processed_submissions ?? 0) + success + tempFail + permFail,
          success_count: (runRow.success_count ?? 0) + success,
          permanent_failure_count:
            (runRow.permanent_failure_count ?? 0) + permFail,
          temporary_failure_count: (runRow.temporary_failure_count ?? 0) + tempFail,
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
      processedCount: success + tempFail + permFail,
      successCount: success,
      permanentFailureCount: permFail,
      temporaryFailureCount: tempFail,
      skippedRecentCount,
    });
  } catch (e) {
    console.error("[youtube-metrics-refresh batch]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Batch failed" },
      { status: 500 }
    );
  }
}
