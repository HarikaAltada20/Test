export type QualityScore = 1 | 2 | 3;

export const CREATOR_DEFAULT_QUALITY_SCORE: QualityScore = 1;

export type CreatorQualityMetrics = {
  avg_quality_score: number | null;
  best_quality_score: number | null;
  scored_verified_reels: number;
};

function parseStoredQualityNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Quality display / gate rules:
 * - 0 verified, 0 rejected → default 1/3 (new creator or only pending)
 * - 0 verified, rejected > 0 → null (cannot calculate)
 * - verified > 0 → stored scores from verified reels
 */
export function resolveCreatorQualityMetrics(input: {
  verifiedReels: number;
  rejectedReels: number;
  avgQualityScore?: unknown;
  bestQualityScore?: unknown;
}): CreatorQualityMetrics {
  const verifiedReels = Math.max(0, Number(input.verifiedReels) || 0);
  const rejectedReels = Math.max(0, Number(input.rejectedReels) || 0);
  const storedAvg = parseStoredQualityNumber(input.avgQualityScore);
  const storedBest = parseStoredQualityNumber(input.bestQualityScore);

  if (verifiedReels > 0) {
    return {
      avg_quality_score: storedAvg,
      best_quality_score: storedBest,
      scored_verified_reels:
        storedAvg !== null || storedBest !== null ? verifiedReels : 0,
    };
  }

  if (rejectedReels > 0) {
    return {
      avg_quality_score: null,
      best_quality_score: null,
      scored_verified_reels: 0,
    };
  }

  return {
    avg_quality_score: CREATOR_DEFAULT_QUALITY_SCORE,
    best_quality_score: CREATOR_DEFAULT_QUALITY_SCORE,
    scored_verified_reels: 0,
  };
}

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

export async function fetchLiveQualityMetricsByCreatorIds(
  supabaseAdmin: any,
  creatorIds: string[],
): Promise<Record<string, CreatorQualityMetrics>> {
  if (creatorIds.length === 0) return {};

  const { data: rows, error } = await supabaseAdmin
    .from("submissions")
    .select("creator_id, quality_score")
    .in("creator_id", creatorIds)
    .in("status", ["verified", "paid"])
    .not("quality_score", "is", null);

  if (error) {
    console.error(
      "[quality-score] Failed to fetch submissions for live quality metrics:",
      error,
    );
    return {};
  }

  const scoresByCreator: Record<string, number[]> = {};
  (rows || []).forEach((row: { creator_id?: string; quality_score?: number }) => {
    const creatorId =
      typeof row?.creator_id === "string" ? row.creator_id.trim() : "";
    if (!creatorId) return;
    const score = Number(row.quality_score);
    if (!Number.isFinite(score)) return;
    if (!scoresByCreator[creatorId]) scoresByCreator[creatorId] = [];
    scoresByCreator[creatorId].push(score);
  });

  const liveByCreatorId: Record<string, CreatorQualityMetrics> = {};
  Object.entries(scoresByCreator).forEach(([creatorId, scores]) => {
    liveByCreatorId[creatorId] = computeQualityMetricsFromScores(scores);
  });

  return liveByCreatorId;
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
