import {
  CREATOR_DEFAULT_QUALITY_SCORE,
  parseQualityScore,
  type QualityScoreCounts,
} from "@/lib/quality-score";
import { buildTrustScoreMetricsFromCounts } from "@/lib/trust-score";

export type CreatorMetricsDelta = {
  total_reels: number;
  verified_reels: number;
  rejected_reels: number;
  pending_reels: number;
  quality_score_sum: number;
  scored_verified_count: number;
  quality_score_counts: QualityScoreCounts;
};

export type SubmissionMetricsSnapshot = {
  status: string | null | undefined;
  quality_score: number | null | undefined;
  /** When true, quality_score is excluded from creator aggregates (migration backfill). */
  quality_score_backfilled?: boolean | null;
};

export type CreatorMetricsCounters = {
  total_reels: number;
  verified_reels: number;
  rejected_reels: number;
  pending_reels: number;
  quality_score_sum: number;
  scored_verified_count: number;
  quality_score_counts: QualityScoreCounts;
};

export type CreatorProfileMetricsPersistable = {
  trust_score_metrics: {
    trust_score: number;
    trust_number: number;
    total_reels: number;
    verified_reels: number;
    rejected_reels: number;
    pending_reels: number;
    updated_at: string;
  };
  avg_quality_score: number | null;
  best_quality_score: number | null;
  quality_score_sum: number;
  scored_verified_count: number;
  quality_score_counts: QualityScoreCounts;
};

export function emptyCreatorMetricsDelta(): CreatorMetricsDelta {
  return {
    total_reels: 0,
    verified_reels: 0,
    rejected_reels: 0,
    pending_reels: 0,
    quality_score_sum: 0,
    scored_verified_count: 0,
    quality_score_counts: { score1: 0, score2: 0, score3: 0 },
  };
}

function isVerifiedStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "verified" || normalized === "paid";
}

function isRejectedStatus(status: string): boolean {
  return status.toLowerCase() === "rejected";
}

function isPendingStatus(status: string): boolean {
  return status.toLowerCase() === "pending";
}

/** Single-submission contribution to creator counters (not a transition delta). */
export function submissionMetricsContribution(
  state: SubmissionMetricsSnapshot | null,
): CreatorMetricsDelta {
  if (!state) return emptyCreatorMetricsDelta();

  const delta = emptyCreatorMetricsDelta();
  const status = String(state.status ?? "").toLowerCase();
  if (!status) return delta;

  delta.total_reels = 1;

  if (isVerifiedStatus(status)) {
    delta.verified_reels = 1;
    const score = parseQualityScore(state.quality_score);
    if (score !== null && state.quality_score_backfilled !== true) {
      delta.quality_score_sum = score;
      delta.scored_verified_count = 1;
      if (score === 1) delta.quality_score_counts.score1 = 1;
      else if (score === 2) delta.quality_score_counts.score2 = 1;
      else delta.quality_score_counts.score3 = 1;
    }
  } else if (isRejectedStatus(status)) {
    delta.rejected_reels = 1;
  } else if (isPendingStatus(status)) {
    delta.pending_reels = 1;
  }

  return delta;
}

export function negateCreatorMetricsDelta(
  delta: CreatorMetricsDelta,
): CreatorMetricsDelta {
  return {
    total_reels: -delta.total_reels,
    verified_reels: -delta.verified_reels,
    rejected_reels: -delta.rejected_reels,
    pending_reels: -delta.pending_reels,
    quality_score_sum: -delta.quality_score_sum,
    scored_verified_count: -delta.scored_verified_count,
    quality_score_counts: {
      score1: -delta.quality_score_counts.score1,
      score2: -delta.quality_score_counts.score2,
      score3: -delta.quality_score_counts.score3,
    },
  };
}

export function addCreatorMetricsDeltas(
  ...deltas: CreatorMetricsDelta[]
): CreatorMetricsDelta {
  const result = emptyCreatorMetricsDelta();
  for (const delta of deltas) {
    result.total_reels += delta.total_reels;
    result.verified_reels += delta.verified_reels;
    result.rejected_reels += delta.rejected_reels;
    result.pending_reels += delta.pending_reels;
    result.quality_score_sum += delta.quality_score_sum;
    result.scored_verified_count += delta.scored_verified_count;
    result.quality_score_counts.score1 += delta.quality_score_counts.score1;
    result.quality_score_counts.score2 += delta.quality_score_counts.score2;
    result.quality_score_counts.score3 += delta.quality_score_counts.score3;
  }
  return result;
}

/** O(1) delta from one submission row change (insert / update / delete). */
export function computeSubmissionMetricsDelta(
  oldState: SubmissionMetricsSnapshot | null,
  newState: SubmissionMetricsSnapshot | null,
): CreatorMetricsDelta {
  if (!oldState && !newState) return emptyCreatorMetricsDelta();
  if (!oldState) return submissionMetricsContribution(newState);
  if (!newState) {
    return negateCreatorMetricsDelta(submissionMetricsContribution(oldState));
  }

  return addCreatorMetricsDeltas(
    submissionMetricsContribution(newState),
    negateCreatorMetricsDelta(submissionMetricsContribution(oldState)),
  );
}

export function bestQualityFromCounts(
  counts: QualityScoreCounts,
): number | null {
  if (counts.score3 > 0) return 3;
  if (counts.score2 > 0) return 2;
  if (counts.score1 > 0) return 1;
  return null;
}

export function applyCreatorMetricsDeltaToCounters(
  counters: CreatorMetricsCounters,
  delta: CreatorMetricsDelta,
): CreatorMetricsCounters {
  return {
    total_reels: Math.max(0, counters.total_reels + delta.total_reels),
    verified_reels: Math.max(0, counters.verified_reels + delta.verified_reels),
    rejected_reels: Math.max(0, counters.rejected_reels + delta.rejected_reels),
    pending_reels: Math.max(0, counters.pending_reels + delta.pending_reels),
    quality_score_sum: Math.max(
      0,
      counters.quality_score_sum + delta.quality_score_sum,
    ),
    scored_verified_count: Math.max(
      0,
      counters.scored_verified_count + delta.scored_verified_count,
    ),
    quality_score_counts: {
      score1: Math.max(
        0,
        counters.quality_score_counts.score1 +
          delta.quality_score_counts.score1,
      ),
      score2: Math.max(
        0,
        counters.quality_score_counts.score2 +
          delta.quality_score_counts.score2,
      ),
      score3: Math.max(
        0,
        counters.quality_score_counts.score3 +
          delta.quality_score_counts.score3,
      ),
    },
  };
}

export function buildCreatorProfileMetricsFromCounters(
  counters: CreatorMetricsCounters,
  updatedAt = new Date().toISOString(),
): CreatorProfileMetricsPersistable {
  const trust = buildTrustScoreMetricsFromCounts({
    total_reels: counters.total_reels,
    verified_reels: counters.verified_reels,
    rejected_reels: counters.rejected_reels,
    pending_reels: counters.pending_reels,
  });

  let avg_quality_score: number | null;
  let best_quality_score: number | null;

  if (counters.verified_reels > 0) {
    if (counters.scored_verified_count > 0) {
      avg_quality_score =
        Math.round(
          (counters.quality_score_sum / counters.scored_verified_count) * 100,
        ) / 100;
      best_quality_score = bestQualityFromCounts(counters.quality_score_counts);
    } else {
      avg_quality_score = null;
      best_quality_score = null;
    }
  } else if (counters.rejected_reels > 0) {
    avg_quality_score = null;
    best_quality_score = null;
  } else {
    avg_quality_score = CREATOR_DEFAULT_QUALITY_SCORE;
    best_quality_score = CREATOR_DEFAULT_QUALITY_SCORE;
  }

  return {
    trust_score_metrics: {
      trust_score: trust.trust_score,
      trust_number: trust.trust_number,
      total_reels: counters.total_reels,
      verified_reels: counters.verified_reels,
      rejected_reels: counters.rejected_reels,
      pending_reels: counters.pending_reels,
      updated_at: updatedAt,
    },
    avg_quality_score,
    best_quality_score,
    quality_score_sum: counters.quality_score_sum,
    scored_verified_count: counters.scored_verified_count,
    quality_score_counts: counters.quality_score_counts,
  };
}
