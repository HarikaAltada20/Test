import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshAccessToken, extractYoutubeId } from "@/lib/youtube-api";
import {
  updateYouTubeSubmissionForScope,
  fetchYouTubeBasicStatsByVideoId,
  type PrefetchedBasic,
} from "@/lib/youtube-submission-refresh-by-scope";
import {
  buildOtherStatsWithYoutube,
  getExistingYouTubeStats,
} from "@/lib/youtube-other-stats";

const SUBMISSION_PAGE_SIZE = 500;
const PROCESS_CHUNK_SIZE = 25;

type SubmissionRow = {
  id: string;
  creator_id: string;
  content_link: string;
  views: number | null;
  contest_id: string;
  other_stats: Record<string, unknown> | null;
};

type YouTubeAccountJson = Record<string, unknown>;

export type YouTubeCronBasicRefreshResult = {
  submissionCount: number;
  successCount: number;
  temporaryFailureCount: number;
  permanentFailureCount: number;
  skippedCount: number;
  updatedSubmissionIds: string[];
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

/** Paginated fetch — avoids PostgREST 1000-row default cap on nightly cron. */
export async function fetchYouTubeCronSubmissions(
  supabaseAdmin: SupabaseClient,
  options: { contestId?: string; contestIds?: string[] }
): Promise<SubmissionRow[]> {
  const all: SubmissionRow[] = [];
  for (let offset = 0; ; offset += SUBMISSION_PAGE_SIZE) {
    let query = supabaseAdmin
      .from("submissions")
      .select("id, creator_id, content_link, views, contest_id, other_stats")
      .neq("status", "rejected")
      .not("content_link", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + SUBMISSION_PAGE_SIZE - 1);

    if (options.contestId) {
      query = query.eq("contest_id", options.contestId);
    } else if (options.contestIds?.length) {
      query = query.in("contest_id", options.contestIds);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Submission fetch failed: ${error.message}`);
    const rows = (data ?? []) as SubmissionRow[];
    all.push(...rows);
    if (rows.length < SUBMISSION_PAGE_SIZE) break;
  }
  return all;
}

async function resolveCreatorToken(
  supabaseAdmin: SupabaseClient,
  creator: { id: string; youtube_account: unknown },
  now: string
): Promise<{ token: string | null; markNeedsReconnect: boolean }> {
  const account = creator.youtube_account as YouTubeAccountJson | null;
  if (!account?.access_token) {
    return { token: null, markNeedsReconnect: true };
  }

  let token = String(account.access_token);
  const expiresAt = account.expires_at as string | undefined;
  const isExpired = expiresAt && new Date(expiresAt) <= new Date();

  if (!isExpired) {
    return { token, markNeedsReconnect: false };
  }

  if (!account.refresh_token) {
    return { token: null, markNeedsReconnect: true };
  }

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
    return { token, markNeedsReconnect: false };
  } catch {
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
    return { token: null, markNeedsReconnect: true };
  }
}

async function markCreatorSubsAuthFailure(
  supabaseAdmin: SupabaseClient,
  subs: SubmissionRow[],
  now: string,
  message: string
): Promise<void> {
  await mapLimit(subs, 8, async (sub) => {
    const { data: fresh } = await supabaseAdmin
      .from("submissions")
      .select("id, creator_id, content_link, views, other_stats")
      .eq("id", sub.id)
      .maybeSingle();
    const row = (fresh ?? sub) as SubmissionRow;
    const existingYoutube = getExistingYouTubeStats(row.other_stats);
    await supabaseAdmin
      .from("submissions")
      .update({
        insights_status: "temporary_failure",
        last_insights_update: now,
        updated_at: now,
        other_stats: buildOtherStatsWithYoutube(row.other_stats, {
          ...existingYoutube,
          analytics_needs_reauth: true,
          insights_error: message,
        }),
      })
      .eq("id", sub.id);
  });
}

/**
 * Nightly / contest-scoped YouTube basic refresh — same per-submission logic as
 * manual "Refresh Basic Metrics" (updateYouTubeSubmissionForScope), with fresh
 * other_stats read before each write and paginated submission loading.
 */
export async function runYouTubeCronBasicRefresh(
  supabaseAdmin: SupabaseClient,
  submissions: SubmissionRow[]
): Promise<YouTubeCronBasicRefreshResult> {
  const now = new Date().toISOString();
  const result: YouTubeCronBasicRefreshResult = {
    submissionCount: submissions.length,
    successCount: 0,
    temporaryFailureCount: 0,
    permanentFailureCount: 0,
    skippedCount: 0,
    updatedSubmissionIds: [],
  };

  if (!submissions.length) return result;

  const withVideoId = submissions
    .map((sub) => {
      const videoId = extractYoutubeId(sub.content_link);
      return videoId ? { ...sub, video_id: videoId } : null;
    })
    .filter((s): s is SubmissionRow & { video_id: string } => !!s);

  result.skippedCount += submissions.length - withVideoId.length;

  for (let i = 0; i < withVideoId.length; i += PROCESS_CHUNK_SIZE) {
    const chunk = withVideoId.slice(i, i + PROCESS_CHUNK_SIZE);
    const creatorIds = [...new Set(chunk.map((s) => s.creator_id))];
    const byCreator = chunk.reduce<Record<string, (SubmissionRow & { video_id: string })[]>>(
      (acc, row) => {
        if (!acc[row.creator_id]) acc[row.creator_id] = [];
        acc[row.creator_id].push(row);
        return acc;
      },
      {}
    );

    const { data: creators } = await supabaseAdmin
      .from("creator_profiles")
      .select("id, youtube_account")
      .in("id", creatorIds);

    const tokenMap = new Map<string, string>();
    const skippedCreatorIds = new Set<string>();

    for (const creator of creators ?? []) {
      const subs = byCreator[creator.id] ?? [];
      const { token, markNeedsReconnect } = await resolveCreatorToken(
        supabaseAdmin,
        creator,
        now
      );
      if (!token) {
        skippedCreatorIds.add(creator.id);
        await markCreatorSubsAuthFailure(
          supabaseAdmin,
          subs,
          now,
          markNeedsReconnect ? "Token refresh failed or account disconnected" : "Missing token"
        );
        result.temporaryFailureCount += subs.length;
        continue;
      }
      tokenMap.set(creator.id, token);
    }

    const basicByCreator = new Map<string, Map<string, PrefetchedBasic>>();
    await mapLimit(Object.keys(byCreator), 4, async (creatorId) => {
      const token = tokenMap.get(creatorId);
      if (!token) return;
      const videoIds = byCreator[creatorId].map((s) => s.video_id);
      basicByCreator.set(creatorId, await fetchYouTubeBasicStatsByVideoId(token, videoIds));
    });

    const chunkResults = await mapLimit(
      chunk.filter((s) => !skippedCreatorIds.has(s.creator_id)),
      5,
      async (sub) => {
        const token = tokenMap.get(sub.creator_id);
        if (!token) {
          return {
            ok: false as const,
            id: sub.id,
            failureType: "temporary_failure" as const,
          };
        }

        const { data: fresh } = await supabaseAdmin
          .from("submissions")
          .select("id, creator_id, content_link, views, other_stats")
          .eq("id", sub.id)
          .maybeSingle();

        const row = (fresh ?? sub) as SubmissionRow;
        const prefetched = basicByCreator.get(sub.creator_id)?.get(sub.video_id) ?? null;

        const res = await updateYouTubeSubmissionForScope(
          supabaseAdmin,
          row,
          token,
          "basic",
          now,
          { prefetchedBasic: prefetched }
        );

        return {
          ok: res.ok,
          id: sub.id,
          failureType: res.failureType ?? ("temporary_failure" as const),
        };
      }
    );

    for (const r of chunkResults) {
      if (r.ok) {
        result.successCount += 1;
        result.updatedSubmissionIds.push(r.id);
      } else if (r.failureType === "permanent_failure") {
        result.permanentFailureCount += 1;
      } else {
        result.temporaryFailureCount += 1;
      }
    }
  }

  return result;
}
