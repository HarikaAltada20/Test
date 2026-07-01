import {
  getContestMinTrustNumberForGate,
  getContestMinTrustScoreForGate,
  getCreatorTrustMetricsLive,
  isVideoContestFormat,
  parseStoredCreatorTrustMetrics,
} from "@/lib/trust-score";
import { formatQualityScoreDisplay } from "@/lib/creator-profile-stats";
import {
  getCreatorQualityMetricsLive,
  resolveCreatorQualityMetrics,
  type CreatorQualityMetrics,
} from "@/lib/quality-score";

export type ContestCreatorRequirements = {
  contest_format?: string | null;
  trust_score?: unknown;
  trust_number?: unknown;
  min_avg_quality_score?: unknown;
  min_best_quality_score?: unknown;
  min_platform_earnings?: unknown;
  min_platform_views?: unknown;
};

export type ParsedContestRequirements = {
  minTrustScorePct: number | null;
  minTrustNumber: number | null;
  minAvgQuality: number | null;
  minBestQuality: number | null;
  minPlatformEarningsCents: number | null;
  minPlatformViews: number | null;
};

export type CreatorRequirementsSnapshot = {
  trustScorePct: number;
  trustNumber: number;
  avgQualityScore: number | null;
  bestQualityScore: number | null;
  totalPlatformEarningsCents: number;
  totalViews: number;
  verifiedReels: number;
  rejectedReels: number;
  pendingReels: number;
};

function parseOptionalPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parseContestCreatorRequirements(
  contest: ContestCreatorRequirements,
): ParsedContestRequirements {
  if (!isVideoContestFormat(contest.contest_format)) {
    return {
      minTrustScorePct: null,
      minTrustNumber: null,
      minAvgQuality: null,
      minBestQuality: null,
      minPlatformEarningsCents: null,
      minPlatformViews: null,
    };
  }

  const minBestRaw = parseOptionalPositiveInt(contest.min_best_quality_score);
  const minBestQuality =
    minBestRaw !== null && minBestRaw >= 1 && minBestRaw <= 3 ? minBestRaw : null;

  const minAvgRaw = parseOptionalNumber(contest.min_avg_quality_score);
  const minAvgQuality =
    minAvgRaw !== null && minAvgRaw >= 1 && minAvgRaw <= 3 ? minAvgRaw : null;

  const minEarnings = parseOptionalPositiveInt(contest.min_platform_earnings);
  const minViews = parseOptionalPositiveInt(contest.min_platform_views);

  return {
    minTrustScorePct: getContestMinTrustScoreForGate(contest),
    minTrustNumber: getContestMinTrustNumberForGate(contest),
    minAvgQuality,
    minBestQuality,
    minPlatformEarningsCents:
      minEarnings !== null && minEarnings > 0 ? minEarnings : null,
    minPlatformViews: minViews !== null && minViews > 0 ? minViews : null,
  };
}

export function hasAnyContestCreatorRequirement(
  contest: ContestCreatorRequirements,
): boolean {
  const req = parseContestCreatorRequirements(contest);
  return (
    req.minTrustScorePct !== null ||
    req.minTrustNumber !== null ||
    req.minAvgQuality !== null ||
    req.minBestQuality !== null ||
    req.minPlatformEarningsCents !== null ||
    req.minPlatformViews !== null
  );
}

export function buildRequirementBadgeLabels(
  contest: ContestCreatorRequirements,
): string[] {
  const req = parseContestCreatorRequirements(contest);
  const badges: string[] = [];
  if (req.minTrustScorePct !== null) {
    badges.push(`Trust ${req.minTrustScorePct}%+`);
  }
  if (req.minTrustNumber !== null) {
    badges.push(`Trust #${req.minTrustNumber}+`);
  }
  if (req.minBestQuality !== null) {
    badges.push(`Best quality ${req.minBestQuality}+`);
  }
  if (req.minAvgQuality !== null) {
    badges.push(`Avg quality ${req.minAvgQuality}+`);
  }
  if (req.minPlatformEarningsCents !== null) {
    badges.push(`Earnings $${(req.minPlatformEarningsCents / 100).toFixed(0)}+`);
  }
  if (req.minPlatformViews !== null) {
    badges.push(`Views ${req.minPlatformViews.toLocaleString()}+`);
  }
  return badges;
}

export type ContestEligibilityDisplayItem = {
  key: string;
  label: string;
  value: string;
  description: string;
};

function formatQualityThreshold(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const formatted = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted} / 3`;
}

/** Creator-facing eligibility cards for campaign detail pages. */
export function buildContestEligibilityDisplayItems(
  contest: ContestCreatorRequirements,
): ContestEligibilityDisplayItem[] {
  const req = parseContestCreatorRequirements(contest);
  const items: ContestEligibilityDisplayItem[] = [];

  if (req.minTrustScorePct !== null) {
    items.push({
      key: "trust-score",
      label: "Trust score",
      value: `${req.minTrustScorePct}/100`,
      description:
        "Your reliability score from verified and rejected submissions. A higher score means more of your work has been approved.",
    });
  }
  if (req.minTrustNumber !== null) {
    items.push({
      key: "trust-number",
      label: "Trust number",
      value: `${req.minTrustNumber}`,
      description:
        "Verified submissions minus rejected ones. This number grows when more of your content is approved.",
    });
  }
  if (req.minBestQuality !== null) {
    items.push({
      key: "best-quality",
      label: "Best quality score",
      value: formatQualityThreshold(req.minBestQuality),
      description:
        "Your highest content quality rating (1–3) from verified submissions. The brand requires at least this level.",
    });
  }
  if (req.minAvgQuality !== null) {
    items.push({
      key: "avg-quality",
      label: "Average quality score",
      value: formatQualityThreshold(req.minAvgQuality),
      description:
        "Your average quality across verified submissions. Consistent quality helps you qualify for selective campaigns.",
    });
  }
  if (req.minPlatformEarningsCents !== null) {
    items.push({
      key: "platform-earnings",
      label: "Platform earnings",
      value: `$${(req.minPlatformEarningsCents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
      description:
        "Total earnings you have received on the platform from past campaigns and payouts.",
    });
  }
  if (req.minPlatformViews !== null) {
    items.push({
      key: "platform-views",
      label: "Platform views",
      value: `${req.minPlatformViews.toLocaleString()}`,
      description:
        "Total views credited to your submissions across all campaigns on the platform.",
    });
  }

  return items;
}

export type RequirementFailure = {
  code: string;
  message: string;
};

export type RequirementCheckItem = {
  code: string;
  label: string;
  requiredLabel: string;
  yoursLabel: string;
  passed: boolean;
};

export function buildRequirementChecklist(input: {
  requirements: ParsedContestRequirements;
  snapshot: CreatorRequirementsSnapshot;
}): RequirementCheckItem[] {
  const { requirements: req, snapshot } = input;
  const items: RequirementCheckItem[] = [];

  if (req.minTrustScorePct !== null) {
    items.push({
      code: "trust_score_too_low",
      label: "Trust score",
      requiredLabel: `${req.minTrustScorePct}%`,
      yoursLabel: `${snapshot.trustScorePct}%`,
      passed: snapshot.trustScorePct >= req.minTrustScorePct,
    });
  }

  if (req.minTrustNumber !== null) {
    items.push({
      code: "trust_number_too_low",
      label: "Trust number",
      requiredLabel: `${req.minTrustNumber}`,
      yoursLabel: `${snapshot.trustNumber}`,
      passed: snapshot.trustNumber >= req.minTrustNumber,
    });
  }

  if (req.minBestQuality !== null) {
    const yours = formatQualityScoreDisplay(snapshot.bestQualityScore);
    items.push({
      code: "best_quality_too_low",
      label: "Best quality score",
      requiredLabel: `${req.minBestQuality}/3`,
      yoursLabel: yours,
      passed:
        snapshot.bestQualityScore !== null &&
        snapshot.bestQualityScore >= req.minBestQuality,
    });
  }

  if (req.minAvgQuality !== null) {
    const yours = formatQualityScoreDisplay(snapshot.avgQualityScore);
    items.push({
      code: "avg_quality_too_low",
      label: "Average quality score",
      requiredLabel: `${req.minAvgQuality}/3`,
      yoursLabel: yours,
      passed:
        snapshot.avgQualityScore !== null &&
        snapshot.avgQualityScore >= req.minAvgQuality,
    });
  }

  if (req.minPlatformEarningsCents !== null) {
    const requiredDollars = (req.minPlatformEarningsCents / 100).toFixed(2);
    const yoursDollars = (snapshot.totalPlatformEarningsCents / 100).toFixed(2);
    items.push({
      code: "platform_earnings_too_low",
      label: "Platform earnings",
      requiredLabel: `$${requiredDollars}`,
      yoursLabel: `$${yoursDollars}`,
      passed:
        snapshot.totalPlatformEarningsCents >= req.minPlatformEarningsCents,
    });
  }

  if (req.minPlatformViews !== null) {
    items.push({
      code: "platform_views_too_low",
      label: "Platform views",
      requiredLabel: req.minPlatformViews.toLocaleString(),
      yoursLabel: snapshot.totalViews.toLocaleString(),
      passed: snapshot.totalViews >= req.minPlatformViews,
    });
  }

  return items;
}

export function evaluateCreatorRequirements(input: {
  requirements: ParsedContestRequirements;
  snapshot: CreatorRequirementsSnapshot;
}): RequirementFailure[] {
  const { requirements: req, snapshot } = input;
  const failures: RequirementFailure[] = [];

  if (
    req.minTrustScorePct !== null &&
    snapshot.trustScorePct < req.minTrustScorePct
  ) {
    failures.push({
      code: "trust_score_too_low",
      message: `Trust score too low. Yours is ${snapshot.trustScorePct}%; this campaign requires at least ${req.minTrustScorePct}%.`,
    });
  }

  if (
    req.minTrustNumber !== null &&
    snapshot.trustNumber < req.minTrustNumber
  ) {
    failures.push({
      code: "trust_number_too_low",
      message: `Trust number too low. Yours is ${snapshot.trustNumber}; this campaign requires at least ${req.minTrustNumber}.`,
    });
  }

  if (req.minBestQuality !== null) {
    if (
      snapshot.bestQualityScore === null ||
      snapshot.bestQualityScore < req.minBestQuality
    ) {
      failures.push({
        code: "best_quality_too_low",
        message: `Best quality too low. Yours is ${formatQualityScoreDisplay(snapshot.bestQualityScore)}; this campaign requires at least ${req.minBestQuality}/3.`,
      });
    }
  }

  if (req.minAvgQuality !== null) {
    if (
      snapshot.avgQualityScore === null ||
      snapshot.avgQualityScore < req.minAvgQuality
    ) {
      failures.push({
        code: "avg_quality_too_low",
        message: `Average quality too low. Yours is ${formatQualityScoreDisplay(snapshot.avgQualityScore)}; this campaign requires at least ${req.minAvgQuality}/3.`,
      });
    }
  }

  if (
    req.minPlatformEarningsCents !== null &&
    snapshot.totalPlatformEarningsCents < req.minPlatformEarningsCents
  ) {
    failures.push({
      code: "platform_earnings_too_low",
      message: `Platform earnings too low. You need at least $${(req.minPlatformEarningsCents / 100).toFixed(2)} lifetime; you have $${(snapshot.totalPlatformEarningsCents / 100).toFixed(2)}.`,
    });
  }

  if (
    req.minPlatformViews !== null &&
    snapshot.totalViews < req.minPlatformViews
  ) {
    failures.push({
      code: "platform_views_too_low",
      message: `Platform views too low. You need at least ${req.minPlatformViews.toLocaleString()} views; you have ${snapshot.totalViews.toLocaleString()}.`,
    });
  }

  return failures;
}

export function isCreatorEligibleForContest(input: {
  requirements: ParsedContestRequirements;
  snapshot: CreatorRequirementsSnapshot;
}): boolean {
  return evaluateCreatorRequirements(input).length === 0;
}

export function resolveCreatorEligibilityProfileFields(
  creatorProfile: {
    trust_score_metrics?: unknown;
    avg_quality_score?: unknown;
    best_quality_score?: unknown;
    total_money_won?: unknown;
    total_views?: unknown;
  } | null
  | undefined,
  liveQuality?: CreatorQualityMetrics | null,
): Pick<
  CreatorRequirementsSnapshot,
  | "avgQualityScore"
  | "bestQualityScore"
  | "totalPlatformEarningsCents"
  | "totalViews"
> {
  const storedTrust = parseStoredCreatorTrustMetrics(
    creatorProfile?.trust_score_metrics,
  );
  const verifiedReels = storedTrust?.verified_reels ?? 0;
  const rejectedReels = storedTrust?.rejected_reels ?? 0;

  const profileAvg = parseStoredQualityNumber(creatorProfile?.avg_quality_score);
  const profileBest = parseStoredQualityNumber(creatorProfile?.best_quality_score);
  const rawAvg =
    profileAvg !== null ? profileAvg : liveQuality?.avg_quality_score ?? null;
  const rawBest =
    profileBest !== null ? profileBest : liveQuality?.best_quality_score ?? null;

  const resolved = resolveCreatorQualityMetrics({
    verifiedReels,
    rejectedReels,
    avgQualityScore: rawAvg,
    bestQualityScore: rawBest,
  });

  return {
    avgQualityScore: resolved.avg_quality_score,
    bestQualityScore: resolved.best_quality_score,
    totalPlatformEarningsCents: Number(creatorProfile?.total_money_won ?? 0),
    totalViews: Number(creatorProfile?.total_views ?? 0),
  };
}

function parseStoredQualityNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function getCreatorRequirementsSnapshot(
  supabase: any,
  creatorId: string,
): Promise<CreatorRequirementsSnapshot> {
  const [trustMetrics, qualityMetrics, profileRow] = await Promise.all([
    getCreatorTrustMetricsLive(supabase, creatorId),
    getCreatorQualityMetricsLive(supabase, creatorId),
    supabase
      .from("creator_profiles")
      .select("total_money_won, total_views, avg_quality_score, best_quality_score")
      .eq("id", creatorId)
      .maybeSingle(),
  ]);

  const profile = profileRow?.data;
  const resolvedQuality = resolveCreatorQualityMetrics({
    verifiedReels: trustMetrics.verified_reels,
    rejectedReels: trustMetrics.rejected_reels,
    avgQualityScore: profile?.avg_quality_score ?? qualityMetrics.avg_quality_score,
    bestQualityScore: profile?.best_quality_score ?? qualityMetrics.best_quality_score,
  });

  return {
    trustScorePct: trustMetrics.trust_score,
    trustNumber: trustMetrics.trust_number,
    avgQualityScore: resolvedQuality.avg_quality_score,
    bestQualityScore: resolvedQuality.best_quality_score,
    totalPlatformEarningsCents: Number(profile?.total_money_won ?? 0),
    totalViews: Number(profile?.total_views ?? 0),
    verifiedReels: trustMetrics.verified_reels,
    rejectedReels: trustMetrics.rejected_reels,
    pendingReels: trustMetrics.pending_reels,
  };
}

export async function assertCreatorMeetsContestRequirements(
  supabase: any,
  contestId: string,
  creatorId: string,
): Promise<
  | { ok: true }
  | {
      ok: false;
      error: string;
      status: number;
      code?: string;
      failures: RequirementFailure[];
    }
> {
  const { data: contest, error: contestError } = await supabase
    .from("contests")
    .select(
      "trust_score, trust_number, min_avg_quality_score, min_best_quality_score, min_platform_earnings, min_platform_views, contest_format",
    )
    .eq("id", contestId)
    .maybeSingle();

  if (contestError || !contest) {
    return {
      ok: false,
      error: contestError?.message || "Contest not found",
      status: 404,
      failures: [],
    };
  }

  const requirements = parseContestCreatorRequirements(contest);
  if (
    requirements.minTrustScorePct === null &&
    requirements.minTrustNumber === null &&
    requirements.minAvgQuality === null &&
    requirements.minBestQuality === null &&
    requirements.minPlatformEarningsCents === null &&
    requirements.minPlatformViews === null
  ) {
    return { ok: true };
  }

  try {
    const snapshot = await getCreatorRequirementsSnapshot(supabase, creatorId);
    const failures = evaluateCreatorRequirements({ requirements, snapshot });
    if (failures.length > 0) {
      return {
        ok: false,
        error: failures[0].message,
        code: failures[0].code,
        failures,
        status: 403,
      };
    }
    return { ok: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to verify creator requirements";
    return { ok: false, error: message, status: 500, failures: [] };
  }
}

export function getRequirementsBlockedMessage(
  failures: RequirementFailure[],
): string | null {
  if (failures.length === 0) return null;
  return failures.map((f) => f.message).join("\n");
}

export async function recomputeCreatorProfileMetrics(
  supabase: any,
  creatorId: string,
): Promise<void> {
  const { recomputeCreatorTrustMetrics } = await import("@/lib/trust-score");
  const { recomputeCreatorQualityMetrics } = await import("@/lib/quality-score");

  const trustResult = await recomputeCreatorTrustMetrics(supabase, creatorId);
  const qualityResult = await recomputeCreatorQualityMetrics(supabase, creatorId);

  if (!trustResult.ok) {
    console.error(`[creator-metrics] trust recompute failed for ${creatorId}:`, trustResult.error);
  }
  if (!qualityResult.ok) {
    console.error(`[creator-metrics] quality recompute failed for ${creatorId}:`, qualityResult.error);
  }
}

export async function recomputeCreatorProfileMetricsForIds(
  supabase: any,
  creatorIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(creatorIds.filter(Boolean))];
  await Promise.all(
    uniqueIds.map((creatorId) => recomputeCreatorProfileMetrics(supabase, creatorId)),
  );
}
