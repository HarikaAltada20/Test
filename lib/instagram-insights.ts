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
import { instagramGraphFetch } from "@/lib/meta-graph/instagram-graph-fetch";
import type { MetaGraphUsageAccumulator } from "@/lib/meta-graph/usage-accumulator";

const TOKEN_REFRESH_THRESHOLD_DAYS = 10;
const METRICS =
  "reach,likes,comments,shares,saved,total_interactions,views,ig_reels_avg_watch_time,ig_reels_video_view_total_time";
const DEFAULT_STATS = {
  reach: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saved: 0,
  total_interactions: 0,
  views: 0,
  avg_watch_time_ms: 0,
  total_watch_time_ms: 0,
};

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
    values: Array<{ value: number }>;
  }>;
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
 */
export async function fetchInsights(
  submission: SubmissionForInsights,
  accessToken: string,
  usageAccumulator?: MetaGraphUsageAccumulator
): Promise<FetchInsightsResult> {
  try {
    const url = `https://graph.instagram.com/${submission.video_id}/insights?metric=${METRICS}&access_token=${accessToken}`;
    const response = await instagramGraphFetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      usageAccumulator,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const code = errorBody?.error?.code ?? response.status;
      const errorSubcode = errorBody?.error?.error_subcode;
      const classification = classifyInsightsError(code, errorSubcode);
      return {
        kind: "error",
        classification,
        code,
        error_subcode: errorSubcode,
        message: errorBody?.error?.message,
      };
    }

    const data: InsightsData = await response.json();
    if (!data.data?.length) {
      return {
        kind: "error",
        classification: "temporary",
        message: "No data in response",
      };
    }

    const stats = { ...DEFAULT_STATS };
    let primaryViews = 0;
    let durationSeconds: number | undefined;

    data.data.forEach((metric) => {
      const value = metric.values[0]?.value || 0;
      if (metric.name === "ig_reels_avg_watch_time") {
        stats.avg_watch_time_ms = value;
      } else if (metric.name === "ig_reels_video_view_total_time") {
        stats.total_watch_time_ms = value;
      } else if (metric.name === "views") {
        stats.views = value;
        primaryViews = value;
      } else {
        (stats as Record<string, number>)[metric.name] = value;
      }
    });

    if (primaryViews === 0 && stats.reach > 0) {
      primaryViews = stats.reach;
    }

    // Best-effort clip length (not always available on IG Graph).
    try {
      const mediaUrl = `https://graph.instagram.com/${submission.video_id}?fields=media_type,media_product_type,video_duration&access_token=${accessToken}`;
      const mediaRes = await instagramGraphFetch(mediaUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        usageAccumulator,
      });
      if (mediaRes.ok) {
        const mediaJson = (await mediaRes.json().catch(() => ({}))) as {
          video_duration?: number | string;
        };
        const raw = mediaJson.video_duration;
        const parsed =
          typeof raw === "number"
            ? raw
            : typeof raw === "string"
              ? Number.parseFloat(raw)
              : NaN;
        if (Number.isFinite(parsed) && parsed > 0) {
          // Graph may return seconds (or occasionally ms for very large values).
          durationSeconds = parsed > 6000 ? Math.round(parsed / 1000) : Math.round(parsed);
        }
      }
    } catch {
      // optional field — ignore
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
