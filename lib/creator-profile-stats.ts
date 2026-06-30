import type { CreatorQualityMetrics } from "@/lib/quality-score";
import { resolveCreatorQualityMetrics } from "@/lib/quality-score";
import {
  buildTrustScoreMetricsFromCounts,
  parseStoredCreatorTrustMetrics,
  type TrustScoreMetrics,
} from "@/lib/trust-score";

export type CreatorProfileStatsSource = {
  trust_score_metrics?: unknown;
  avg_quality_score?: unknown;
  best_quality_score?: unknown;
  total_money_won?: unknown;
  total_views?: unknown;
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
  });

  return {
    trustMetrics,
    qualityMetrics,
    totalEarningsCents: Number(profile?.total_money_won ?? 0),
    totalViews: Number(profile?.total_views ?? 0),
  };
}

export function formatTrustScoreDisplay(score: number): string {
  return `${Math.round(score)}/100`;
}

export function formatQualityScoreDisplay(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return "—";
  }
  const rounded = Math.round(score * 100) / 100;
  const formatted = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted}/3`;
}
