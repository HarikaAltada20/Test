import type { CreatorQualityMetrics } from "@/lib/quality-score";
import { resolveCreatorQualityMetrics } from "@/lib/quality-score";
import {
  buildTrustScoreMetricsFromCounts,
  parseStoredCreatorTrustMetrics,
  type TrustScoreMetrics,
} from "@/lib/trust-score";

function parseStoredQualityNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type CreatorProfileStatsSource = {
  trust_score_metrics?: unknown;
  avg_quality_score?: unknown;
  best_quality_score?: unknown;
  quality_score_sum?: unknown;
  total_money_won?: unknown;
  total_views?: unknown;
  has_explicit_quality_scores?: unknown;
};

export type CreatorProfileStats = {
  trustMetrics: TrustScoreMetrics;
  qualityMetrics: CreatorQualityMetrics;
  totalEarningsCents: number;
  totalViews: number;
};

/** Build display stats from cached `creator_profiles` columns. */
export function getCreatorStatsFromProfile(
  profile: CreatorProfileStatsSource | null | undefined,
): CreatorProfileStats {
  const stored = parseStoredCreatorTrustMetrics(profile?.trust_score_metrics);

  const trustMetrics = buildTrustScoreMetricsFromCounts({
    total_reels: stored?.total_reels ?? 0,
    verified_reels: stored?.verified_reels ?? 0,
    rejected_reels: stored?.rejected_reels ?? 0,
    pending_reels: stored?.pending_reels ?? 0,
  });

  if (stored?.trust_score != null && Number.isFinite(stored.trust_score)) {
    trustMetrics.trust_score = stored.trust_score;
  }
  if (stored?.trust_number != null && Number.isFinite(stored.trust_number)) {
    trustMetrics.trust_number = stored.trust_number;
  }

  const qualityMetrics = resolveCreatorQualityMetrics({
    verifiedReels: trustMetrics.verified_reels,
    rejectedReels: trustMetrics.rejected_reels,
    avgQualityScore: profile?.avg_quality_score,
    bestQualityScore: profile?.best_quality_score,
    qualityScoreSum: profile?.quality_score_sum,
  });
  const profileSum = parseStoredQualityNumber(profile?.quality_score_sum);
  if (profileSum !== null) {
    qualityMetrics.quality_score_sum = profileSum;
  }

  return {
    trustMetrics,
    qualityMetrics,
    totalEarningsCents: Number(profile?.total_money_won ?? 0),
    totalViews: Number(profile?.total_views ?? 0),
  };
}

/** Trust score out of 100, e.g. "85/100". */
export function formatTrustScoreOutOf100(score: number, max = 100): string {
  const rounded = Math.round(score);
  return `${rounded}/${max}`;
}

/** Trust score as a percentage suffix, e.g. "85%". */
export function formatTrustScorePct(score: number): string {
  const rounded = Math.round(score);
  return `${rounded}%`;
}

/** Creator profile and eligibility displays. */
export function formatTrustScoreDisplay(score: number): string {
  return formatTrustScoreOutOf100(score);
}

/** Minimum trust score requirement for campaigns, e.g. "70/100". */
export function formatTrustScoreMinimum(score: number): string {
  return formatTrustScoreOutOf100(score);
}

export function formatQualityScoreDisplay(
  score: number | null | undefined,
): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return "—";
  }
  const rounded = Math.round(score * 100) / 100;
  const formatted = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted}/3`;
}

/** Total sum of explicit quality scores across verified submissions. */
export function formatQualitySumDisplay(
  sum: number | null | undefined,
): string {
  if (sum === null || sum === undefined || !Number.isFinite(sum)) {
    return "—";
  }
  return String(Math.round(sum));
}
