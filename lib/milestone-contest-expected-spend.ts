import type { MilestonePayoutRule } from "@/lib/contest-utils-client";
import { getCpmEligibleViewsFromRow } from "@/lib/cpm-eligible-views";
import { adjustBonusCents } from "@/lib/payout-rules";
import {
  parseVideoContestPlatforms,
  resolveMilestoneContestForPlatform,
  VIDEO_CONTEST_PLATFORMS,
  videoContestPlatformFromValue,
} from "@/lib/video-platform-campaigns";

/** Minimal submission row for milestone budget (list / opportunities / server). */
export type MilestoneBudgetSubmission = {
  id: string;
  creator_id?: string | null;
  created_at: string;
  status?: string | null;
  paid?: boolean | null;
  paid_at?: string | null;
  earnings?: number | null;
  deleted_at?: string | null;
  views?: number | null;
  /** Used with `other_stats` so TikTok milestones match dashboard (view_count vs column). */
  platform?: string | null;
  other_stats?: unknown;
  bonus_paid?: boolean | null;
  bonus_amount?: number | null;
  milestone_bonus_paid?: any;
  metadata?: any;
};

/**
 * View count used for milestone tiering — same sources as CPM
 * (`getCpmEligibleViewsFromRow`: TikTok view_count, Instagram views/reach).
 */
export function getMilestoneEligibleViewsFromRow(row: {
  views?: number | null;
  platform?: string | null;
  other_stats?: unknown;
}): number {
  return getCpmEligibleViewsFromRow(row);
}

function normalizeStatus(raw: string | null | undefined): string {
  const t = String(raw || "pending").toLowerCase();
  return t === "approved" ? "verified" : t;
}

function isVerifiedLike(st: string): boolean {
  return st === "verified" || st === "paid" || st === "approved";
}

export type MilestonePayoutRuleWithOrder = MilestonePayoutRule & {
  order?: number;
};

export type MilestonePayoutAssignments = {
  payoutMap: Map<string, number>;
  labelMap: Map<string, string>;
  /** `${platform}:${target_views}` (or `_:target` for contest-wide FCFS). */
  winnerCountsByKey: Map<string, number>;
};

function sortMilestoneRules(milestones: MilestonePayoutRuleWithOrder[]) {
  return [...milestones].sort(
    (a, b) => (b.target_views || 0) - (a.target_views || 0),
  );
}

export function milestoneWinnerCountKey(
  platform: string | null | undefined,
  targetViews: number,
): string {
  const p = videoContestPlatformFromValue(platform) ?? "_";
  return `${p}:${targetViews}`;
}

export function winnerCountsByTargetForPlatform(
  winnerCountsByKey: Map<string, number>,
  platform: string | null | undefined,
): Map<number, number> {
  const platforms = parseVideoContestPlatforms(platform);
  const prefixes =
    platforms.length === 1
      ? [`${platforms[0]}:`]
      : platforms.length > 1
        ? platforms.map((p) => `${p}:`)
        : [`_:`];
  const out = new Map<number, number>();
  for (const [key, count] of winnerCountsByKey) {
    const prefix = prefixes.find((p) => key.startsWith(p));
    if (!prefix) continue;
    const target = Number(key.slice(prefix.length));
    if (!Number.isFinite(target)) continue;
    out.set(target, (out.get(target) || 0) + count);
  }
  return out;
}

function formatMilestoneLabel(
  milestone: MilestonePayoutRuleWithOrder,
  payoutCents: number,
): string {
  const targetViews = Number(milestone.target_views || 0);
  const targetLabel = `${targetViews.toLocaleString()} views`;
  const payoutLabel = `$${(payoutCents / 100).toFixed(2)}`;
  const milestoneOrder = Number(milestone.order);
  const hasMilestoneOrder =
    Number.isFinite(milestoneOrder) && milestoneOrder > 0;
  return hasMilestoneOrder
    ? `Milestone ${milestoneOrder} • ${targetLabel} • ${payoutLabel}`
    : `Milestone • ${targetLabel} • ${payoutLabel}`;
}

export function assignMilestonePayouts(
  submissions: MilestoneBudgetSubmission[],
  getMilestones: (
    sub: MilestoneBudgetSubmission,
  ) => MilestonePayoutRuleWithOrder[],
  options?: { fcfsScope?: "platform" | "contest" },
): MilestonePayoutAssignments {
  const payoutMap = new Map<string, number>();
  const labelMap = new Map<string, string>();
  const winnerCountsByKey = new Map<string, number>();
  if (!submissions?.length) {
    return { payoutMap, labelMap, winnerCountsByKey };
  }
  const fcfsScope = options?.fcfsScope ?? "platform";

  const eligible = [...submissions]
    .filter((s) => {
      const status = normalizeStatus(s.status);
      return (
        (status === "pending" || status === "verified" || status === "paid") &&
        (s.deleted_at == null || s.deleted_at === "")
      );
    })
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  for (const submission of eligible) {
    const milestones = sortMilestoneRules(getMilestones(submission));
    const views = getMilestoneEligibleViewsFromRow(submission);
    let payoutCents = 0;
    let label = "—";

    for (const milestone of milestones) {
      const targetViews = Number(milestone.target_views || 0);
      if (views < targetViews) continue;
      if (milestone.winner_limit != null) {
        const key = milestoneWinnerCountKey(
          fcfsScope === "contest" ? null : submission.platform,
          targetViews,
        );
        const current = winnerCountsByKey.get(key) || 0;
        if (current >= milestone.winner_limit) continue;
        winnerCountsByKey.set(key, current + 1);
      }
      payoutCents = Number(milestone.payout_cents || 0);
      label = formatMilestoneLabel(milestone, payoutCents);
      break;
    }

    payoutMap.set(submission.id, payoutCents);
    labelMap.set(submission.id, label);
  }

  return { payoutMap, labelMap, winnerCountsByKey };
}

export function buildMilestoneSubmissionPayoutAssignmentsFromDetails(
  submissions: MilestoneBudgetSubmission[],
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv?: string | null,
): MilestonePayoutAssignments {
  return assignMilestonePayouts(submissions, (sub) => {
    const cfg = resolveMilestoneContestForPlatform(
      details,
      sub.platform,
      contestPlatformCsv,
    );
    return cfg?.milestones ?? [];
  });
}

export function buildMilestoneSubmissionPayoutCentsMapFromDetails(
  submissions: MilestoneBudgetSubmission[],
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv?: string | null,
): Map<string, number> {
  return buildMilestoneSubmissionPayoutAssignmentsFromDetails(
    submissions,
    details,
    contestPlatformCsv,
  ).payoutMap;
}

/**
 * Per-submission milestone payout (cents), FCFS by created_at.
 * Pending/verified/paid compete for winner_limit; aligns with contest detail map.
 */
export function buildMilestoneSubmissionPayoutCentsMap(
  submissions: MilestoneBudgetSubmission[],
  milestones: MilestonePayoutRule[],
): Map<string, number> {
  if (!submissions?.length || !milestones?.length) return new Map();
  return assignMilestonePayouts(submissions, () => milestones, {
    fcfsScope: "contest",
  }).payoutMap;
}

/** True when milestone slots are FCFS across the whole contest (requires contest-wide scan). */
export function milestonesRequireContestWideFcfs(
  milestones: Pick<MilestonePayoutRule, "winner_limit">[],
): boolean {
  return milestones.some(
    (m) => m.winner_limit != null && Number(m.winner_limit) > 0,
  );
}

/** True when any platform (or root) ladder uses winner_limit FCFS. */
export function contestMilestonesRequireWinnerLimitFcfs(
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv?: string | null,
): boolean {
  for (const platform of VIDEO_CONTEST_PLATFORMS) {
    const cfg = resolveMilestoneContestForPlatform(
      details,
      platform,
      contestPlatformCsv,
    );
    if (cfg && milestonesRequireContestWideFcfs(cfg.milestones)) return true;
  }
  const root = resolveMilestoneContestForPlatform(
    details,
    null,
    contestPlatformCsv,
  );
  return root ? milestonesRequireContestWideFcfs(root.milestones) : false;
}

/** Milestone payout from views only (no winner_limit / FCFS). */
export function getMilestonePayoutCentsFromViews(
  views: number,
  milestones: MilestonePayoutRule[],
): number {
  if (!milestones?.length) return 0;
  const sortedMilestones = [...milestones].sort(
    (a, b) => (b.target_views || 0) - (a.target_views || 0),
  );
  for (const milestone of sortedMilestones) {
    if (views >= Number(milestone.target_views || 0)) {
      return Number(milestone.payout_cents || 0);
    }
  }
  return 0;
}

/**
 * Same FCFS rules as `buildMilestoneSubmissionPayoutCentsMap`, but only stores
 * payouts for one creator (one contest-wide pass, no full Map for every submission).
 */
export function buildMilestoneSubmissionPayoutCentsMapForCreator(
  submissions: MilestoneBudgetSubmission[],
  milestones: MilestonePayoutRule[],
  creatorId: string,
): Map<string, number> {
  const result = new Map<string, number>();
  if (!submissions?.length || !milestones?.length) return result;

  const sortedMilestones = [...milestones].sort(
    (a, b) => (b.target_views || 0) - (a.target_views || 0),
  );
  const winnerCountsByMilestone = new Map<number, number>();
  const creatorKey = String(creatorId);

  const eligible = submissions
    .map((s) => ({
      id: s.id,
      creator_id: s.creator_id,
      created_at: s.created_at,
      status: normalizeStatus(s.status),
      deleted_at: s.deleted_at,
      views: getMilestoneEligibleViewsFromRow({
        views: s.views,
        platform: s.platform,
        other_stats: s.other_stats,
      }),
    }))
    .filter(
      (s) =>
        (s.status === "pending" ||
          s.status === "verified" ||
          s.status === "paid") &&
        (s.deleted_at == null || s.deleted_at === ""),
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

  for (const submission of eligible) {
    let payoutCents = 0;
    const submissionViews = submission.views;

    for (const milestone of sortedMilestones) {
      const targetViews = Number(milestone.target_views || 0);
      if (submissionViews < targetViews) continue;

      if (milestone.winner_limit != null) {
        const currentWinners =
          winnerCountsByMilestone.get(milestone.target_views) || 0;
        if (currentWinners >= milestone.winner_limit) {
          continue;
        }
        winnerCountsByMilestone.set(
          milestone.target_views,
          currentWinners + 1,
        );
      }

      payoutCents = Number(milestone.payout_cents || 0);
      break;
    }

    if (String(submission.creator_id) === creatorKey) {
      result.set(submission.id, payoutCents);
    }
  }

  return result;
}

export function buildMilestoneSubmissionPayoutCentsMapForCreatorFromDetails(
  submissions: MilestoneBudgetSubmission[],
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv: string | null | undefined,
  creatorId: string,
): Map<string, number> {
  const all = buildMilestoneSubmissionPayoutCentsMapFromDetails(
    submissions,
    details,
    contestPlatformCsv,
  );
  const result = new Map<string, number>();
  const creatorKey = String(creatorId);
  for (const sub of submissions) {
    if (String(sub.creator_id) === creatorKey) {
      result.set(sub.id, all.get(sub.id) ?? 0);
    }
  }
  return result;
}

/**
 * Per-creator earnings cap in submission `created_at` order (same rule as
 * CreatorSubmissionsModal expectedRewardsMap for milestone).
 */
export function getMilestoneCappedPayoutCentsForCreatorSubmission(
  payoutMap: Map<string, number>,
  creatorSubmissions: {
    id: string;
    created_at: string;
    platform?: string | null;
  }[],
  maxEarningsPerCreator: number | null | undefined,
  targetSubmissionId: string,
  getMaxForSubmission?: (
    sub: { platform?: string | null },
  ) => number | null | undefined,
): number {
  const sorted = [...creatorSubmissions].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const contestWideMax =
    maxEarningsPerCreator != null &&
    typeof maxEarningsPerCreator === "number" &&
    maxEarningsPerCreator > 0
      ? maxEarningsPerCreator
      : null;

  const runningByKey = new Map<string, number>();
  for (const s of sorted) {
    const base = Math.max(0, Number(payoutMap.get(s.id) ?? 0) || 0);
    const platformMax = getMaxForSubmission?.(s);
    const max =
      platformMax != null && Number(platformMax) > 0
        ? Number(platformMax)
        : contestWideMax;
    const runKey =
      getMaxForSubmission != null
        ? String(s.platform || "").toLowerCase() || "_"
        : "_";
    const runningApplied = runningByKey.get(runKey) || 0;
    let capped = base;
    if (max != null) {
      const remaining = max - runningApplied;
      if (remaining <= 0) {
        capped = 0;
      } else if (base > remaining) {
        capped = remaining;
      }
      const amountApplied = Math.min(base, Math.max(0, remaining));
      runningByKey.set(runKey, runningApplied + amountApplied);
    }
    if (s.id === targetSubmissionId) {
      return capped;
    }
  }
  return 0;
}

/** Sum map values for verified / paid / approved only (pending excluded from liability). */
export function sumMilestoneVerifiedExpectedPayoutCents(
  payoutMap: Map<string, number>,
  submissions: MilestoneBudgetSubmission[],
): number {
  let sum = 0;
  for (const sub of submissions) {
    if (sub.deleted_at != null && sub.deleted_at !== "") continue;
    const st = normalizeStatus(sub.status);
    if (st !== "verified" && st !== "paid") continue;
    sum += payoutMap.get(sub.id) ?? 0;
  }
  return sum;
}

export type MilestoneBonusConfig = {
  enabled?: boolean;
  most_verified_reels?: {
    payout_cents?: number;
    min_verified_reels?: number;
    min_total_views?: number;
  } | null;
  most_verified_views?: {
    payout_cents?: number;
    min_total_views?: number;
    min_verified_reels?: number;
  } | null;
};

/** Per-creator most-verified bonus row — matches contest detail creator-wise columns. */
export type MilestoneMostVerifiedBonusCreatorRow = {
  expectedCents: number;
  paidCents: number;
  viewsExpectedCents: number;
  viewsPaidCents: number;
  verifiedReels: number;
  minRequired: number;
};

export type MilestoneMostVerifiedBonusPaidByCreator = Record<
  string,
  {
    viewsPaidCents?: number;
    reelsPaidCents?: number;
  }
>;

/** Same flags as UI / mark-bonus API so inferred "paid" caps match actual credits. */
export type MilestoneMostVerifiedBonusMapAdjustment = {
  shouldAdjustMostVerifiedMilestoneBonus: boolean;
  percentage: number;
};

/**
 * Per-creator expected vs paid for milestone "most verified views" / "most verified reels"
 * bonuses (same allocation rules as contest-detail-client milestoneReelsBonusByCreator).
 */
export function buildMilestoneMostVerifiedBonusByCreatorMap(
  submissions: MilestoneBudgetSubmission[],
  bonus: MilestoneBonusConfig | null | undefined,
  paidByCreatorTrack?: MilestoneMostVerifiedBonusPaidByCreator,
  mvBonusAdjustment?: MilestoneMostVerifiedBonusMapAdjustment | null,
): Map<string, MilestoneMostVerifiedBonusCreatorRow> {
  const empty = new Map<string, MilestoneMostVerifiedBonusCreatorRow>();
  if (!bonus?.enabled) return empty;

  const reelsConfig = bonus.most_verified_reels;
  const viewsConfig = bonus.most_verified_views;
  const hasReels = Boolean(reelsConfig);
  const hasViews = Boolean(viewsConfig);
  if (!hasReels && !hasViews) return empty;

  const reelsPayout = Number(reelsConfig?.payout_cents || 0);
  const reelsMin = Number(reelsConfig?.min_verified_reels || 0);
  const reelsMinViews = Number(reelsConfig?.min_total_views || 0);
  const viewsMin = Number(viewsConfig?.min_total_views || 0);
  const viewsMinReels = Number(viewsConfig?.min_verified_reels || 0);
  const viewsPayout = Number(viewsConfig?.payout_cents || 0);

  const mvAdj = mvBonusAdjustment ?? null;
  const mvAdjustArg = {
    shouldAdjustBonus: Boolean(mvAdj?.shouldAdjustMostVerifiedMilestoneBonus),
    percentage: Number(mvAdj?.percentage ?? 0),
  };
  const viewsCap = adjustBonusCents(viewsPayout, mvAdjustArg);
  const reelsCap = adjustBonusCents(reelsPayout, mvAdjustArg);

  type CreatorAgg = {
    creatorId: string;
    verifiedReels: number;
    totalVerifiedViews: number;
    reelsReachedAt: number;
    viewsReachedAt: number;
    verifiedEvents: Array<{ createdAtMs: number; views: number }>;
    totalPaidBonusCents: number;
    viewsPaidCentsFromMetadata: number;
    reelsPaidCentsFromMetadata: number;
    /** Any bonus_paid row exposed a `milestone_bonus_paid` object (zeros are meaningful after reversals). */
    hasExplicitMilestoneBonusPaidBreakdown: boolean;
  };

  const creators = new Map<string, CreatorAgg>();

  for (const sub of submissions) {
    const creatorId = String(sub.creator_id ?? "").trim();
    if (!creatorId) continue;
    if (sub.deleted_at != null && sub.deleted_at !== "") continue;

    if (!creators.has(creatorId)) {
      creators.set(creatorId, {
        creatorId,
        verifiedReels: 0,
        totalVerifiedViews: 0,
        reelsReachedAt: Number.POSITIVE_INFINITY,
        viewsReachedAt: Number.POSITIVE_INFINITY,
        verifiedEvents: [],
        totalPaidBonusCents: 0,
        viewsPaidCentsFromMetadata: 0,
        reelsPaidCentsFromMetadata: 0,
        hasExplicitMilestoneBonusPaidBreakdown: false,
      });
    }
    const agg = creators.get(creatorId)!;
    const subStatus = normalizeStatus(sub.status);
    if (sub.bonus_paid === true && isVerifiedLike(subStatus)) {
      agg.totalPaidBonusCents += Number(sub.bonus_amount || 0);
      const milestoneBonusPaid =
        sub?.milestone_bonus_paid ?? sub?.metadata?.milestone_bonus_paid;
      if (milestoneBonusPaid && typeof milestoneBonusPaid === "object") {
        agg.hasExplicitMilestoneBonusPaidBreakdown = true;
        agg.viewsPaidCentsFromMetadata += Number(milestoneBonusPaid.views || 0);
        agg.reelsPaidCentsFromMetadata += Number(milestoneBonusPaid.reels || 0);
      }
    }

    const st = subStatus;
    if (!isVerifiedLike(st)) continue;

    const views = getMilestoneEligibleViewsFromRow({
      views: sub.views,
      platform: sub.platform,
      other_stats: sub.other_stats,
    });
    const createdAtMs = Number.isNaN(new Date(sub.created_at).getTime())
      ? Number.POSITIVE_INFINITY
      : new Date(sub.created_at).getTime();
    agg.verifiedReels += 1;
    agg.totalVerifiedViews += views;
    agg.verifiedEvents.push({ createdAtMs, views });
  }

  creators.forEach((agg) => {
    if (agg.verifiedEvents.length === 0) return;
    const sortedEvents = [...agg.verifiedEvents].sort(
      (a, b) => a.createdAtMs - b.createdAtMs,
    );
    let runningViews = 0;
    sortedEvents.forEach((event, index) => {
      runningViews += event.views;
      if (
        reelsMin > 0 &&
        index + 1 >= reelsMin &&
        agg.reelsReachedAt === Number.POSITIVE_INFINITY
      ) {
        agg.reelsReachedAt = event.createdAtMs;
      }
      if (
        viewsMin > 0 &&
        runningViews >= viewsMin &&
        agg.viewsReachedAt === Number.POSITIVE_INFINITY
      ) {
        agg.viewsReachedAt = event.createdAtMs;
      }
    });
  });

  const allCreators = Array.from(creators.values());
  const eligibleReels = !reelsConfig
    ? []
    : allCreators.filter((agg) => {
        if (reelsMin > 0 && agg.verifiedReels < reelsMin) return false;
        if (reelsMinViews > 0 && agg.totalVerifiedViews < reelsMinViews)
          return false;
        return true;
      });
  eligibleReels.sort((a, b) => {
    if (b.verifiedReels !== a.verifiedReels) {
      return b.verifiedReels - a.verifiedReels;
    }
    if (b.totalVerifiedViews !== a.totalVerifiedViews) {
      return b.totalVerifiedViews - a.totalVerifiedViews;
    }
    if (a.reelsReachedAt !== b.reelsReachedAt) {
      return a.reelsReachedAt - b.reelsReachedAt;
    }
    return String(a.creatorId).localeCompare(String(b.creatorId));
  });
  const reelsWinnerId = eligibleReels[0]?.creatorId || null;

  const eligibleViews = !viewsConfig
    ? []
    : allCreators.filter((agg) => {
        if (viewsMin > 0 && agg.totalVerifiedViews < viewsMin) return false;
        if (viewsMinReels > 0 && agg.verifiedReels < viewsMinReels)
          return false;
        if (viewsMin <= 0 && viewsMinReels <= 0) return false;
        return true;
      });
  eligibleViews.sort((a, b) => {
    if (b.totalVerifiedViews !== a.totalVerifiedViews) {
      return b.totalVerifiedViews - a.totalVerifiedViews;
    }
    if (b.verifiedReels !== a.verifiedReels) {
      return b.verifiedReels - a.verifiedReels;
    }
    if (a.viewsReachedAt !== b.viewsReachedAt) {
      return a.viewsReachedAt - b.viewsReachedAt;
    }
    return String(a.creatorId).localeCompare(String(b.creatorId));
  });
  const viewsWinnerId = eligibleViews[0]?.creatorId || null;

  creators.forEach((agg, creatorId) => {
    let resolvedLedger:
      | { viewsPaidCents?: number; reelsPaidCents?: number }
      | undefined;
    if (paidByCreatorTrack) {
      if (
        Object.prototype.hasOwnProperty.call(paidByCreatorTrack, creatorId)
      ) {
        resolvedLedger = paidByCreatorTrack[creatorId];
      } else {
        const hit = Object.entries(paidByCreatorTrack).find(
          ([k]) => String(k).trim() === creatorId,
        );
        resolvedLedger = hit?.[1];
      }
    }
    const useCreatorLedgerResolved = resolvedLedger !== undefined;
    const viewsPaidFromTrack = Number(resolvedLedger?.viewsPaidCents || 0);
    const reelsPaidFromTrack = Number(resolvedLedger?.reelsPaidCents || 0);

    const viewsPaidFromMetadata = Number(agg.viewsPaidCentsFromMetadata || 0);
    const reelsPaidFromMetadata = Number(agg.reelsPaidCentsFromMetadata || 0);

    // Granted follows wallet ledger per track only (money_transactions). Submission
    // milestone_bonus_paid can remain set on pending rows after moderation.
    const viewsPaidCandidate = useCreatorLedgerResolved ? viewsPaidFromTrack : 0;
    const reelsPaidCandidate = useCreatorLedgerResolved
      ? reelsPaidFromTrack
      : 0;

    const hasActiveVerifiedSubs = agg.verifiedReels > 0;

    // Expected follows current leaderboard winner; granted only while creator still has
    // verified/paid subs in the MV race (pending-only creators must not show stale grants).
    const viewsPaidCents =
      hasActiveVerifiedSubs && viewsCap > 0
        ? Math.min(Math.max(0, viewsPaidCandidate), viewsCap)
        : 0;
    const paidCents =
      hasActiveVerifiedSubs && reelsCap > 0
        ? Math.min(Math.max(0, reelsPaidCandidate), reelsCap)
        : 0;

    empty.set(creatorId, {
      expectedCents: creatorId === reelsWinnerId ? reelsPayout : 0,
      paidCents,
      viewsExpectedCents: creatorId === viewsWinnerId ? viewsPayout : 0,
      viewsPaidCents,
      verifiedReels: agg.verifiedReels,
      minRequired: reelsMin,
    });
  });

  return empty;
}

/**
 * Expected creator bonus (views + reels tracks), cents — same rules as contest detail.
 */
export function computeMilestoneCreatorBonusExpectedCents(
  submissions: MilestoneBudgetSubmission[],
  bonus: MilestoneBonusConfig | null | undefined,
): number {
  const map = buildMilestoneMostVerifiedBonusByCreatorMap(submissions, bonus);
  let total = 0;
  map.forEach((row) => {
    total += row.viewsExpectedCents + row.expectedCents;
  });
  return total;
}

function milestoneBonusPlatforms(
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv?: string | null,
): string[] {
  const ordered = parseVideoContestPlatforms(contestPlatformCsv);
  if (ordered.length >= 2) return ordered;
  if (ordered.length === 1) return ordered;
  return VIDEO_CONTEST_PLATFORMS.filter((platform) => {
    const cfg = resolveMilestoneContestForPlatform(
      details,
      platform,
      contestPlatformCsv,
    );
    return Boolean(cfg?.bonus && (cfg.bonus as MilestoneBonusConfig).enabled);
  });
}

export function collectMilestoneBonusConfigs(
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv?: string | null,
): MilestoneBonusConfig[] {
  const platforms = milestoneBonusPlatforms(details, contestPlatformCsv);
  const configs: MilestoneBonusConfig[] = [];
  const seen = new Set<string>();
  for (const platform of platforms.length > 0 ? platforms : [null]) {
    const cfg = resolveMilestoneContestForPlatform(
      details,
      platform,
      contestPlatformCsv,
    );
    const bonus = cfg?.bonus as MilestoneBonusConfig | undefined;
    if (!bonus?.enabled) continue;
    const key = JSON.stringify(bonus);
    if (seen.has(key)) continue;
    seen.add(key);
    configs.push(bonus);
  }
  return configs;
}

function emptyMilestoneBonusRow(
  minRequired = 0,
): MilestoneMostVerifiedBonusCreatorRow {
  return {
    expectedCents: 0,
    paidCents: 0,
    viewsExpectedCents: 0,
    viewsPaidCents: 0,
    verifiedReels: 0,
    minRequired,
  };
}

/**
 * Most-verified creator bonus using each platform's milestone bonus config.
 * Paid ledger is applied once after expected amounts are merged.
 */
export function buildMilestoneMostVerifiedBonusByCreatorMapFromDetails(
  submissions: MilestoneBudgetSubmission[],
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv?: string | null,
  paidByCreatorTrack?: MilestoneMostVerifiedBonusPaidByCreator,
  mvBonusAdjustment?: MilestoneMostVerifiedBonusMapAdjustment | null,
): Map<string, MilestoneMostVerifiedBonusCreatorRow> {
  const platforms = milestoneBonusPlatforms(details, contestPlatformCsv);
  const multi = platforms.length >= 2;
  if (!multi) {
    const bonus = resolveMilestoneContestForPlatform(
      details,
      platforms[0] ?? null,
      contestPlatformCsv,
    )?.bonus as MilestoneBonusConfig | undefined;
    return buildMilestoneMostVerifiedBonusByCreatorMap(
      submissions,
      bonus,
      paidByCreatorTrack,
      mvBonusAdjustment,
    );
  }

  const merged = new Map<string, MilestoneMostVerifiedBonusCreatorRow>();
  let viewsPayoutCap = 0;
  let reelsPayoutCap = 0;
  const mvAdj = mvBonusAdjustment ?? null;
  const mvAdjustArg = {
    shouldAdjustBonus: Boolean(mvAdj?.shouldAdjustMostVerifiedMilestoneBonus),
    percentage: Number(mvAdj?.percentage ?? 0),
  };

  for (const platform of platforms) {
    const bonus = resolveMilestoneContestForPlatform(
      details,
      platform,
      contestPlatformCsv,
    )?.bonus as MilestoneBonusConfig | undefined;
    if (!bonus?.enabled) continue;
    if (bonus.most_verified_views) {
      viewsPayoutCap += adjustBonusCents(
        Number(bonus.most_verified_views.payout_cents || 0),
        mvAdjustArg,
      );
    }
    if (bonus.most_verified_reels) {
      reelsPayoutCap += adjustBonusCents(
        Number(bonus.most_verified_reels.payout_cents || 0),
        mvAdjustArg,
      );
    }
    const platformSubs = submissions.filter(
      (sub) => videoContestPlatformFromValue(sub.platform) === platform,
    );
    const map = buildMilestoneMostVerifiedBonusByCreatorMap(
      platformSubs,
      bonus,
      undefined,
      mvBonusAdjustment,
    );
    map.forEach((row, creatorId) => {
      const current = merged.get(creatorId) ?? emptyMilestoneBonusRow();
      merged.set(creatorId, {
        expectedCents: current.expectedCents + row.expectedCents,
        paidCents: 0,
        viewsExpectedCents:
          current.viewsExpectedCents + row.viewsExpectedCents,
        viewsPaidCents: 0,
        verifiedReels: current.verifiedReels + row.verifiedReels,
        minRequired: Math.max(current.minRequired, row.minRequired),
      });
    });
  }

  merged.forEach((row, creatorId) => {
    let resolvedLedger:
      | { viewsPaidCents?: number; reelsPaidCents?: number }
      | undefined;
    if (paidByCreatorTrack) {
      if (Object.prototype.hasOwnProperty.call(paidByCreatorTrack, creatorId)) {
        resolvedLedger = paidByCreatorTrack[creatorId];
      } else {
        const hit = Object.entries(paidByCreatorTrack).find(
          ([k]) => String(k).trim() === creatorId,
        );
        resolvedLedger = hit?.[1];
      }
    }
    const hasActiveVerifiedSubs = row.verifiedReels > 0;
    const viewsPaidCandidate = Number(resolvedLedger?.viewsPaidCents || 0);
    const reelsPaidCandidate = Number(resolvedLedger?.reelsPaidCents || 0);
    merged.set(creatorId, {
      ...row,
      viewsPaidCents:
        hasActiveVerifiedSubs && viewsPayoutCap > 0
          ? Math.min(Math.max(0, viewsPaidCandidate), viewsPayoutCap)
          : 0,
      paidCents:
        hasActiveVerifiedSubs && reelsPayoutCap > 0
          ? Math.min(Math.max(0, reelsPaidCandidate), reelsPayoutCap)
          : 0,
    });
  });

  return merged;
}

/**
 * Total expected spend in **cents** (milestone ladder for verified/paid only + creator bonuses).
 * Matches contest detail BudgetProgress inputs when using the same submissions set.
 */
export function computeMilestoneContestExpectedSpendCents(
  submissions: MilestoneBudgetSubmission[],
  milestoneContest: {
    milestones?: MilestonePayoutRule[];
    bonus?: MilestoneBonusConfig;
  } | null |
    undefined,
): number {
  const milestones = milestoneContest?.milestones;
  if (!milestones?.length) return 0;

  const map = buildMilestoneSubmissionPayoutCentsMap(submissions, milestones);
  // Paid-first blending for milestone ladder:
  // - If submission is paid and has stored earnings, use paid amount.
  // - Otherwise use expected milestone payout.
  let ladder = 0;
  for (const sub of submissions) {
    if (sub.deleted_at != null && sub.deleted_at !== "") continue;
    const st = normalizeStatus(sub.status);
    if (st !== "verified" && st !== "paid") continue;

    const isPaidLike =
      st === "paid" || sub.paid === true || Boolean(sub.paid_at);
    const paidEarningsCents = Number(sub.earnings || 0);

    if (isPaidLike && paidEarningsCents > 0) {
      ladder += paidEarningsCents;
    } else {
      ladder += map.get(sub.id) ?? 0;
    }
  }
  const bonus = computeMilestoneCreatorBonusExpectedCents(
    submissions,
    milestoneContest?.bonus,
  );
  return ladder + bonus;
}

/**
 * Same paid-first ladder spend as `computeMilestoneContestExpectedSpendCents`,
 * but each submission uses its platform's milestone ladder.
 */
export function computeMilestoneContestExpectedSpendCentsFromDetails(
  submissions: MilestoneBudgetSubmission[],
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv?: string | null,
): number {
  const map = buildMilestoneSubmissionPayoutCentsMapFromDetails(
    submissions,
    details,
    contestPlatformCsv,
  );

  let ladder = 0;
  for (const sub of submissions) {
    if (sub.deleted_at != null && sub.deleted_at !== "") continue;
    const st = normalizeStatus(sub.status);
    if (st !== "verified" && st !== "paid") continue;

    const isPaidLike =
      st === "paid" || sub.paid === true || Boolean(sub.paid_at);
    const paidEarningsCents = Number(sub.earnings || 0);

    if (isPaidLike && paidEarningsCents > 0) {
      ladder += paidEarningsCents;
    } else {
      ladder += map.get(sub.id) ?? 0;
    }
  }
  const bonus = computeMilestoneCreatorBonusExpectedCentsFromDetails(
    submissions,
    details,
    contestPlatformCsv,
  );
  return ladder + bonus;
}

export function computeMilestoneCreatorBonusExpectedCentsFromDetails(
  submissions: MilestoneBudgetSubmission[],
  details: Record<string, unknown> | null | undefined,
  contestPlatformCsv?: string | null,
): number {
  const map = buildMilestoneMostVerifiedBonusByCreatorMapFromDetails(
    submissions,
    details,
    contestPlatformCsv,
  );
  let total = 0;
  map.forEach((row) => {
    total += row.viewsExpectedCents + row.expectedCents;
  });
  return total;
}

/** Sum paid most-verified views + reels bonus for creators (matches creator-wise table). */
export function getMilestoneMostVerifiedBonusGrantedByTrackForCreators(
  map: Map<string, MilestoneMostVerifiedBonusCreatorRow>,
  creatorIds: Iterable<string>,
): { viewsCents: number; reelsCents: number; totalCents: number } {
  const seen = new Set<string>();
  let viewsCents = 0;
  let reelsCents = 0;
  for (const rawId of creatorIds) {
    const id = String(rawId ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    let row = map.get(id);
    if (!row) {
      for (const [key, value] of map) {
        if (String(key).trim() === id) {
          row = value;
          break;
        }
      }
    }
    if (!row) continue;
    viewsCents += Number(row.viewsPaidCents) || 0;
    reelsCents += Number(row.paidCents) || 0;
  }
  return { viewsCents, reelsCents, totalCents: viewsCents + reelsCents };
}

export function sumMilestoneMostVerifiedBonusGrantedForCreators(
  map: Map<string, MilestoneMostVerifiedBonusCreatorRow>,
  creatorIds: Iterable<string>,
): number {
  return getMilestoneMostVerifiedBonusGrantedByTrackForCreators(map, creatorIds)
    .totalCents;
}
