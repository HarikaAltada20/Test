export type QualityScore = 1 | 2 | 3 | 4 | 5;

export const MAX_QUALITY_SCORE = 5 as const;
export const MIN_QUALITY_SCORE = 1 as const;

export const CREATOR_DEFAULT_QUALITY_SCORE: QualityScore = 1;

export type QualityScoreCounts = {
  score1: number;
  score2: number;
  score3: number;
  score4: number;
  score5: number;
};

export const EMPTY_QUALITY_SCORE_COUNTS: QualityScoreCounts = {
  score1: 0,
  score2: 0,
  score3: 0,
  score4: 0,
  score5: 0,
};

export type CreatorQualityMetrics = {
  avg_quality_score: number | null;
  best_quality_score: number | null;
  quality_score_sum: number | null;
  scored_verified_reels: number;
  quality_score_counts: QualityScoreCounts;
};

function parseStoredQualityNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isValidQualityScoreNumber(score: number): boolean {
  return (
    Number.isInteger(score) &&
    score >= MIN_QUALITY_SCORE &&
    score <= MAX_QUALITY_SCORE
  );
}

/**
 * Quality display / gate rules:
 * - 0 verified, 0 rejected → default 1/5 (new creator or only pending)
 * - 0 verified, rejected > 0 → null (cannot calculate)
 * - verified > 0 → stored scores from verified reels
 */
export function resolveCreatorQualityMetrics(input: {
  verifiedReels: number;
  rejectedReels: number;
  avgQualityScore?: unknown;
  bestQualityScore?: unknown;
  qualityScoreSum?: unknown;
}): CreatorQualityMetrics {
  const verifiedReels = Math.max(0, Number(input.verifiedReels) || 0);
  const rejectedReels = Math.max(0, Number(input.rejectedReels) || 0);
  const storedAvg = parseStoredQualityNumber(input.avgQualityScore);
  const storedBest = parseStoredQualityNumber(input.bestQualityScore);
  const storedSum = parseStoredQualityNumber(input.qualityScoreSum);

  if (verifiedReels > 0) {
    return {
      avg_quality_score: storedAvg,
      best_quality_score: storedBest,
      quality_score_sum: storedSum,
      scored_verified_reels:
        storedAvg !== null || storedBest !== null || storedSum !== null
          ? verifiedReels
          : 0,
      quality_score_counts: { ...EMPTY_QUALITY_SCORE_COUNTS },
    };
  }

  if (rejectedReels > 0) {
    return {
      avg_quality_score: null,
      best_quality_score: null,
      quality_score_sum: null,
      scored_verified_reels: 0,
      quality_score_counts: { ...EMPTY_QUALITY_SCORE_COUNTS },
    };
  }

  return {
    avg_quality_score: CREATOR_DEFAULT_QUALITY_SCORE,
    best_quality_score: CREATOR_DEFAULT_QUALITY_SCORE,
    quality_score_sum: CREATOR_DEFAULT_QUALITY_SCORE,
    scored_verified_reels: 0,
    quality_score_counts: { ...EMPTY_QUALITY_SCORE_COUNTS },
  };
}

export function parseQualityScore(value: unknown): QualityScore | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < MIN_QUALITY_SCORE || n > MAX_QUALITY_SCORE) {
    return null;
  }
  return n as QualityScore;
}

export function countQualityScoresFromScores(
  scores: number[],
): QualityScoreCounts {
  const counts: QualityScoreCounts = { ...EMPTY_QUALITY_SCORE_COUNTS };
  for (const raw of scores) {
    const score = parseQualityScore(raw);
    if (score === 1) counts.score1 += 1;
    else if (score === 2) counts.score2 += 1;
    else if (score === 3) counts.score3 += 1;
    else if (score === 4) counts.score4 += 1;
    else if (score === 5) counts.score5 += 1;
  }
  return counts;
}

export function parseQualityScoreCounts(value: unknown): QualityScoreCounts {
  const empty: QualityScoreCounts = { ...EMPTY_QUALITY_SCORE_COUNTS };
  if (!value || typeof value !== "object") return empty;
  const parsed = value as Record<string, unknown>;
  return {
    score1: Math.max(0, Number(parsed.score1) || 0),
    score2: Math.max(0, Number(parsed.score2) || 0),
    score3: Math.max(0, Number(parsed.score3) || 0),
    score4: Math.max(0, Number(parsed.score4) || 0),
    score5: Math.max(0, Number(parsed.score5) || 0),
  };
}

/** Returns the total number of scored submissions across all quality tiers. */
export function sumQualityScoreCounts(value: unknown): number {
  const counts = parseQualityScoreCounts(value);
  return (
    counts.score1 +
    counts.score2 +
    counts.score3 +
    counts.score4 +
    counts.score5
  );
}

export function requireVerifyQualityScore(value: unknown): QualityScore | null {
  return parseQualityScore(value);
}

export function isVerifyQualityScoreOmitted(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/** @deprecated Use requireVerifyQualityScore — verify requires an explicit 1–5 score. */
export function resolveVerifyQualityScore(value: unknown): QualityScore | null {
  return requireVerifyQualityScore(value);
}

/** @deprecated Use requireVerifyQualityScore — verify requires an explicit 1–5 score. */
export function normalizeVerifyQualityScore(
  value: unknown,
): QualityScore | null {
  return requireVerifyQualityScore(value);
}

export type PersistableQualityProfileValues = {
  avg_quality_score: number | null;
  best_quality_score: number | null;
};

/** Values written to creator_profiles — mirrors sync_creator_quality_metrics (SQL). */
export function computePersistableQualityProfileValues(input: {
  verifiedReels: number;
  rejectedReels: number;
  scoredQualityScores: number[];
}): PersistableQualityProfileValues {
  const verifiedReels = Math.max(0, Number(input.verifiedReels) || 0);
  const rejectedReels = Math.max(0, Number(input.rejectedReels) || 0);
  const scores = input.scoredQualityScores.filter(isValidQualityScoreNumber);

  if (verifiedReels > 0) {
    if (scores.length === 0) {
      return {
        avg_quality_score: null,
        best_quality_score: null,
      };
    }
    const sum = scores.reduce((acc, s) => acc + s, 0);
    return {
      avg_quality_score: Math.round((sum / scores.length) * 100) / 100,
      best_quality_score: Math.max(...scores),
    };
  }

  if (rejectedReels > 0) {
    return { avg_quality_score: null, best_quality_score: null };
  }

  return {
    avg_quality_score: CREATOR_DEFAULT_QUALITY_SCORE,
    best_quality_score: CREATOR_DEFAULT_QUALITY_SCORE,
  };
}

export function computeQualityMetricsFromScores(
  scores: number[],
): CreatorQualityMetrics {
  const valid = scores.filter(isValidQualityScoreNumber);
  if (valid.length === 0) {
    return {
      avg_quality_score: null,
      best_quality_score: null,
      quality_score_sum: null,
      scored_verified_reels: 0,
      quality_score_counts: { ...EMPTY_QUALITY_SCORE_COUNTS },
    };
  }
  const sum = valid.reduce((acc, s) => acc + s, 0);
  return {
    avg_quality_score: Math.round((sum / valid.length) * 100) / 100,
    best_quality_score: Math.max(...valid),
    quality_score_sum: sum,
    scored_verified_reels: valid.length,
    quality_score_counts: countQualityScoresFromScores(valid),
  };
}

type SubmissionQualityRow = {
  status?: string | null;
  quality_score?: number | null;
  quality_score_backfilled?: boolean | null;
};

function isExplicitQualitySubmission(row: SubmissionQualityRow): boolean {
  if (row.quality_score_backfilled === true) return false;
  const score = Number(row.quality_score);
  return isValidQualityScoreNumber(score);
}

/** Aggregate submission rows into verified/rejected counts and scored quality values. */
export function aggregateSubmissionQualityRows(rows: SubmissionQualityRow[]): {
  verifiedReels: number;
  rejectedReels: number;
  scoredQualityScores: number[];
} {
  let verifiedReels = 0;
  let rejectedReels = 0;
  const scoredQualityScores: number[] = [];

  for (const row of rows) {
    const status = String(row.status || "").toLowerCase();
    if (status === "verified" || status === "paid") {
      verifiedReels += 1;
      if (!isExplicitQualitySubmission(row)) {
        continue;
      }
      const score = Number(row.quality_score);
      if (isValidQualityScoreNumber(score)) {
        scoredQualityScores.push(score);
      }
    } else if (status === "rejected") {
      rejectedReels += 1;
    }
  }

  return { verifiedReels, rejectedReels, scoredQualityScores };
}

export async function getCreatorQualityMetricsLive(
  supabase: any,
  creatorId: string,
): Promise<CreatorQualityMetrics> {
  const { data: rows, error } = await supabase
    .from("submissions")
    .select("quality_score, quality_score_backfilled")
    .eq("creator_id", creatorId)
    .in("status", ["verified", "paid"])
    .not("quality_score", "is", null);

  if (error) {
    throw new Error(error.message || "Failed to load quality scores");
  }

  return computeQualityMetricsFromScores(
    (rows || [])
      .filter(
        (row: { quality_score_backfilled?: boolean | null }) =>
          row.quality_score_backfilled !== true,
      )
      .map((row: { quality_score: number }) => Number(row.quality_score)),
  );
}

export async function fetchLiveQualityMetricsByCreatorIds(
  supabaseAdmin: any,
  creatorIds: string[],
): Promise<Record<string, CreatorQualityMetrics>> {
  if (creatorIds.length === 0) return {};

  const { data: rows, error } = await supabaseAdmin
    .from("submissions")
    .select("creator_id, quality_score, quality_score_backfilled")
    .in("creator_id", creatorIds)
    .in("status", ["verified", "paid"])
    .not("quality_score", "is", null);

  if (error) {
    throw new Error(
      error.message || "Failed to fetch submissions for live quality metrics",
    );
  }

  const scoresByCreator: Record<string, number[]> = {};
  (rows || []).forEach(
    (row: {
      creator_id?: string;
      quality_score?: number;
      quality_score_backfilled?: boolean | null;
    }) => {
      const creatorId =
        typeof row?.creator_id === "string" ? row.creator_id.trim() : "";
      if (!creatorId) return;
      if (row.quality_score_backfilled === true) return;
      const score = Number(row.quality_score);
      if (!Number.isFinite(score)) return;
      if (!scoresByCreator[creatorId]) scoresByCreator[creatorId] = [];
      scoresByCreator[creatorId].push(score);
    },
  );

  const liveByCreatorId: Record<string, CreatorQualityMetrics> = {};
  Object.entries(scoresByCreator).forEach(([creatorId, scores]) => {
    liveByCreatorId[creatorId] = computeQualityMetricsFromScores(scores);
  });

  return liveByCreatorId;
}

export async function recomputeCreatorQualityMetrics(
  supabase: any,
  creatorId: string,
): Promise<
  { ok: true; metrics: CreatorQualityMetrics } | { ok: false; error: string }
> {
  try {
    const { data: rows, error: rowsError } = await supabase
      .from("submissions")
      .select("status, quality_score, quality_score_backfilled")
      .eq("creator_id", creatorId);

    if (rowsError) {
      return {
        ok: false,
        error:
          rowsError.message ||
          "Failed to load submissions for quality recompute",
      };
    }

    const { verifiedReels, rejectedReels, scoredQualityScores } =
      aggregateSubmissionQualityRows(rows || []);
    const persistable = computePersistableQualityProfileValues({
      verifiedReels,
      rejectedReels,
      scoredQualityScores,
    });

    const tierCounts =
      verifiedReels > 0 && scoredQualityScores.length > 0
        ? countQualityScoresFromScores(scoredQualityScores)
        : { ...EMPTY_QUALITY_SCORE_COUNTS };
    const qualitySum =
      verifiedReels > 0 && scoredQualityScores.length > 0
        ? scoredQualityScores.reduce((acc, score) => acc + score, 0)
        : 0;

    const metrics =
      verifiedReels > 0 && scoredQualityScores.length > 0
        ? computeQualityMetricsFromScores(scoredQualityScores)
        : resolveCreatorQualityMetrics({
            verifiedReels,
            rejectedReels,
            avgQualityScore: persistable.avg_quality_score,
            bestQualityScore: persistable.best_quality_score,
            qualityScoreSum: qualitySum > 0 ? qualitySum : null,
          });

    const { error: updateError } = await supabase
      .from("creator_profiles")
      .update({
        avg_quality_score: persistable.avg_quality_score,
        best_quality_score: persistable.best_quality_score,
        quality_score_sum: qualitySum,
        scored_verified_count: scoredQualityScores.length,
        quality_score_counts: tierCounts,
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
      error:
        err instanceof Error
          ? err.message
          : "Failed to recompute quality metrics",
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
