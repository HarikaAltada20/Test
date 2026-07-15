/**
 * Post-campaign submission metrics: copy from submissions and refresh
 * YouTube / Instagram / TikTok into post_campaign_submission_metrics only.
 * Never writes views/other_stats back to public.submissions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";
import {
  fetchInsights,
  refreshToken,
  isTokenExpiring,
  type InstagramAccount,
  type SubmissionForInsights,
  type FetchInsightsResult,
} from "@/lib/instagram-insights";
import { extractYoutubeId, refreshAccessToken } from "@/lib/youtube-api";
import {
  fetchYouTubeBasicStatsByVideoId,
  updateYouTubeSubmissionForScope,
  type PrefetchedBasic,
} from "@/lib/youtube-submission-refresh-by-scope";
import type { YouTubeRefreshScope } from "@/lib/queue/youtube-metrics-queue";
import { TikTokProvider } from "@/lib/tiktok/provider/TikTokProvider";
import { extractTikTokVideoIdFromLink } from "@/lib/tiktok/extract-video-id";
import { ensureFreshTikTokToken } from "@/lib/tiktok/ensure-fresh-tiktok-token";
import type { PostCampaignSubmissionSnapshot } from "@/lib/post-campaign-submission-shape";
import { postCampaignSnapshotToSubmission } from "@/lib/post-campaign-submission-shape";

export type { PostCampaignSubmissionSnapshot };
export { postCampaignSnapshotToSubmission };

export const POST_CAMPAIGN_SUBMISSION_SELECT = `
  submission_id,
  contest_id,
  creator_id,
  content_link,
  views,
  metadata,
  other_stats,
  created_at,
  video_id,
  video_title,
  video_thumbnail_url,
  platform,
  last_insights_update,
  insights_status,
  status,
  earnings,
  views_locked,
  affiliate_paid,
  affiliate_metadata,
  paid,
  paid_at,
  bonus_paid,
  bonus_paid_at,
  bonus_amount,
  milestone_bonus_paid,
  dual_rewards_payout,
  quality_score,
  quality_score_backfilled,
  submission_updated_at,
  synced_at,
  updated_at
`;

export const SUBMISSION_SYNC_SELECT = `
  id,
  creator_id,
  contest_id,
  content_link,
  views,
  metadata,
  other_stats,
  created_at,
  video_id,
  video_title,
  video_thumbnail_url,
  updated_at,
  platform,
  last_insights_update,
  insights_status,
  status,
  earnings,
  views_locked,
  affiliate_paid,
  affiliate_metadata,
  paid,
  paid_at,
  bonus_paid,
  bonus_paid_at,
  bonus_amount,
  milestone_bonus_paid,
  dual_rewards_payout,
  quality_score,
  quality_score_backfilled
`;

export type PostCampaignMetricRow = PostCampaignSubmissionSnapshot;

type SubmissionSourceRow = {
  id: string;
  creator_id: string;
  contest_id: string;
  content_link: string | null;
  views: number | null;
  metadata: Record<string, unknown> | null;
  other_stats: Record<string, unknown> | null;
  created_at: string | null;
  video_id: string | null;
  video_title: string | null;
  video_thumbnail_url: string | null;
  updated_at: string | null;
  platform: string | null;
  last_insights_update: string | null;
  insights_status: string | null;
  status: string | null;
  earnings: number | null;
  views_locked: number | null;
  affiliate_paid: boolean | null;
  affiliate_metadata: Record<string, unknown> | null;
  paid: boolean | null;
  paid_at: string | null;
  bonus_paid: boolean | null;
  bonus_paid_at: string | null;
  bonus_amount: number | null;
  milestone_bonus_paid: Record<string, unknown> | null;
  dual_rewards_payout: Record<string, unknown> | null;
  quality_score: number | null;
  quality_score_backfilled: boolean | null;
};

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
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

function parseOtherStats(raw: unknown): Record<string, unknown> {
  return parseJsonObject(raw) ?? {};
}

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function mapSubmissionToPostCampaignRow(
  sub: SubmissionSourceRow,
  contestId: string,
  now: string,
): Record<string, unknown> {
  return {
    submission_id: sub.id,
    contest_id: contestId,
    creator_id: sub.creator_id,
    content_link: sub.content_link,
    views: sub.views ?? 0,
    metadata: parseJsonObject(sub.metadata),
    other_stats: parseOtherStats(sub.other_stats),
    created_at: sub.created_at,
    video_id: sub.video_id,
    video_title: sub.video_title,
    video_thumbnail_url: sub.video_thumbnail_url,
    platform: sub.platform,
    last_insights_update: sub.last_insights_update,
    insights_status: sub.insights_status,
    status: sub.status,
    earnings: sub.earnings,
    views_locked: sub.views_locked,
    affiliate_paid: sub.affiliate_paid ?? false,
    affiliate_metadata: parseJsonObject(sub.affiliate_metadata),
    paid: sub.paid ?? false,
    paid_at: sub.paid_at,
    bonus_paid: sub.bonus_paid ?? false,
    bonus_paid_at: sub.bonus_paid_at,
    bonus_amount: sub.bonus_amount ?? 0,
    milestone_bonus_paid: parseJsonObject(sub.milestone_bonus_paid),
    dual_rewards_payout: parseJsonObject(sub.dual_rewards_payout),
    quality_score: sub.quality_score,
    quality_score_backfilled: sub.quality_score_backfilled ?? false,
    submission_updated_at: sub.updated_at,
    synced_at: now,
    updated_at: now,
  };
}

/** Shape for UI: post-campaign row as a submission-like object. */
export function postCampaignRowToSubmissionShape(
  row: PostCampaignMetricRow,
): Record<string, unknown> {
  return postCampaignSnapshotToSubmission(row);
}

export async function fetchPostCampaignMetrics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestId: string,
): Promise<PostCampaignMetricRow[]> {
  const all: PostCampaignMetricRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("post_campaign_submission_metrics")
      .select(POST_CAMPAIGN_SUBMISSION_SELECT)
      .eq("contest_id", contestId)
      .order("submission_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as PostCampaignMetricRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

/** Copy full submission rows into post-campaign snapshot (upsert). */
export async function syncPostCampaignFromSubmissions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  contestId: string,
): Promise<{ synced: number }> {
  const { data: submissions, error } =
    await fetchContestSubmissionsAllPages<SubmissionSourceRow>(
      supabaseAdmin,
      contestId,
      SUBMISSION_SYNC_SELECT,
    );
  if (error) {
    throw new Error(
      typeof error === "object" && error && "message" in error
        ? String((error as { message: string }).message)
        : "Failed to load submissions for sync",
    );
  }

  const now = new Date().toISOString();
  const rows = (submissions ?? []).map((sub) =>
    mapSubmissionToPostCampaignRow(sub, contestId, now),
  );

  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error: upsertError } = await supabaseAdmin
      .from("post_campaign_submission_metrics")
      .upsert(chunk, { onConflict: "submission_id" });
    if (upsertError) throw new Error(upsertError.message);
  }

  return { synced: rows.length };
}

async function loadPostCampaignSubmissionsForRefresh(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  contestId: string,
): Promise<SubmissionSourceRow[]> {
  const metrics = await fetchPostCampaignMetrics(supabaseAdmin, contestId);
  return metrics.map((row) => ({
    id: row.submission_id,
    creator_id: row.creator_id,
    contest_id: row.contest_id,
    content_link: row.content_link,
    views: row.views,
    metadata: row.metadata,
    other_stats: row.other_stats,
    created_at: row.created_at,
    video_id: row.video_id,
    video_title: row.video_title,
    video_thumbnail_url: row.video_thumbnail_url,
    updated_at: row.submission_updated_at,
    platform: row.platform,
    last_insights_update: row.last_insights_update,
    insights_status: row.insights_status,
    status: row.status,
    earnings: row.earnings,
    views_locked: row.views_locked,
    affiliate_paid: row.affiliate_paid,
    affiliate_metadata: row.affiliate_metadata,
    paid: row.paid,
    paid_at: row.paid_at,
    bonus_paid: row.bonus_paid,
    bonus_paid_at: row.bonus_paid_at,
    bonus_amount: row.bonus_amount,
    milestone_bonus_paid: row.milestone_bonus_paid,
    dual_rewards_payout: row.dual_rewards_payout,
    quality_score: row.quality_score,
    quality_score_backfilled: row.quality_score_backfilled,
  }));
}

async function writeOverlayMetrics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  updates: Array<{
    submission_id: string;
    views: number;
    other_stats: Record<string, unknown>;
    last_insights_update: string;
    insights_status: string;
  }>,
): Promise<void> {
  const now = new Date().toISOString();
  await mapLimit(updates, 10, async (up) => {
    const { error } = await supabaseAdmin
      .from("post_campaign_submission_metrics")
      .update({
        views: up.views,
        other_stats: up.other_stats,
        last_insights_update: up.last_insights_update,
        insights_status: up.insights_status,
        updated_at: now,
      })
      .eq("submission_id", up.submission_id);
    if (error) {
      throw new Error(error.message);
    }
  });
}

async function refreshInstagramPostCampaign(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  contestId: string,
  submissions: SubmissionSourceRow[],
): Promise<{ success: number; failed: number }> {
  const eligible = submissions.filter(
    (s) => s.status !== "rejected" && s.video_id,
  );
  const byCreator = new Map<string, SubmissionSourceRow[]>();
  for (const sub of eligible) {
    const list = byCreator.get(sub.creator_id) ?? [];
    list.push(sub);
    byCreator.set(sub.creator_id, list);
  }

  const creatorIds = [...byCreator.keys()];
  const { data: creators } = await supabaseAdmin
    .from("creator_profiles")
    .select("id, instagram_account")
    .in("id", creatorIds);
  const creatorsById = new Map(
    (creators ?? []).map((c: { id: string; instagram_account: unknown }) => [
      c.id,
      c,
    ]),
  );

  const now = new Date().toISOString();
  const updates: Array<{
    submission_id: string;
    views: number;
    other_stats: Record<string, unknown>;
    last_insights_update: string;
    insights_status: string;
  }> = [];
  let success = 0;
  let failed = 0;

  await mapLimit(creatorIds, 3, async (creatorId) => {
    const creator = creatorsById.get(creatorId) as
      | { id: string; instagram_account: InstagramAccount | null }
      | undefined;
    const subs = byCreator.get(creatorId) ?? [];
    const account = creator?.instagram_account;
    if (
      !account?.access_token ||
      (account.account_type !== "BUSINESS" &&
        account.account_type !== "MEDIA_CREATOR")
    ) {
      for (const sub of subs) {
        failed += 1;
        updates.push({
          submission_id: sub.id,
          views: sub.views ?? 0,
          other_stats: parseOtherStats(sub.other_stats),
          last_insights_update: now,
          insights_status: "temporary_failure",
        });
      }
      return;
    }

    let accessToken = account.access_token;
    if (account.token_expiry && isTokenExpiring(account.token_expiry)) {
      const refreshResult = await refreshToken(creatorId, accessToken);
      if (!refreshResult) {
        for (const sub of subs) {
          failed += 1;
          updates.push({
            submission_id: sub.id,
            views: sub.views ?? 0,
            other_stats: parseOtherStats(sub.other_stats),
            last_insights_update: now,
            insights_status: "temporary_failure",
          });
        }
        return;
      }
      accessToken = refreshResult.access_token;
      const expirySeconds = refreshResult.expires_in ?? 3600;
      await supabaseAdmin
        .from("creator_profiles")
        .update({
          instagram_account: {
            ...account,
            access_token: refreshResult.access_token,
            token_expiry: dayjs().add(expirySeconds, "second").toISOString(),
            last_connection_check_at: now,
            needs_reconnect: false,
          },
          updated_at: now,
        })
        .eq("id", creatorId);
    }

    await mapLimit(subs, 4, async (sub) => {
      const submission: SubmissionForInsights = {
        id: sub.id,
        creator_id: sub.creator_id,
        video_id: sub.video_id!,
        views: sub.views,
        other_stats: parseOtherStats(sub.other_stats),
      };
      const result: FetchInsightsResult = await fetchInsights(
        submission,
        accessToken,
      );
      if (result.kind === "success") {
        success += 1;
        updates.push({
          submission_id: sub.id,
          views: result.views,
          other_stats: {
            ...parseOtherStats(sub.other_stats),
            instagram: result.stats,
          },
          last_insights_update: now,
          insights_status: "ok",
        });
      } else {
        failed += 1;
        updates.push({
          submission_id: sub.id,
          views: sub.views ?? 0,
          other_stats: parseOtherStats(sub.other_stats),
          last_insights_update: now,
          insights_status:
            result.classification === "permanent_media"
              ? "permanent_failure"
              : "temporary_failure",
        });
      }
    });
  });

  await writeOverlayMetrics(supabaseAdmin, updates);
  return { success, failed };
}

async function refreshYouTubePostCampaign(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  contestId: string,
  submissions: SubmissionSourceRow[],
  scope: YouTubeRefreshScope = "basic",
): Promise<{ success: number; failed: number }> {
  const eligible = submissions.filter(
    (s) => s.status !== "rejected" && s.content_link,
  );
  const byCreator = new Map<string, SubmissionSourceRow[]>();
  for (const sub of eligible) {
    const list = byCreator.get(sub.creator_id) ?? [];
    list.push(sub);
    byCreator.set(sub.creator_id, list);
  }

  const creatorIds = [...byCreator.keys()];
  if (creatorIds.length === 0) return { success: 0, failed: 0 };

  const { data: creators } = await supabaseAdmin
    .from("creator_profiles")
    .select("id, youtube_account")
    .in("id", creatorIds);
  const creatorsById = new Map(
    (creators ?? []).map((c: { id: string; youtube_account: unknown }) => [
      c.id,
      c,
    ]),
  );

  const now = new Date().toISOString();
  let success = 0;
  let failed = 0;
  const needsBasicPrefetch =
    scope === "basic" || scope === "all" || scope === "all_standard";

  await mapLimit(creatorIds, 2, async (creatorId) => {
    const creator = creatorsById.get(creatorId) as
      | {
          id: string;
          youtube_account: Record<string, unknown> | null;
        }
      | undefined;
    const subs = byCreator.get(creatorId) ?? [];
    const account = creator?.youtube_account;
    if (!account?.access_token) {
      failed += subs.length;
      await writeOverlayMetrics(
        supabaseAdmin,
        subs.map((sub) => ({
          submission_id: sub.id,
          views: sub.views ?? 0,
          other_stats: parseOtherStats(sub.other_stats),
          last_insights_update: now,
          insights_status: "temporary_failure",
        })),
      );
      return;
    }

    let token = String(account.access_token);
    const expiresAt = account.expires_at as string | undefined;
    const isExpired = expiresAt && new Date(expiresAt) <= new Date();
    if (isExpired) {
      if (!account.refresh_token) {
        failed += subs.length;
        await writeOverlayMetrics(
          supabaseAdmin,
          subs.map((sub) => ({
            submission_id: sub.id,
            views: sub.views ?? 0,
            other_stats: parseOtherStats(sub.other_stats),
            last_insights_update: now,
            insights_status: "temporary_failure",
          })),
        );
        return;
      }
      try {
        const newTokens = await refreshAccessToken(
          String(account.refresh_token),
        );
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
          .eq("id", creatorId);
      } catch {
        failed += subs.length;
        await writeOverlayMetrics(
          supabaseAdmin,
          subs.map((sub) => ({
            submission_id: sub.id,
            views: sub.views ?? 0,
            other_stats: parseOtherStats(sub.other_stats),
            last_insights_update: now,
            insights_status: "temporary_failure",
          })),
        );
        return;
      }
    }

    let statsMap = new Map<string, PrefetchedBasic>();
    if (needsBasicPrefetch) {
      const videoIds = subs
        .map(
          (sub) =>
            (sub.video_id && String(sub.video_id)) ||
            extractYoutubeId(sub.content_link || "") ||
            "",
        )
        .filter(Boolean);
      try {
        statsMap = await fetchYouTubeBasicStatsByVideoId(token, videoIds);
      } catch {
        // continue; per-submission update will fall back / fail gracefully
      }
    }

    await mapLimit(subs, 3, async (sub) => {
      const vid =
        (sub.video_id && String(sub.video_id)) ||
        extractYoutubeId(sub.content_link || "") ||
        null;
      const prefetched = vid ? statsMap.get(vid) : null;
      const result = await updateYouTubeSubmissionForScope(
        supabaseAdmin,
        {
          id: sub.id,
          creator_id: sub.creator_id,
          content_link: sub.content_link || "",
          views: sub.views,
          other_stats: parseOtherStats(sub.other_stats),
        },
        token,
        scope,
        now,
        {
          prefetchedBasic: prefetched ?? null,
          metricsTarget: "post_campaign_submission_metrics",
        },
      );
      if (result.ok) success += 1;
      else failed += 1;
    });
  });

  return { success, failed };
}

async function refreshTikTokPostCampaign(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  contestId: string,
  submissions: SubmissionSourceRow[],
): Promise<{ success: number; failed: number }> {
  const eligible = submissions.filter(
    (s) => s.status !== "rejected" && s.content_link,
  );
  const byCreator = new Map<string, SubmissionSourceRow[]>();
  for (const sub of eligible) {
    const list = byCreator.get(sub.creator_id) ?? [];
    list.push(sub);
    byCreator.set(sub.creator_id, list);
  }

  const now = new Date().toISOString();
  const updates: Array<{
    submission_id: string;
    views: number;
    other_stats: Record<string, unknown>;
    last_insights_update: string;
    insights_status: string;
  }> = [];
  let success = 0;
  let failed = 0;
  const provider = new TikTokProvider();
  const QUERY_CHUNK = 20;

  await mapLimit([...byCreator.keys()], 3, async (creatorId) => {
    const subs = byCreator.get(creatorId) ?? [];
    const tokenResult = await ensureFreshTikTokToken(supabaseAdmin, creatorId);
    if (!tokenResult.ok) {
      for (const sub of subs) {
        failed += 1;
        updates.push({
          submission_id: sub.id,
          views: sub.views ?? 0,
          other_stats: parseOtherStats(sub.other_stats),
          last_insights_update: now,
          insights_status: "temporary_failure",
        });
      }
      return;
    }

    const rows: { sub: SubmissionSourceRow; videoId: string }[] = [];
    for (const sub of subs) {
      const vid =
        (sub.video_id && String(sub.video_id)) ||
        extractTikTokVideoIdFromLink(sub.content_link);
      if (!vid) {
        failed += 1;
        updates.push({
          submission_id: sub.id,
          views: sub.views ?? 0,
          other_stats: {
            ...parseOtherStats(sub.other_stats),
            tiktok_error:
              "Could not extract Video ID from link. Please use a standard TikTok video URL.",
          },
          last_insights_update: now,
          insights_status: "permanent_failure",
        });
        continue;
      }
      rows.push({ sub, videoId: vid });
    }

    const uniqueIds = [...new Set(rows.map((r) => r.videoId))];
    const videoById = new Map<
      string,
      {
        viewCount: number;
        likeCount: number;
        commentCount: number;
        shareCount: number;
      }
    >();

    try {
      for (let i = 0; i < uniqueIds.length; i += QUERY_CHUNK) {
        const chunk = uniqueIds.slice(i, i + QUERY_CHUNK);
        const metrics = await provider.getVideoMetrics(
          tokenResult.accessToken,
          chunk,
        );
        for (const m of metrics) {
          videoById.set(m.videoId, {
            viewCount: m.viewCount,
            likeCount: m.likeCount,
            commentCount: m.commentCount,
            shareCount: m.shareCount,
          });
        }
      }
    } catch {
      for (const { sub } of rows) {
        failed += 1;
        updates.push({
          submission_id: sub.id,
          views: sub.views ?? 0,
          other_stats: parseOtherStats(sub.other_stats),
          last_insights_update: now,
          insights_status: "temporary_failure",
        });
      }
      return;
    }

    for (const { sub, videoId } of rows) {
      const m = videoById.get(videoId);
      if (!m) {
        failed += 1;
        updates.push({
          submission_id: sub.id,
          views: sub.views ?? 0,
          other_stats: {
            ...parseOtherStats(sub.other_stats),
            tiktok_error:
              "Video not found or is private. Ensure video is set to Public.",
          },
          last_insights_update: now,
          insights_status: "permanent_failure",
        });
        continue;
      }
      success += 1;
      updates.push({
        submission_id: sub.id,
        views: m.viewCount,
        other_stats: {
          ...parseOtherStats(sub.other_stats),
          tiktok: {
            view_count: m.viewCount,
            like_count: m.likeCount,
            comment_count: m.commentCount,
            share_count: m.shareCount,
            last_updated: now,
          },
          tiktok_error: null,
        },
        last_insights_update: now,
        insights_status: "ok",
      });
    }
  });

  await writeOverlayMetrics(supabaseAdmin, updates);
  return { success, failed };
}

export type PostCampaignRefreshResult = {
  synced: number;
  success: number;
  failed: number;
  platform: string;
  post_campaign_last_metrics_updated: string;
};

export type PostCampaignRefreshOptions = {
  /** YouTube analytics scope; ignored for Instagram/TikTok. */
  scope?: YouTubeRefreshScope;
  /**
   * When true (default), copy submissions into overlay if empty.
   * When false, only refresh existing overlay rows (do not overwrite with locked submissions).
   */
  syncIfEmpty?: boolean;
};

/**
 * Refresh live metrics into post_campaign_submission_metrics only
 * (submissions table untouched).
 */
export async function refreshPostCampaignMetrics(
  supabaseAdmin: SupabaseClient,
  contestId: string,
  platform: string | null | undefined,
  options?: PostCampaignRefreshOptions,
): Promise<PostCampaignRefreshResult> {
  const scope = options?.scope ?? "basic";
  const syncIfEmpty = options?.syncIfEmpty !== false;

  let existing = await loadPostCampaignSubmissionsForRefresh(
    supabaseAdmin,
    contestId,
  );
  let synced = existing.length;

  if (existing.length === 0 && syncIfEmpty) {
    const result = await syncPostCampaignFromSubmissions(
      supabaseAdmin,
      contestId,
    );
    synced = result.synced;
    existing = await loadPostCampaignSubmissionsForRefresh(
      supabaseAdmin,
      contestId,
    );
  }

  if (existing.length === 0) {
    throw new Error(
      "No post-campaign submissions to refresh. Click Refresh first to copy contest submissions.",
    );
  }

  const platformKey = (platform ?? "").toLowerCase();
  let success = 0;
  let failed = 0;

  if (platformKey.includes("instagram")) {
    const r = await refreshInstagramPostCampaign(
      supabaseAdmin,
      contestId,
      existing,
    );
    success = r.success;
    failed = r.failed;
  } else if (platformKey.includes("youtube")) {
    const r = await refreshYouTubePostCampaign(
      supabaseAdmin,
      contestId,
      existing,
      scope,
    );
    success = r.success;
    failed = r.failed;
  } else if (platformKey.includes("tiktok")) {
    const r = await refreshTikTokPostCampaign(
      supabaseAdmin,
      contestId,
      existing,
    );
    success = r.success;
    failed = r.failed;
  } else {
    throw new Error(
      `Post-campaign metrics refresh not supported for platform: ${platform}`,
    );
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("contests")
    .update({ post_campaign_last_metrics_updated: now })
    .eq("id", contestId);

  return {
    synced,
    success,
    failed,
    platform: platformKey,
    post_campaign_last_metrics_updated: now,
  };
}
