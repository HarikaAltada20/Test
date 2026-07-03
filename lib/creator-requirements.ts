import {
  getContestMinTrustNumberForGate,
  getContestMinTrustScoreForGate,
  isVideoContestFormat,
  parseStoredCreatorTrustMetrics,
  getCreatorTrustMetricsLive,
} from "@/lib/trust-score";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatQualityScoreDisplay,
  formatTrustScoreDisplay,
  formatTrustScoreMinimum,
  getCreatorStatsFromProfile,
  type CreatorProfileStatsSource,
} from "@/lib/creator-profile-stats";
import {
  resolveCreatorQualityMetrics,
  getCreatorQualityMetricsLive,
  type CreatorQualityMetrics,
} from "@/lib/quality-score";

/**
 * Creator contest gate rules for the app layer.
 * DB enforcement mirror: `public.enforce_submission_creator_requirements()` (see migrations).
 * Keep evaluateCreatorRequirements in sync when changing gate semantics.
 */

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
  /** False when all verified quality scores are migration backfills — quality gates are skipped. */
  hasExplicitQualityScores: boolean;
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
    minBestRaw !== null && minBestRaw >= 1 && minBestRaw <= 3
      ? minBestRaw
      : null;

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

export type RequirementBadgeItem = {
  key: string;
  shortLabel: string;
  valueLabel: string;
  fullLabel: string;
};

function formatRequirementViews(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return millions >= 10
      ? `${Math.round(millions)}M`
      : `${millions.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return thousands >= 10
      ? `${Math.round(thousands)}K`
      : `${thousands.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return value.toLocaleString();
}

export function buildRequirementBadgeItems(
  contest: ContestCreatorRequirements,
): RequirementBadgeItem[] {
  const req = parseContestCreatorRequirements(contest);
  const badges: RequirementBadgeItem[] = [];

  if (req.minTrustScorePct !== null) {
    const valueLabel = formatTrustScoreMinimum(req.minTrustScorePct);
    badges.push({
      key: "trust-pct",
      shortLabel: "Trust %",
      valueLabel,
      fullLabel: `Trust % ${valueLabel} required`,
    });
  }
  if (req.minTrustNumber !== null) {
    badges.push({
      key: "trust-number",
      shortLabel: "Trust Number",
      valueLabel: `${req.minTrustNumber}`,
      fullLabel: `Trust Number ${req.minTrustNumber} required`,
    });
  }
  if (req.minBestQuality !== null) {
    badges.push({
      key: "best-quality",
      shortLabel: "Best Quality",
      valueLabel: `${req.minBestQuality}`,
      fullLabel: `Best quality ${req.minBestQuality} required`,
    });
  }
  if (req.minAvgQuality !== null) {
    const rounded = Math.round(req.minAvgQuality * 100) / 100;
    const formatted = Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(2).replace(/\.?0+$/, "");
    badges.push({
      key: "avg-quality",
      shortLabel: "Average Quality",
      valueLabel: formatted,
      fullLabel: `Average quality ${formatted} required`,
    });
  }
  if (req.minPlatformEarningsCents !== null) {
    const dollars = req.minPlatformEarningsCents / 100;
    const valueLabel = `$${dollars >= 1000 ? Math.round(dollars).toLocaleString() : dollars.toFixed(0)}`;
    badges.push({
      key: "platform-earnings",
      shortLabel: "Earn",
      valueLabel,
      fullLabel: `Platform earnings ${valueLabel} required`,
    });
  }
  if (req.minPlatformViews !== null) {
    const valueLabel = formatRequirementViews(req.minPlatformViews);
    badges.push({
      key: "platform-views",
      shortLabel: "Views",
      valueLabel,
      fullLabel: `Platform views ${req.minPlatformViews.toLocaleString()} required`,
    });
  }

  return badges;
}

export function buildRequirementBadgeLabels(
  contest: ContestCreatorRequirements,
): string[] {
  return buildRequirementBadgeItems(contest).map(
    (item) => `${item.shortLabel} ${item.valueLabel}`,
  );
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
      label: "Trust %",
      value: formatTrustScoreMinimum(req.minTrustScorePct),
      description:
        "Your reliability score from verified and rejected submissions. A higher score means more of your work has been approved.",
    });
  }
  if (req.minTrustNumber !== null) {
    items.push({
      key: "trust-number",
      label: "Trust Number",
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

/**
 * App-layer gate failure codes from evaluateCreatorRequirements.
 * Must stay aligned with SQL RAISE EXCEPTION prefixes in
 * public.enforce_submission_creator_requirements() (migrations 6–7).
 */
export const CREATOR_REQUIREMENT_FAILURE_CODES = [
  "trust_score_too_low",
  "trust_number_too_low",
  "best_quality_too_low",
  "avg_quality_too_low",
  "platform_earnings_too_low",
  "platform_views_too_low",
] as const;

export type CreatorRequirementFailureCode =
  (typeof CREATOR_REQUIREMENT_FAILURE_CODES)[number];

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
      label: "Trust %",
      requiredLabel: formatTrustScoreMinimum(req.minTrustScorePct),
      yoursLabel: formatTrustScoreDisplay(snapshot.trustScorePct),
      passed: snapshot.trustScorePct >= req.minTrustScorePct,
    });
  }

  if (req.minTrustNumber !== null) {
    items.push({
      code: "trust_number_too_low",
      label: "Trust Number",
      requiredLabel: `${req.minTrustNumber}`,
      yoursLabel: `${snapshot.trustNumber}`,
      passed: snapshot.trustNumber >= req.minTrustNumber,
    });
  }

  if (req.minBestQuality !== null && snapshot.hasExplicitQualityScores) {
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

  if (req.minAvgQuality !== null && snapshot.hasExplicitQualityScores) {
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
      message: `Trust % too low. Yours is ${formatTrustScoreDisplay(snapshot.trustScorePct)}; this campaign requires at least ${formatTrustScoreMinimum(req.minTrustScorePct)}.`,
    });
  }

  if (
    req.minTrustNumber !== null &&
    snapshot.trustNumber < req.minTrustNumber
  ) {
    failures.push({
      code: "trust_number_too_low",
      message: `Trust Number too low. Yours is ${snapshot.trustNumber}; this campaign requires at least ${req.minTrustNumber}.`,
    });
  }

  if (req.minBestQuality !== null && snapshot.hasExplicitQualityScores) {
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

  if (req.minAvgQuality !== null && snapshot.hasExplicitQualityScores) {
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
  creatorProfile:
    | {
        trust_score_metrics?: unknown;
        avg_quality_score?: unknown;
        best_quality_score?: unknown;
        total_money_won?: unknown;
        total_views?: unknown;
      }
    | null
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

  const profileAvg = parseStoredQualityNumber(
    creatorProfile?.avg_quality_score,
  );
  const profileBest = parseStoredQualityNumber(
    creatorProfile?.best_quality_score,
  );
  const rawAvg =
    profileAvg !== null ? profileAvg : (liveQuality?.avg_quality_score ?? null);
  const rawBest =
    profileBest !== null
      ? profileBest
      : (liveQuality?.best_quality_score ?? null);

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

export function buildCreatorRequirementsSnapshotFromProfile(
  profile: CreatorProfileStatsSource | null | undefined,
): CreatorRequirementsSnapshot {
  const stats = getCreatorStatsFromProfile(profile);
  return {
    trustScorePct: stats.trustMetrics.trust_score,
    trustNumber: stats.trustMetrics.trust_number,
    avgQualityScore: stats.qualityMetrics.avg_quality_score,
    bestQualityScore: stats.qualityMetrics.best_quality_score,
    totalPlatformEarningsCents: stats.totalEarningsCents,
    totalViews: stats.totalViews,
    verifiedReels: stats.trustMetrics.verified_reels,
    rejectedReels: stats.trustMetrics.rejected_reels,
    pendingReels: stats.trustMetrics.pending_reels,
    hasExplicitQualityScores: profile?.has_explicit_quality_scores === true,
  };
}

export async function getCreatorRequirementsSnapshot(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<CreatorRequirementsSnapshot> {
  const { data: profile, error } = await supabase
    .from("creator_profiles")
    .select(
      "trust_score_metrics, avg_quality_score, best_quality_score, total_money_won, total_views, has_explicit_quality_scores",
    )
    .eq("id", creatorId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load creator profile");
  }

  const snapshot = buildCreatorRequirementsSnapshotFromProfile(profile);
  const storedTrust = parseStoredCreatorTrustMetrics(profile?.trust_score_metrics);

  if (
    storedTrust?.trust_score == null ||
    storedTrust?.trust_number == null ||
    !Number.isFinite(storedTrust.trust_score) ||
    !Number.isFinite(storedTrust.trust_number)
  ) {
    const liveTrust = await getCreatorTrustMetricsLive(supabase, creatorId);
    snapshot.trustScorePct = liveTrust.trust_score;
    snapshot.trustNumber = liveTrust.trust_number;
    snapshot.verifiedReels = liveTrust.verified_reels;
    snapshot.rejectedReels = liveTrust.rejected_reels;
    snapshot.pendingReels = liveTrust.pending_reels;
  }

  if (profile?.has_explicit_quality_scores === true) {
    const liveQuality = await getCreatorQualityMetricsLive(supabase, creatorId);
    snapshot.avgQualityScore = liveQuality.avg_quality_score;
    snapshot.bestQualityScore = liveQuality.best_quality_score;
  }

  return snapshot;
}

export async function assertCreatorMeetsContestRequirements(
  supabase: SupabaseClient,
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
      err instanceof Error
        ? err.message
        : "Failed to verify creator requirements";
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
  supabase: SupabaseClient,
  creatorId: string,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const { recomputeCreatorTrustMetrics } = await import("@/lib/trust-score");
  const { recomputeCreatorQualityMetrics } =
    await import("@/lib/quality-score");

  const trustResult = await recomputeCreatorTrustMetrics(supabase, creatorId);
  const qualityResult = await recomputeCreatorQualityMetrics(
    supabase,
    creatorId,
  );

  const errors: string[] = [];
  if (!trustResult.ok) {
    const message = `[creator-metrics] trust recompute failed for ${creatorId}: ${trustResult.error}`;
    console.error(message);
    errors.push(trustResult.error);
  }
  if (!qualityResult.ok) {
    const message = `[creator-metrics] quality recompute failed for ${creatorId}: ${qualityResult.error}`;
    console.error(message);
    errors.push(qualityResult.error);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

export async function recomputeCreatorProfileMetricsForIds(
  supabase: SupabaseClient,
  creatorIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(creatorIds.filter(Boolean))];
  await Promise.all(
    uniqueIds.map((creatorId) =>
      recomputeCreatorProfileMetrics(supabase, creatorId),
    ),
  );
}
