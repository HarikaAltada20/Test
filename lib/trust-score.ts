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

export type StoredCreatorTrustMetrics = {
  trust_score: number | null;
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
      total_reels: metrics.total_reels,
      verified_reels: metrics.verified_reels,
      rejected_reels: metrics.rejected_reels,
      pending_reels: metrics.pending_reels,
      updated_at: new Date().toISOString(),
    };
  });

  return liveByCreatorId;
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
