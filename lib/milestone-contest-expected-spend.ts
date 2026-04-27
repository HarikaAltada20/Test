import type { MilestonePayoutRule } from "@/lib/contest-utils-client";

/** Minimal submission row for milestone budget (list / opportunities / server). */
export type MilestoneBudgetSubmission = {
  id: string;
  creator_id?: string | null;
  created_at: string;
  status?: string | null;
  deleted_at?: string | null;
  views?: number | null;
  bonus_paid?: boolean | null;
  bonus_amount?: number | null;
  metadata?: any;
};

function normalizeStatus(raw: string | null | undefined): string {
  const t = String(raw || "pending").toLowerCase();
  return t === "approved" ? "verified" : t;
}

function isVerifiedLike(st: string): boolean {
  return st === "verified" || st === "paid" || st === "approved";
}

/**
 * Per-submission milestone payout (cents), FCFS by created_at.
 * Pending/verified/paid compete for winner_limit; aligns with contest detail map.
 */
export function buildMilestoneSubmissionPayoutCentsMap(
  submissions: MilestoneBudgetSubmission[],
  milestones: MilestonePayoutRule[],
): Map<string, number> {
  const result = new Map<string, number>();
  if (!submissions?.length || !milestones?.length) return result;

  const sortedMilestones = [...milestones].sort(
    (a, b) => (b.target_views || 0) - (a.target_views || 0),
  );
  const winnerCountsByMilestone = new Map<number, number>();

  const eligible = submissions
    .map((s) => ({
      id: s.id,
      creator_id: s.creator_id,
      created_at: s.created_at,
      status: normalizeStatus(s.status),
      deleted_at: s.deleted_at,
      views: Number.isFinite(Number(s.views)) ? Number(s.views) : 0,
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

  eligible.forEach((submission) => {
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

    result.set(submission.id, payoutCents);
  });

  return result;
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

/**
 * Per-creator expected vs paid for milestone "most verified views" / "most verified reels"
 * bonuses (same allocation rules as contest-detail-client milestoneReelsBonusByCreator).
 */
export function buildMilestoneMostVerifiedBonusByCreatorMap(
  submissions: MilestoneBudgetSubmission[],
  bonus: MilestoneBonusConfig | null | undefined,
  paidByCreatorTrack?: MilestoneMostVerifiedBonusPaidByCreator,
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
  };

  const creators = new Map<string, CreatorAgg>();

  for (const sub of submissions) {
    const creatorId = sub.creator_id;
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
      });
    }
    const agg = creators.get(creatorId)!;
    if (sub.bonus_paid === true) {
      agg.totalPaidBonusCents += Number(sub.bonus_amount || 0);
    }
    const milestoneBonusPaid = sub?.metadata?.milestone_bonus_paid;
    if (milestoneBonusPaid && typeof milestoneBonusPaid === "object") {
      agg.viewsPaidCentsFromMetadata += Number(milestoneBonusPaid.views || 0);
      agg.reelsPaidCentsFromMetadata += Number(milestoneBonusPaid.reels || 0);
    }

    const st = normalizeStatus(sub.status);
    if (!isVerifiedLike(st)) continue;

    const views = Number(sub.views ?? 0);
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
    const hasTrackPaid =
      paidByCreatorTrack &&
      Object.prototype.hasOwnProperty.call(paidByCreatorTrack, creatorId);
    const trackPaid = paidByCreatorTrack?.[creatorId];
    const viewsPaidFromTrack = Number(trackPaid?.viewsPaidCents || 0);
    const reelsPaidFromTrack = Number(trackPaid?.reelsPaidCents || 0);
    const viewsPaidFromMetadata = Number(agg.viewsPaidCentsFromMetadata || 0);
    const reelsPaidFromMetadata = Number(agg.reelsPaidCentsFromMetadata || 0);
    const hasAnyTrackSpecificEvidence =
      hasTrackPaid || viewsPaidFromMetadata > 0 || reelsPaidFromMetadata > 0;

    const fallbackViewsPaid =
      creatorId === viewsWinnerId && viewsPayout > 0
        ? Math.min(agg.totalPaidBonusCents, viewsPayout)
        : 0;

    let fallbackReelsPaid = 0;
    if (creatorId === reelsWinnerId && reelsPayout > 0) {
      let unassignedPaid = agg.totalPaidBonusCents;
      if (creatorId === viewsWinnerId && viewsPayout > 0) {
        unassignedPaid = Math.max(0, unassignedPaid - viewsPayout);
      }
      fallbackReelsPaid = Math.min(unassignedPaid, reelsPayout);
    }

    const viewsPaidCandidate = hasAnyTrackSpecificEvidence
      ? Math.max(viewsPaidFromMetadata, hasTrackPaid ? viewsPaidFromTrack : 0)
      : fallbackViewsPaid;
    const reelsPaidCandidate = hasAnyTrackSpecificEvidence
      ? Math.max(reelsPaidFromMetadata, hasTrackPaid ? reelsPaidFromTrack : 0)
      : fallbackReelsPaid;

    const viewsPaidCents =
      creatorId === viewsWinnerId && viewsPayout > 0
        ? Math.min(viewsPaidCandidate, viewsPayout)
        : 0;
    const paidCents =
      creatorId === reelsWinnerId && reelsPayout > 0
        ? Math.min(reelsPaidCandidate, reelsPayout)
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
  const ladder = sumMilestoneVerifiedExpectedPayoutCents(map, submissions);
  const bonus = computeMilestoneCreatorBonusExpectedCents(
    submissions,
    milestoneContest?.bonus,
  );
  return ladder + bonus;
}
