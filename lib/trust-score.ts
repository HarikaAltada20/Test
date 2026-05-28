export type TrustScoreMetrics = {
  trust_score: number;
  rejected_pct: number;
  verified_pct: number;
  pending_pct: number;
  total_reels: number;
  verified_reels: number;
  rejected_reels: number;
  pending_reels: number;
};

type PersistedTrustMetrics = Pick<
  TrustScoreMetrics,
  "trust_score" | "total_reels" | "verified_reels" | "rejected_reels" | "pending_reels"
> & { updated_at: string };

type SubmissionStatus = "pending" | "verified" | "rejected" | "paid";

const roundToNearestInt = (value: number): number => Math.round(value);

export function computeTrustScore(totalReels: number, rejectedReels: number): number {
  if (totalReels <= 0) return 100;

  const rejectedPct = (rejectedReels / totalReels) * 100;
  const rawScore = 100 - rejectedPct;
  return Math.max(0, Math.min(100, roundToNearestInt(rawScore)));
}

export function buildTrustScoreMetricsFromCounts(input: {
  total_reels: number;
  verified_reels: number;
  rejected_reels: number;
  pending_reels: number;
}): TrustScoreMetrics {
  const total = Math.max(0, input.total_reels || 0);
  const verified = Math.max(0, input.verified_reels || 0);
  const rejected = Math.max(0, input.rejected_reels || 0);
  const pending = Math.max(0, input.pending_reels || 0);

  const pct = (value: number) => (total > 0 ? roundToNearestInt((value / total) * 100) : 0);

  return {
    trust_score: computeTrustScore(total, rejected),
    rejected_pct: pct(rejected),
    verified_pct: pct(verified),
    pending_pct: pct(pending),
    total_reels: total,
    verified_reels: verified,
    rejected_reels: rejected,
    pending_reels: pending,
  };
}

export function getTrustMetricsFromStatuses(statuses: SubmissionStatus[]): TrustScoreMetrics {
  const counts = statuses.reduce(
    (acc, status) => {
      acc.total_reels += 1;
      if (status === "rejected") acc.rejected_reels += 1;
      else if (status === "pending") acc.pending_reels += 1;
      else if (status === "verified" || status === "paid") acc.verified_reels += 1;
      return acc;
    },
    {
      total_reels: 0,
      verified_reels: 0,
      rejected_reels: 0,
      pending_reels: 0,
    },
  );

  return buildTrustScoreMetricsFromCounts(counts);
}

export async function recomputeCreatorTrustMetrics(
  supabase: any,
  creatorId: string,
): Promise<{ ok: true; metrics: TrustScoreMetrics } | { ok: false; error: string }> {
  const { data: rows, error } = await supabase
    .from("submissions")
    .select("status")
    .eq("creator_id", creatorId);

  if (error) {
    return { ok: false, error: error.message || "Failed to load submissions" };
  }

  const metrics = getTrustMetricsFromStatuses((rows || []).map((row: any) => row.status));

  const { error: updateError } = await supabase
    .from("creator_profiles")
    .update({
      trust_score_metrics: {
        trust_score: metrics.trust_score,
        total_reels: metrics.total_reels,
        verified_reels: metrics.verified_reels,
        rejected_reels: metrics.rejected_reels,
        pending_reels: metrics.pending_reels,
        updated_at: new Date().toISOString(),
      } as PersistedTrustMetrics,
    })
    .eq("id", creatorId);

  if (updateError) {
    return {
      ok: false,
      error: updateError.message || "Failed to persist trust metrics",
    };
  }

  return { ok: true, metrics };
}
