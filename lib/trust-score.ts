export type TrustScoreMetrics = {
  trust_score: number;
  trust_number: number;
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
  | "trust_score"
  | "trust_number"
  | "total_reels"
  | "verified_reels"
  | "rejected_reels"
  | "pending_reels"
> & { updated_at: string };

type SubmissionStatus = "pending" | "verified" | "rejected" | "paid";

const roundToNearestInt = (value: number): number => Math.round(value);

/** Trust Number = verified reels − rejected reels. */
export function computeTrustNumber(
  verifiedReels: number,
  rejectedReels: number,
): number {
  return verifiedReels - rejectedReels;
}

/** Trust Score % = (trust number ÷ verified reels) × 100. No verified reels → 100 if no rejections, else 0. */
export function computeTrustScore(
  verifiedReels: number,
  rejectedReels: number,
): number {
  const verified = Math.max(0, verifiedReels);
  const rejected = Math.max(0, rejectedReels);
  const trustNumber = computeTrustNumber(verified, rejected);

  if (verified <= 0) {
    return rejected > 0 ? 0 : 100;
  }

  const rawScore = (trustNumber / verified) * 100;
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
    trust_score: computeTrustScore(verified, rejected),
    trust_number: computeTrustNumber(verified, rejected),
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

export type StoredCreatorTrustMetrics = {
  trust_score: number | null;
  trust_number: number | null;
  total_reels: number | null;
  verified_reels: number | null;
  rejected_reels: number | null;
  pending_reels: number | null;
  updated_at: string | null;
};

export function parseStoredCreatorTrustMetrics(
  raw: unknown,
): StoredCreatorTrustMetrics | null {
  let parsed: Record<string, unknown> | null = null;

  if (raw && typeof raw === "object") {
    parsed = raw as Record<string, unknown>;
  } else if (typeof raw === "string") {
    try {
      const json = JSON.parse(raw);
      parsed = json && typeof json === "object" ? json : null;
    } catch {
      parsed = null;
    }
  }

  if (!parsed) return null;

  return {
    trust_score:
      parsed.trust_score === null || parsed.trust_score === undefined
        ? null
        : Number(parsed.trust_score),
    trust_number:
      parsed.trust_number === null || parsed.trust_number === undefined
        ? null
        : Number(parsed.trust_number),
    total_reels:
      parsed.total_reels === null || parsed.total_reels === undefined
        ? null
        : Number(parsed.total_reels),
    verified_reels:
      parsed.verified_reels === null || parsed.verified_reels === undefined
        ? null
        : Number(parsed.verified_reels),
    rejected_reels:
      parsed.rejected_reels === null || parsed.rejected_reels === undefined
        ? null
        : Number(parsed.rejected_reels),
    pending_reels:
      parsed.pending_reels === null || parsed.pending_reels === undefined
        ? null
        : Number(parsed.pending_reels),
    updated_at:
      typeof parsed.updated_at === "string" ? parsed.updated_at : null,
  };
}

export function resolveCreatorTrustMetrics(
  creatorProfile: { trust_score_metrics?: unknown } | null | undefined,
  creatorId?: string | null,
  liveByCreatorId?: Record<string, StoredCreatorTrustMetrics | null | undefined>,
): StoredCreatorTrustMetrics | null {
  const fromProfile = parseStoredCreatorTrustMetrics(
    creatorProfile?.trust_score_metrics,
  );
  if (fromProfile) {
    return fromProfile;
  }

  if (
    creatorId &&
    liveByCreatorId?.[creatorId] &&
    typeof liveByCreatorId[creatorId] === "object"
  ) {
    return liveByCreatorId[creatorId] ?? null;
  }

  return null;
}

export function getCreatorTrustScoreFromMetrics(
  creatorProfile: { trust_score_metrics?: unknown } | null | undefined,
  creatorId?: string | null,
  liveByCreatorId?: Record<string, StoredCreatorTrustMetrics | null | undefined>,
): number | null {
  const metrics = resolveCreatorTrustMetrics(
    creatorProfile,
    creatorId,
    liveByCreatorId,
  );
  const raw = metrics?.trust_score;
  if (raw === null || raw === undefined || Number.isNaN(raw)) return null;
  return Number.isFinite(raw) ? raw : null;
}

export function getCreatorTrustNumberFromMetrics(
  creatorProfile: { trust_score_metrics?: unknown } | null | undefined,
  creatorId?: string | null,
  liveByCreatorId?: Record<string, StoredCreatorTrustMetrics | null | undefined>,
): number | null {
  const metrics = resolveCreatorTrustMetrics(
    creatorProfile,
    creatorId,
    liveByCreatorId,
  );
  if (metrics?.trust_number !== null && metrics?.trust_number !== undefined) {
    const raw = metrics.trust_number;
    if (!Number.isNaN(raw) && Number.isFinite(raw)) return raw;
  }
  if (
    metrics?.verified_reels !== null &&
    metrics?.verified_reels !== undefined &&
    metrics?.rejected_reels !== null &&
    metrics?.rejected_reels !== undefined
  ) {
    return computeTrustNumber(metrics.verified_reels, metrics.rejected_reels);
  }
  return null;
}

export async function fetchLiveTrustMetricsByCreatorIds(
  supabaseAdmin: any,
  creatorIds: string[],
): Promise<Record<string, StoredCreatorTrustMetrics>> {
  if (creatorIds.length === 0) return {};

  const { data: rows, error } = await supabaseAdmin
    .from("submissions")
    .select("creator_id, status")
    .in("creator_id", creatorIds);

  if (error) {
    console.error(
      "[trust-score] Failed to fetch submissions for live trust metrics:",
      error,
    );
    return {};
  }

  const countsByCreator: Record<
    string,
    {
      total_reels: number;
      verified_reels: number;
      rejected_reels: number;
      pending_reels: number;
    }
  > = {};

  (rows || []).forEach((row: any) => {
    const creatorId =
      typeof row?.creator_id === "string" ? row.creator_id.trim() : "";
    if (!creatorId) return;

    if (!countsByCreator[creatorId]) {
      countsByCreator[creatorId] = {
        total_reels: 0,
        verified_reels: 0,
        rejected_reels: 0,
        pending_reels: 0,
      };
    }

    const bucket = countsByCreator[creatorId];
    bucket.total_reels += 1;
    const status = String(row?.status || "").toLowerCase();
    if (status === "verified" || status === "paid") {
      bucket.verified_reels += 1;
    } else if (status === "rejected") {
      bucket.rejected_reels += 1;
    } else if (status === "pending") {
      bucket.pending_reels += 1;
    }
  });

  const liveByCreatorId: Record<string, StoredCreatorTrustMetrics> = {};
  Object.entries(countsByCreator).forEach(([creatorId, counts]) => {
    const metrics = buildTrustScoreMetricsFromCounts(counts);
    liveByCreatorId[creatorId] = {
      trust_score: metrics.trust_score,
      trust_number: metrics.trust_number,
      total_reels: metrics.total_reels,
      verified_reels: metrics.verified_reels,
      rejected_reels: metrics.rejected_reels,
      pending_reels: metrics.pending_reels,
      updated_at: new Date().toISOString(),
    };
  });

  return liveByCreatorId;
}

/** Video campaigns use contest_format !== "text_image" (legacy null counts as video). */
export function isVideoContestFormat(
  contestFormat?: string | null,
): boolean {
  return contestFormat !== "text_image";
}

export function parseContestMinTrustScore(trustScore: unknown): number | null {
  if (trustScore === null || trustScore === undefined) return null;
  const value = Number(trustScore);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function parseContestMinTrustNumber(trustNumber: unknown): number | null {
  if (trustNumber === null || trustNumber === undefined) return null;
  const value = Number(trustNumber);
  if (!Number.isFinite(value)) return null;
  return value;
}

export function getContestMinTrustScoreForGate(contest: {
  contest_format?: string | null;
  trust_score?: unknown;
}): number | null {
  if (!isVideoContestFormat(contest.contest_format)) return null;
  return parseContestMinTrustScore(contest.trust_score);
}

export function getContestMinTrustNumberForGate(contest: {
  contest_format?: string | null;
  trust_number?: unknown;
}): number | null {
  if (!isVideoContestFormat(contest.contest_format)) return null;
  return parseContestMinTrustNumber(contest.trust_number);
}

export function isVideoContestTrustGateActive(contest: {
  contest_format?: string | null;
  trust_score?: unknown;
  trust_number?: unknown;
}): boolean {
  return (
    getContestMinTrustScoreForGate(contest) !== null ||
    getContestMinTrustNumberForGate(contest) !== null
  );
}

/** Fail-closed: block while loading, on load failure, or when score is below minimum. */
export function isCreatorTrustSubmissionBlocked(input: {
  minScore: number | null;
  creatorScore: number | null;
  scoreLoaded: boolean;
  scoreLoading: boolean;
}): boolean {
  if (input.minScore === null) return false;
  if (input.scoreLoading || !input.scoreLoaded) return true;
  if (input.creatorScore === null) return true;
  return input.creatorScore < input.minScore;
}

/** Fail-closed: block while loading, on load failure, or when trust number is below minimum. */
export function isCreatorTrustNumberSubmissionBlocked(input: {
  minTrustNumber: number | null;
  creatorTrustNumber: number | null;
  trustNumberLoaded: boolean;
  trustNumberLoading: boolean;
}): boolean {
  if (input.minTrustNumber === null) return false;
  if (input.trustNumberLoading || !input.trustNumberLoaded) return true;
  if (input.creatorTrustNumber === null) return true;
  return input.creatorTrustNumber < input.minTrustNumber;
}

export function getTrustSubmissionBlockedMessage(input: {
  minScore: number;
  creatorScore: number | null;
  scoreLoading: boolean;
  scoreLoaded: boolean;
}): string {
  if (input.scoreLoading) {
    return `Loading trust score… This campaign requires at least ${input.minScore}%.`;
  }
  if (!input.scoreLoaded || input.creatorScore === null) {
    return `Unable to verify your trust score. This campaign requires at least ${input.minScore}%. Please refresh or try again later.`;
  }
  return `Trust score too low to submit. Your trust score is ${input.creatorScore}%. This campaign requires at least ${input.minScore}%. You can still view this campaign and your existing submissions. Submit new content after your score reaches ${input.minScore}% or higher.`;
}

export function getTrustNumberSubmissionBlockedMessage(input: {
  minTrustNumber: number;
  creatorTrustNumber: number | null;
  trustNumberLoading: boolean;
  trustNumberLoaded: boolean;
}): string {
  if (input.trustNumberLoading) {
    return `Loading Trust Score… This campaign requires at least ${input.minTrustNumber}.`;
  }
  if (!input.trustNumberLoaded || input.creatorTrustNumber === null) {
    return `Unable to verify your Trust Score. This campaign requires at least ${input.minTrustNumber}. Please refresh or try again later.`;
  }
  return `Trust Score too low to submit. Your Trust Score is ${input.creatorTrustNumber}. This campaign requires at least ${input.minTrustNumber}. You can still view this campaign and your existing submissions. Submit new content after your Trust Score reaches ${input.minTrustNumber} or higher.`;
}

/** Live metrics from all submissions (matches DB enforce_submission_trust_score). */
export async function getCreatorTrustMetricsLive(
  supabase: any,
  creatorId: string,
): Promise<TrustScoreMetrics> {
  const { data: rows, error } = await supabase
    .from("submissions")
    .select("status")
    .eq("creator_id", creatorId);

  if (error) {
    throw new Error(error.message || "Failed to load submissions for trust score");
  }

  return getTrustMetricsFromStatuses(
    (rows || []).map((row: { status: SubmissionStatus }) => row.status),
  );
}

export async function getCreatorTrustScoreForUser(
  supabase: any,
  creatorId: string,
): Promise<number> {
  return (await getCreatorTrustMetricsLive(supabase, creatorId)).trust_score;
}

export async function getCreatorTrustNumberForUser(
  supabase: any,
  creatorId: string,
): Promise<number> {
  return (await getCreatorTrustMetricsLive(supabase, creatorId)).trust_number;
}

export async function assertCreatorMeetsContestTrustRequirement(
  supabase: any,
  contestId: string,
  creatorId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: contest, error: contestError } = await supabase
    .from("contests")
    .select("trust_score, trust_number, contest_format")
    .eq("id", contestId)
    .maybeSingle();

  if (contestError || !contest) {
    return {
      ok: false,
      error: contestError?.message || "Contest not found",
      status: 404,
    };
  }

  const minScore = getContestMinTrustScoreForGate(contest);
  const minTrustNumber = getContestMinTrustNumberForGate(contest);
  if (minScore === null && minTrustNumber === null) {
    return { ok: true };
  }

  try {
    const metrics = await getCreatorTrustMetricsLive(supabase, creatorId);

    if (minScore !== null && metrics.trust_score < minScore) {
      return {
        ok: false,
        error: `Trust score too low to submit. Your trust score is ${metrics.trust_score}%. This campaign requires at least ${minScore}%.`,
        status: 403,
      };
    }

    if (minTrustNumber !== null && metrics.trust_number < minTrustNumber) {
      return {
        ok: false,
        error: `Trust Score too low to submit. Your Trust Score is ${metrics.trust_number}. This campaign requires at least ${minTrustNumber}.`,
        status: 403,
      };
    }

    return { ok: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to verify trust score";
    return { ok: false, error: message, status: 500 };
  }
}

export async function recomputeTrustForCreatorIds(
  supabase: any,
  creatorIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(creatorIds.filter(Boolean))];
  await Promise.all(
    uniqueIds.map(async (creatorId) => {
      const result = await recomputeCreatorTrustMetrics(supabase, creatorId);
      if (!result.ok) {
        console.error(
          `[trust-score] Failed to recompute trust for creator ${creatorId}:`,
          result.error,
        );
      }
    }),
  );
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
        trust_number: metrics.trust_number,
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
