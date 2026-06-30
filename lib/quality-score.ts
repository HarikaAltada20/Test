export type QualityScore = 1 | 2 | 3;

export type CreatorQualityMetrics = {
  avg_quality_score: number | null;
  best_quality_score: number | null;
  scored_verified_reels: number;
};

export function parseQualityScore(value: unknown): QualityScore | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 3) return null;
  return Math.round(n) as QualityScore;
}

export function normalizeVerifyQualityScore(value: unknown): QualityScore {
  return parseQualityScore(value) ?? 1;
}

export function computeQualityMetricsFromScores(
  scores: number[],
): CreatorQualityMetrics {
  const valid = scores.filter(
    (s) => Number.isFinite(s) && s >= 1 && s <= 3,
  );
  if (valid.length === 0) {
    return {
      avg_quality_score: null,
      best_quality_score: null,
      scored_verified_reels: 0,
    };
  }
  const sum = valid.reduce((acc, s) => acc + s, 0);
  return {
    avg_quality_score: Math.round((sum / valid.length) * 100) / 100,
    best_quality_score: Math.max(...valid),
    scored_verified_reels: valid.length,
  };
}

export async function getCreatorQualityMetricsLive(
  supabase: any,
  creatorId: string,
): Promise<CreatorQualityMetrics> {
  const { data: rows, error } = await supabase
    .from("submissions")
    .select("quality_score")
    .eq("creator_id", creatorId)
    .in("status", ["verified", "paid"])
    .not("quality_score", "is", null);

  if (error) {
    throw new Error(error.message || "Failed to load quality scores");
  }

  return computeQualityMetricsFromScores(
    (rows || []).map((row: { quality_score: number }) => Number(row.quality_score)),
  );
}

export async function recomputeCreatorQualityMetrics(
  supabase: any,
  creatorId: string,
): Promise<{ ok: true; metrics: CreatorQualityMetrics } | { ok: false; error: string }> {
  try {
    const metrics = await getCreatorQualityMetricsLive(supabase, creatorId);
    const { error: updateError } = await supabase
      .from("creator_profiles")
      .update({
        avg_quality_score: metrics.avg_quality_score,
        best_quality_score: metrics.best_quality_score,
      })
      .eq("id", creatorId);

    if (updateError) {
      return {
        ok: false,
        error: updateError.message || "Failed to persist quality metrics",
      };
    }
    return { ok: true, metrics };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to recompute quality metrics",
    };
  }
}

export async function recomputeQualityForCreatorIds(
  supabase: any,
  creatorIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(creatorIds.filter(Boolean))];
  await Promise.all(
    uniqueIds.map(async (creatorId) => {
      const result = await recomputeCreatorQualityMetrics(supabase, creatorId);
      if (!result.ok) {
        console.error(
          `[quality-score] Failed to recompute quality for creator ${creatorId}:`,
          result.error,
        );
      }
    }),
  );
}
