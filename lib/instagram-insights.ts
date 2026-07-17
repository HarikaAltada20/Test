/**
 * Shared Instagram insights helpers: token refresh, fetch insights (with error classification),
 * hasStatsChanged, updateCpmContestBudgets. Used by cron and by the batch worker.
 */

import dayjs from "dayjs";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";
import {
  isContestEligibleForScheduledMetricsRefresh,
  SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER,
} from "@/lib/contest-metrics-refresh-eligibility";

type CpmBudgetSubmissionRow = {
  creator_id: string;
  views?: number | null;
  paid?: boolean | null;
  bonus_paid?: boolean | null;
  earnings?: number | null;
  bonus_amount?: number | null;
};
import {
  coreInsightsMetricsForMediaProductType,
  IG_BASE_INSIGHTS_METRICS,
  IG_GRAPH_VERSION,
  IG_OPTIONAL_FEED_METRICS,
  IG_OPTIONAL_REELS_METRICS,
  insightsMetricsForMediaProductType,
  shouldRetryInsightsWithoutOptionalMetrics,
} from "@/lib/instagram-clip-metrics";
import { fetchMp4DurationSeconds } from "@/lib/mp4-duration-from-url";
import { instagramGraphFetch } from "@/lib/meta-graph/instagram-graph-fetch";
import type { MetaGraphUsageAccumulator } from "@/lib/meta-graph/usage-accumulator";

const TOKEN_REFRESH_THRESHOLD_DAYS = 10;

/**
 * Do NOT seed insight fields with 0.
 * Partial Graph responses (or follow-up optional-metric calls) omit many fields;
 * seeding defaults would overwrite previously stored real values on merge.
 */

export interface InstagramAccount {
  access_token: string;
  token_expiry: string;
  app_scoped_user_id: string;
  account_type?: "BUSINESS" | "MEDIA_CREATOR" | "PERSONAL";
  needs_reconnect?: boolean;
  last_connection_check_at?: string;
}

export interface SubmissionForInsights {
  id: string;
  creator_id: string;
  video_id: string;
  views: number | null;
  other_stats?: Record<string, unknown> | null;
}

interface InsightsData {
  data: Array<{
    name: string;
    values?: Array<{ value?: number | null }>;
    total_value?: { value?: number | null };
  }>;
}

/** Read a metric value from either values[] or total_value (Graph varies by metric). */
function readInsightMetricValue(metric: {
  values?: Array<{ value?: number | string | null }>;
  total_value?: { value?: number | string | null };
}): number | null {
  const candidates = [metric.values?.[0]?.value, metric.total_value?.value];
  for (const candidate of candidates) {
    if (candidate == null || candidate === "") continue;
    const n = typeof candidate === "number" ? candidate : Number(candidate);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export type FetchInsightsSuccess = {
  kind: "success";
  views: number;
  stats: Record<string, number>;
};

export type FetchInsightsError = {
  kind: "error";
  classification: "permanent_media" | "account_token" | "temporary";
  code?: number;
  error_subcode?: number;
  message?: string;
};

export type FetchInsightsResult = FetchInsightsSuccess | FetchInsightsError;

/** Token is expiring within threshold days. */
export function isTokenExpiring(tokenExpiry: string): boolean {
  return dayjs(tokenExpiry).isBefore(
    dayjs().add(TOKEN_REFRESH_THRESHOLD_DAYS, "day")
  );
}

export function hasStatsChanged(
  oldViews: number | null,
  newViews: number,
  oldStats: unknown,
  newStats: Record<string, number>
): boolean {
  if (oldViews !== newViews) return true;
  const oldInstagram =
    oldStats && typeof oldStats === "object" && "instagram" in oldStats
      ? (oldStats as { instagram?: Record<string, number> }).instagram
      : undefined;
  if (!oldInstagram) return Object.keys(newStats).length > 0;
  return Object.keys(newStats).some(
    (key) => oldInstagram[key] !== newStats[key]
  );
}

/** Preserve prior value when a follow-up Graph call omits the key entirely. */
const PRESERVE_IF_OMITTED_KEYS = [
  "likes",
  "comments",
  "shares",
  "saved",
  "reach",
  "total_interactions",
  "views",
  "reposts",
  "reels_skip_rate",
  "duration_seconds",
] as const;

/**
 * Watch-time: Graph sometimes returns 0/omits these while other Reel metrics
 * succeed — never wipe a prior positive value with 0/missing.
 */
const PRESERVE_IF_OMITTED_OR_ZERO_KEYS = [
  "avg_watch_time_ms",
  "total_watch_time_ms",
] as const;

/**
 * Merge new IG stats onto previous.
 * - Keys omitted from newStats keep previous values
 * - Watch-time 0/missing does not wipe a prior positive value
 * - Explicit Graph values (including real 0 for likes/reposts) are kept
 */
export function mergeInstagramStats(
  prevIg: Record<string, unknown>,
  newStats: Record<string, number>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...prevIg, ...newStats };

  for (const key of PRESERVE_IF_OMITTED_KEYS) {
    const nextMissing = !Object.prototype.hasOwnProperty.call(newStats, key);
    if (!nextMissing) continue;
    if (Object.prototype.hasOwnProperty.call(prevIg, key)) {
      merged[key] = prevIg[key];
    }
  }

  for (const key of PRESERVE_IF_OMITTED_OR_ZERO_KEYS) {
    const prev = Number(prevIg[key]);
    const nextMissing = !Object.prototype.hasOwnProperty.call(newStats, key);
    const next = Number(newStats[key]);
    if (
      Number.isFinite(prev) &&
      prev > 0 &&
      (nextMissing || !Number.isFinite(next) || next <= 0)
    ) {
      merged[key] = prev;
    }
  }

  return merged;
}

/** Refresh Instagram access token. Returns { access_token, expires_in? } or null. */
export async function refreshToken(
  creatorId: string,
  accessToken: string,
  usageAccumulator?: MetaGraphUsageAccumulator
): Promise<{ access_token: string; expires_in?: number } | null> {
  try {
    const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;
    const response = await instagramGraphFetch(refreshUrl, {
      usageAccumulator,
    });
    const data = await response.json();

    if (!response.ok || data.error) {
      console.error(
        `[instagram-insights] Token refresh failed for creator ${creatorId}:`,
        data.error
      );
      return null;
    }
    return {
      access_token: data.access_token,
      expires_in: typeof data.expires_in === "number" ? data.expires_in : undefined,
    };
  } catch (error: unknown) {
    console.error(
      `[instagram-insights] Token refresh exception for creator ${creatorId}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Classify Graph API error for insights: permanent_media (100/33), account_token (190), else temporary.
 */
export function classifyInsightsError(
  code?: number,
  errorSubcode?: number
): "permanent_media" | "account_token" | "temporary" {
  if (code === 100 && errorSubcode === 33) return "permanent_media";
  if (code === 190) return "account_token";
  return "temporary";
}

/**
 * Fetch insights for one submission. Returns success with views/stats or error with classification.
 * - Resolves media_product_type first so Reel-only metrics are not requested on FEED/IMAGE.
 * - Duration is NOT from Graph `video_duration` (unsupported); use cached value or MP4 via media_url.
 */
export async function fetchInsights(
  submission: SubmissionForInsights,
  accessToken: string,
  usageAccumulator?: MetaGraphUsageAccumulator
): Promise<FetchInsightsResult> {
  try {
    const graphHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    };

    // 1) Resolve media topology (safe fields only — never request video_duration).
    // Also pull public engagement counts from the media object when available.
    // Insights `reposts` can lag or stay 0 while media `reposts_count` matches
    // the in-app profile-repost total Meta documents for IG Media.
    let mediaProductType: string | null = null;
    let cdnMediaUrl: string | null = null;
    let mediaRepostsCount: number | null = null;
    let mediaLikesCount: number | null = null;
    let mediaCommentsCount: number | null = null;
    let mediaSharesCount: number | null = null;
    try {
      const mediaFieldsFull =
        "media_type,media_product_type,media_url,reposts_count,like_count,comments_count,shares_count";
      const mediaFieldsBasic = "media_type,media_product_type,media_url";
      const mediaUrl = (fields: string) =>
        `https://graph.instagram.com/${IG_GRAPH_VERSION}/${submission.video_id}?fields=${fields}&access_token=${accessToken}`;

      let mediaRes = await instagramGraphFetch(mediaUrl(mediaFieldsFull), {
        headers: graphHeaders,
        usageAccumulator,
      });
      if (!mediaRes.ok) {
        mediaRes = await instagramGraphFetch(mediaUrl(mediaFieldsBasic), {
          headers: graphHeaders,
          usageAccumulator,
        });
      }
      if (mediaRes.ok) {
        const mediaJson = (await mediaRes.json().catch(() => ({}))) as {
          media_product_type?: string;
          media_type?: string;
          media_url?: string;
          reposts_count?: number | string | null;
          like_count?: number | string | null;
          comments_count?: number | string | null;
          shares_count?: number | string | null;
        };
        mediaProductType =
          mediaJson.media_product_type ??
          (mediaJson.media_type === "VIDEO" ? "REELS" : null);
        if (typeof mediaJson.media_url === "string" && mediaJson.media_url) {
          cdnMediaUrl = mediaJson.media_url;
        }
        const asFinite = (v: unknown): number | null => {
          if (v == null || v === "") return null;
          const n = typeof v === "number" ? v : Number(v);
          return Number.isFinite(n) ? n : null;
        };
        mediaRepostsCount = asFinite(mediaJson.reposts_count);
        mediaLikesCount = asFinite(mediaJson.like_count);
        mediaCommentsCount = asFinite(mediaJson.comments_count);
        mediaSharesCount = asFinite(mediaJson.shares_count);
      }
    } catch {
      // continue with feed-safe metrics
    }

    const primaryMetrics = insightsMetricsForMediaProductType(mediaProductType);
    const fallbackMetrics =
      coreInsightsMetricsForMediaProductType(mediaProductType);

    const fetchWithMetrics = async (metricList: string) => {
      const url = `https://graph.instagram.com/${IG_GRAPH_VERSION}/${submission.video_id}/insights?metric=${metricList}&access_token=${accessToken}`;
      return instagramGraphFetch(url, {
        headers: graphHeaders,
        usageAccumulator,
      });
    };

    const applyInsightMetrics = (
      metricsData: InsightsData,
      stats: Record<string, number>,
    ): number => {
      let primaryViews = 0;
      for (const metric of metricsData.data || []) {
        const raw = readInsightMetricValue(metric);
        // Only write keys Graph actually returned — never invent 0s.
        if (raw == null) continue;

        if (metric.name === "ig_reels_avg_watch_time") {
          stats.avg_watch_time_ms = raw;
        } else if (metric.name === "ig_reels_video_view_total_time") {
          stats.total_watch_time_ms = raw;
        } else if (metric.name === "views") {
          stats.views = raw;
          primaryViews = raw;
        } else {
          stats[metric.name] = raw;
        }
      }
      return primaryViews;
    };

    let response = await fetchWithMetrics(primaryMetrics);
    let errorBody: {
      error?: { code?: number; error_subcode?: number; message?: string };
    } = {};
    let usedFallback = false;

    if (!response.ok) {
      errorBody = await response.json().catch(() => ({}));
      const code = errorBody?.error?.code ?? response.status;
      const errorSubcode = errorBody?.error?.error_subcode;
      const classification = classifyInsightsError(code, errorSubcode);
      if (
        shouldRetryInsightsWithoutOptionalMetrics({
          code,
          error_subcode: errorSubcode,
          message: errorBody?.error?.message,
        })
      ) {
        let retry = await fetchWithMetrics(fallbackMetrics);
        if (!retry.ok && fallbackMetrics !== IG_BASE_INSIGHTS_METRICS) {
          retry = await fetchWithMetrics(IG_BASE_INSIGHTS_METRICS);
        }
        if (retry.ok) {
          response = retry;
          errorBody = {};
          usedFallback = true;
        } else {
          return {
            kind: "error",
            classification,
            code,
            error_subcode: errorSubcode,
            message: errorBody?.error?.message,
          };
        }
      } else {
        return {
          kind: "error",
          classification,
          code,
          error_subcode: errorSubcode,
          message: errorBody?.error?.message,
        };
      }
    }

    const data: InsightsData = await response.json();
    if (!data.data?.length) {
      return {
        kind: "error",
        classification: "temporary",
        message: "No data in response",
      };
    }

    const stats: Record<string, number> = {};
    let primaryViews = applyInsightMetrics(data, stats);

    // If skip/reposts were dropped (fallback) or omitted by Graph, fetch them alone.
    const isReels = String(mediaProductType || "").toUpperCase() === "REELS";
    const missingReposts = !Object.prototype.hasOwnProperty.call(
      stats,
      "reposts",
    );
    const missingSkip =
      isReels &&
      !Object.prototype.hasOwnProperty.call(stats, "reels_skip_rate");
    if (missingReposts || missingSkip || usedFallback) {
      const optionalMetrics = isReels
        ? IG_OPTIONAL_REELS_METRICS
        : IG_OPTIONAL_FEED_METRICS;
      try {
        const optionalRes = await fetchWithMetrics(optionalMetrics);
        if (optionalRes.ok) {
          const optionalData = (await optionalRes
            .json()
            .catch(() => null)) as InsightsData | null;
          if (optionalData?.data?.length) {
            applyInsightMetrics(optionalData, stats);
          }
        } else if (isReels) {
          // One bad optional metric shouldn't block the other.
          const skipOnly = await fetchWithMetrics("reels_skip_rate");
          if (skipOnly.ok) {
            const skipData = (await skipOnly
              .json()
              .catch(() => null)) as InsightsData | null;
            if (skipData?.data?.length) applyInsightMetrics(skipData, stats);
          }
          const repostsOnly = await fetchWithMetrics("reposts");
          if (repostsOnly.ok) {
            const repostsData = (await repostsOnly
              .json()
              .catch(() => null)) as InsightsData | null;
            if (repostsData?.data?.length) {
              applyInsightMetrics(repostsData, stats);
            }
          }
        }
      } catch {
        // optional — ignore
      }
    }

    // If the main response omitted Reel watch-time metrics (or returned 0 while
    // other Reel metrics like skip rate succeeded), fetch watch time alone.
    const avgWatch = Number(stats.avg_watch_time_ms);
    const totalWatch = Number(stats.total_watch_time_ms);
    const needsWatchBackfill =
      isReels &&
      (!Object.prototype.hasOwnProperty.call(stats, "avg_watch_time_ms") ||
        !Object.prototype.hasOwnProperty.call(stats, "total_watch_time_ms") ||
        !Number.isFinite(avgWatch) ||
        avgWatch <= 0 ||
        !Number.isFinite(totalWatch) ||
        totalWatch <= 0);
    if (needsWatchBackfill) {
      try {
        const watchRes = await fetchWithMetrics(
          "ig_reels_avg_watch_time,ig_reels_video_view_total_time",
        );
        if (watchRes.ok) {
          const watchData = (await watchRes
            .json()
            .catch(() => null)) as InsightsData | null;
          if (watchData?.data?.length) applyInsightMetrics(watchData, stats);
        }
      } catch {
        // optional — ignore
      }
    }

    if (primaryViews === 0 && stats.reach > 0) {
      primaryViews = stats.reach;
    }

    // Prefer the higher of Insights vs media-object counts. Insights can return
    // 0/omit while the media object still has the public engagement total.
    const preferHigherMediaCount = (
      key: string,
      mediaCount: number | null,
    ) => {
      if (mediaCount == null || !Number.isFinite(mediaCount) || mediaCount < 0) {
        return;
      }
      const insightVal = Object.prototype.hasOwnProperty.call(stats, key)
        ? Number(stats[key])
        : null;
      if (
        insightVal == null ||
        !Number.isFinite(insightVal) ||
        mediaCount > insightVal
      ) {
        stats[key] = mediaCount;
      }
    };
    preferHigherMediaCount("reposts", mediaRepostsCount);
    preferHigherMediaCount("likes", mediaLikesCount);
    preferHigherMediaCount("comments", mediaCommentsCount);
    preferHigherMediaCount("shares", mediaSharesCount);

    const prevIg =
      submission.other_stats &&
      typeof submission.other_stats === "object" &&
      submission.other_stats.instagram &&
      typeof submission.other_stats.instagram === "object" &&
      !Array.isArray(submission.other_stats.instagram)
        ? (submission.other_stats.instagram as Record<string, unknown>)
        : {};
    const existingDuration = Number(prevIg.duration_seconds);
    let durationSeconds: number | undefined =
      Number.isFinite(existingDuration) && existingDuration > 0
        ? existingDuration
        : undefined;

    // Official Graph has no video_duration — parse MP4 from media_url when missing.
    if (durationSeconds == null && cdnMediaUrl) {
      const parsed = await fetchMp4DurationSeconds(cdnMediaUrl);
      if (parsed != null) durationSeconds = parsed;
    }

    return {
      kind: "success",
      views: primaryViews,
      stats: {
        ...stats,
        ...(durationSeconds != null ? { duration_seconds: durationSeconds } : {}),
      },
    };
  } catch (error: unknown) {
    console.error(
      `[instagram-insights] Fetch exception for submission ${submission.id}:`,
      error instanceof Error ? error.message : error
    );
    return {
      kind: "error",
      classification: "temporary",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Update CPM contest budgets (same logic as existing cron). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateCpmContestBudgets(supabaseAdmin: any, contestId?: string): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("contests")
      .select("id, contest_based_details, views_locked_at, post_contest_status")
      .eq("contest_type", "cpm")
      .not("contest_based_details", "is", null)
      .is("views_locked_at", null)
      .or(SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER);
    if (contestId) query = query.eq("id", contestId);
    const { data: contests, error } = await query;
    if (error || !contests?.length) return;

    const eligibleContests = contests.filter(
      isContestEligibleForScheduledMetricsRefresh,
    );
    if (!eligibleContests.length) return;

    for (const contest of eligibleContests) {
      const cpmConfig = contest.contest_based_details?.cpm_contest;
      if (!cpmConfig?.cpm_rate_usd) continue;
      const { data: contestDetails } = await supabaseAdmin
        .from("contests")
        .select("max_earnings_per_creator")
        .eq("id", contest.id)
        .single();
      const maxEarningsPerCreator = contestDetails?.max_earnings_per_creator ?? null;
      const { data: submissions, error: submissionsError } =
        await fetchContestSubmissionsAllPages<CpmBudgetSubmissionRow>(
        supabaseAdmin,
        contest.id,
        "views, creator_id, created_at, paid, bonus_paid, earnings, bonus_amount",
        {
          statusIn: ["verified", "paid"],
          order: { column: "created_at", ascending: true },
        },
      );
      if (submissionsError) {
        console.error(
          "[instagram-insights] Failed to load submissions for CPM budget:",
          contest.id,
          submissionsError,
        );
        continue;
      }
      if (!submissions?.length) continue;

      const creatorEarnings = new Map<string, { cpmTotal: number; bonusTotal: number }>();
      const flatFeeBonus = cpmConfig.flat_fee_bonus || 0;
      const flatFeeBonusCap = cpmConfig.flat_fee_bonus_cap ?? null;
      let totalBonusSpentSoFar = 0;
      const capInDollars = flatFeeBonusCap ? flatFeeBonusCap / 100 : null;

      for (const sub of submissions) {
        const creatorId = sub.creator_id;
        if (!creatorEarnings.has(creatorId)) creatorEarnings.set(creatorId, { cpmTotal: 0, bonusTotal: 0 });
        const creatorData = creatorEarnings.get(creatorId)!;
        const earnings = Number(sub.earnings);
        const bonusAmount = Number(sub.bonus_amount);
        if (sub.paid && sub.earnings != null) {
          creatorData.cpmTotal += earnings / 100;
        } else {
          let views = Number(sub.views) || 0;
          if (cpmConfig.min_views && views < cpmConfig.min_views) views = 0;
          if (cpmConfig.max_views && views > cpmConfig.max_views) views = cpmConfig.max_views;
          const submissionEarnings = (views * cpmConfig.cpm_rate_usd) / 1000;
          if (maxEarningsPerCreator) {
            const remainingCap = maxEarningsPerCreator / 100 - creatorData.cpmTotal;
            if (remainingCap > 0) creatorData.cpmTotal += Math.min(submissionEarnings, remainingCap);
          } else {
            creatorData.cpmTotal += submissionEarnings;
          }
        }
        if (sub.bonus_paid && sub.bonus_amount != null) {
          creatorData.bonusTotal += bonusAmount / 100;
          totalBonusSpentSoFar += bonusAmount / 100;
        } else if (flatFeeBonus > 0) {
          const bonusAmount = flatFeeBonus / 100;
          if (capInDollars === null || totalBonusSpentSoFar + bonusAmount <= capInDollars) {
            creatorData.bonusTotal += bonusAmount;
            totalBonusSpentSoFar += bonusAmount;
          }
        }
      }
      let totalCPM = 0, totalBonus = 0;
      for (const [, e] of creatorEarnings) {
        totalCPM += e.cpmTotal;
        totalBonus += e.bonusTotal;
      }
      const totalSpent = totalCPM + totalBonus;
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("contests")
        .update({
          contest_based_details: {
            ...contest.contest_based_details,
            cpm_contest: { ...cpmConfig, budget_spent: Math.round(totalSpent * 100) },
          },
          last_metrics_updated: now,
          updated_at: now,
        })
        .eq("id", contest.id);
    }
  } catch (error: unknown) {
    console.error("[instagram-insights] CPM budget update failed:", error instanceof Error ? error.message : error);
  }
}
