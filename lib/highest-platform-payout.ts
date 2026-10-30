/**
 * "Pay creators for their highest-earning platform only" (multi-platform video
 * campaigns). When the campaign switch is on, each creator is paid for ONE
 * platform: the one whose total earnings are highest. Every other platform's
 * submissions count $0.
 *
 * Fixed order used by every screen and payout path:
 *   1. Per-submission amounts exactly as today (CPM, milestone FCFS slots,
 *      flat-fee bonus FCFS, most-verified bonus).
 *   2. That platform's max-earnings cap (applied per platform, created_at order).
 *   3. Sum per platform per creator → highest wins; ties go to the platform
 *      listed first on the campaign.
 *   4. Other platforms → $0 (nothing is reassigned to other creators).
 *   5. Payout adjustment % is applied afterwards by the caller.
 *
 * Verified/paid submissions decide the winner. A creator with nothing verified
 * yet gets a provisional winner from their pending submissions. Once a creator
 * has been paid on a platform, that platform stays their winner.
 */
import { computeCpmRawCentsForRow } from "@/lib/cpm-expected-cents";
import {
  buildMilestoneMostVerifiedBonusByCreatorMap,
  buildMilestoneSubmissionPayoutCentsMapFromDetails,
  type MilestoneBonusConfig,
} from "@/lib/milestone-contest-expected-spend";
import { buildFlatFeeBonusExpectedCentsBySubmissionId } from "@/lib/twitter-cpm-bonus-expected";
import {
  VIDEO_PLATFORM_LABELS,
  parseVideoContestPlatforms,
  resolveMaxEarningsCentsForSubmission,
  resolveMilestoneContestForPlatform,
  videoContestPlatformFromValue,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

export const HIGHEST_PLATFORM_PAYOUT_KEY = "highest_platform_payout_only";

/** Campaign types that can use the switch (leaderboard is not supported). */
export const HIGHEST_PLATFORM_PAYOUT_CONTEST_TYPES = [
  "cpm",
  "milestone",
  "dual_rewards",
] as const;

export type HighestPlatformContest = {
  contest_type?: string | null;
  contest_format?: string | null;
  platform?: string | null;
  contest_based_details?: unknown;
  max_earnings_per_creator?: unknown;
  bonus_details?: unknown;
};

export type HighestPlatformSubmissionRow = {
  id: string;
  creator_id?: string | null;
  created_at?: string | null;
  status?: string | null;
  paid?: boolean | null;
  paid_at?: string | null;
  earnings?: number | null;
  bonus_amount?: number | null;
  bonus_paid?: boolean | null;
  deleted_at?: string | null;
  views?: number | null;
  platform?: string | null;
  other_stats?: unknown;
};

export type CreatorPlatformDecision = {
  creatorId: string;
  /** Platform the creator is paid for; null when nothing is earned anywhere. */
  winner: VideoContestPlatform | null;
  /** Each platform's total (after caps, before payout adjustment), cents. */
  totalsCents: Partial<Record<VideoContestPlatform, number>>;
  /** Decided from pending submissions only (nothing verified yet). */
  provisional: boolean;
  /** Winner fixed because the creator was already paid on it. */
  lockedByPayment: boolean;
};

export type HighestPlatformDecisions = {
  enabled: boolean;
  /** Campaign platforms in tie-break order (contests.platform CSV order). */
  platforms: VideoContestPlatform[];
  byCreator: Map<string, CreatorPlatformDecision>;
  /** Submissions that do not count because another platform wins. */
  excludedSubmissionIds: Set<string>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readHighestPlatformPayoutFlag(details: unknown): boolean {
  return asRecord(details)?.[HIGHEST_PLATFORM_PAYOUT_KEY] === true;
}

/** Whether a campaign with these settings may offer the switch. */
export function canUseHighestPlatformPayout(
  contestType: string | null | undefined,
  platformCount: number,
  contestFormat?: string | null,
): boolean {
  return (
    platformCount >= 2 &&
    contestFormat !== "text_image" &&
    (HIGHEST_PLATFORM_PAYOUT_CONTEST_TYPES as readonly string[]).includes(
      String(contestType || ""),
    )
  );
}

/** The one gate every surface uses. */
export function isHighestPlatformPayoutOnly(
  contest: HighestPlatformContest | null | undefined,
): boolean {
  if (!contest) return false;
  if (!readHighestPlatformPayoutFlag(contest.contest_based_details)) {
    return false;
  }
  return canUseHighestPlatformPayout(
    contest.contest_type,
    parseVideoContestPlatforms(contest.platform).length,
    contest.contest_format,
  );
}

/** Platform a submission counts toward (unknown/missing → campaign's first). */
export function highestPlatformBucket(
  rawPlatform: string | null | undefined,
  campaignPlatforms: VideoContestPlatform[],
): VideoContestPlatform | null {
  return (
    videoContestPlatformFromValue(rawPlatform) ?? campaignPlatforms[0] ?? null
  );
}

function normalizeStatus(raw: string | null | undefined): string {
  const st = String(raw || "pending").toLowerCase();
  return st === "approved" ? "verified" : st;
}

function isDeleted(row: HighestPlatformSubmissionRow): boolean {
  return row.deleted_at != null && row.deleted_at !== "";
}

/** Any money already credited on this submission (reward or bonus). */
function isPaidRow(row: HighestPlatformSubmissionRow): boolean {
  return (
    row.paid === true ||
    row.bonus_paid === true ||
    normalizeStatus(row.status) === "paid"
  );
}

function createdAtMs(row: HighestPlatformSubmissionRow): number {
  const t = row.created_at ? new Date(row.created_at).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

export function emptyHighestPlatformDecisions(): HighestPlatformDecisions {
  return {
    enabled: false,
    platforms: [],
    byCreator: new Map(),
    excludedSubmissionIds: new Set(),
  };
}

function pickWinner(
  totals: Map<VideoContestPlatform, number>,
  order: VideoContestPlatform[],
): VideoContestPlatform | null {
  let best: VideoContestPlatform | null = null;
  let bestCents = 0;
  const rank = (p: VideoContestPlatform) => {
    const i = order.indexOf(p);
    return i === -1 ? order.length : i;
  };
  for (const [platform, cents] of totals) {
    if (cents <= 0) continue;
    if (
      best == null ||
      cents > bestCents ||
      (cents === bestCents && rank(platform) < rank(best))
    ) {
      best = platform;
      bestCents = cents;
    }
  }
  return best;
}

/**
 * Most-verified bonus per creator per platform (cents, expected). Each
 * platform runs its own race, the same way contest detail does.
 */
function buildMostVerifiedCentsByCreatorPlatform(
  contest: HighestPlatformContest,
  rows: HighestPlatformSubmissionRow[],
  platforms: VideoContestPlatform[],
): Map<string, Map<VideoContestPlatform, number>> {
  const out = new Map<string, Map<VideoContestPlatform, number>>();
  const details = asRecord(contest.contest_based_details);
  for (const platform of platforms) {
    const bonus = resolveMilestoneContestForPlatform(
      details,
      platform,
      contest.platform,
    )?.bonus as MilestoneBonusConfig | undefined;
    if (!bonus?.enabled) continue;
    const platformRows = rows.filter(
      (row) => videoContestPlatformFromValue(row.platform) === platform,
    );
    const map = buildMilestoneMostVerifiedBonusByCreatorMap(
      platformRows.map((row) => ({
        ...row,
        created_at: row.created_at || "",
      })),
      bonus,
    );
    map.forEach((row, creatorId) => {
      const cents = row.expectedCents + row.viewsExpectedCents;
      if (cents <= 0) return;
      const byPlatform = out.get(creatorId) ?? new Map();
      byPlatform.set(platform, (byPlatform.get(platform) || 0) + cents);
      out.set(creatorId, byPlatform);
    });
  }
  return out;
}

/**
 * Decide every creator's paid platform for a campaign.
 *
 * `rows` must be the campaign's FULL submission list (all creators, all
 * platforms, pending included) — never a filtered tab or page — so first-come
 * slots and the winner match on every screen.
 */
export function computeHighestPlatformDecisions(
  contest: HighestPlatformContest | null | undefined,
  rows: readonly HighestPlatformSubmissionRow[],
): HighestPlatformDecisions {
  if (!contest || !isHighestPlatformPayoutOnly(contest)) {
    return emptyHighestPlatformDecisions();
  }
  const platforms = parseVideoContestPlatforms(contest.platform);
  const details = asRecord(contest.contest_based_details);
  const contestType = String(contest.contest_type || "");
  const usesCpm = contestType === "cpm" || contestType === "dual_rewards";
  const usesMilestone =
    contestType === "milestone" || contestType === "dual_rewards";

  const liveRows = rows.filter(
    (row) =>
      row?.id &&
      !isDeleted(row) &&
      ["pending", "verified", "paid"].includes(normalizeStatus(row.status)),
  );

  const milestoneMap = usesMilestone
    ? buildMilestoneSubmissionPayoutCentsMapFromDetails(
        liveRows.map((row) => ({ ...row, created_at: row.created_at || "" })),
        details,
        contest.platform,
      )
    : new Map<string, number>();
  const flatFeeMap = buildFlatFeeBonusExpectedCentsBySubmissionId(
    {
      contest_type: contest.contest_type,
      platform: contest.platform,
      contest_based_details: details,
    },
    liveRows.map((row) => ({ ...row, paid: row.paid ?? undefined })),
  );
  const mostVerified = usesMilestone
    ? buildMostVerifiedCentsByCreatorPlatform(contest, liveRows, platforms)
    : new Map<string, Map<VideoContestPlatform, number>>();

  const byCreatorRows = new Map<string, HighestPlatformSubmissionRow[]>();
  for (const row of liveRows) {
    const creatorId = String(row.creator_id || "");
    if (!creatorId) continue;
    const list = byCreatorRows.get(creatorId) ?? [];
    list.push(row);
    byCreatorRows.set(creatorId, list);
  }

  const byCreator = new Map<string, CreatorPlatformDecision>();
  const excludedSubmissionIds = new Set<string>();

  for (const [creatorId, creatorRows] of byCreatorRows) {
    const decidingRows = creatorRows.filter((row) => {
      const st = normalizeStatus(row.status);
      return st === "verified" || st === "paid";
    });
    const provisional = decidingRows.length === 0;
    const scoreRows = (provisional ? creatorRows : decidingRows)
      .slice()
      .sort((a, b) => createdAtMs(a) - createdAtMs(b));

    const totals = new Map<VideoContestPlatform, number>();
    const capUsed = new Map<VideoContestPlatform, number>();
    for (const row of scoreRows) {
      const bucket = highestPlatformBucket(row.platform, platforms);
      if (!bucket) continue;
      let base = 0;
      if (usesCpm)
        base += computeCpmRawCentsForRow(row, details, contest.platform);
      if (usesMilestone) base += Number(milestoneMap.get(row.id) || 0);
      const cap = resolveMaxEarningsCentsForSubmission(
        contest as Parameters<typeof resolveMaxEarningsCentsForSubmission>[0],
        bucket,
      );
      if (cap != null && cap > 0) {
        const used = capUsed.get(bucket) || 0;
        const allowed = Math.max(0, Math.min(base, cap - used));
        capUsed.set(bucket, used + allowed);
        base = allowed;
      }
      const amount = base + Number(flatFeeMap.get(row.id) || 0);
      totals.set(bucket, (totals.get(bucket) || 0) + amount);
    }
    const mv = mostVerified.get(creatorId);
    if (mv && !provisional) {
      mv.forEach((cents, platform) => {
        totals.set(platform, (totals.get(platform) || 0) + cents);
      });
    }

    // A creator already paid on a platform stays on it.
    const paidTotals = new Map<VideoContestPlatform, number>();
    let firstPaidBucket: VideoContestPlatform | null = null;
    for (const row of creatorRows
      .slice()
      .sort((a, b) => createdAtMs(a) - createdAtMs(b))) {
      if (!isPaidRow(row)) continue;
      const bucket = highestPlatformBucket(row.platform, platforms);
      if (!bucket) continue;
      firstPaidBucket = firstPaidBucket ?? bucket;
      const paidCents =
        Math.max(0, Number(row.earnings) || 0) +
        (row.bonus_paid ? Math.max(0, Number(row.bonus_amount) || 0) : 0);
      paidTotals.set(bucket, (paidTotals.get(bucket) || 0) + paidCents);
    }
    const lockedWinner =
      firstPaidBucket != null
        ? (pickWinner(paidTotals, platforms) ?? firstPaidBucket)
        : null;

    const winner = lockedWinner ?? pickWinner(totals, platforms);
    const totalsCents: Partial<Record<VideoContestPlatform, number>> = {};
    totals.forEach((cents, platform) => {
      totalsCents[platform] = cents;
    });
    byCreator.set(creatorId, {
      creatorId,
      winner,
      totalsCents,
      provisional: provisional && lockedWinner == null,
      lockedByPayment: lockedWinner != null,
    });

    if (winner == null) continue;
    for (const row of creatorRows) {
      if (isPaidRow(row)) continue;
      if (highestPlatformBucket(row.platform, platforms) !== winner) {
        excludedSubmissionIds.add(String(row.id));
      }
    }
  }

  return { enabled: true, platforms, byCreator, excludedSubmissionIds };
}

/** False only when the rule is on and another platform wins for this creator. */
export function isSubmissionCountedForPayout(
  decisions: HighestPlatformDecisions | null | undefined,
  submissionId: string | null | undefined,
): boolean {
  if (!decisions?.enabled || !submissionId) return true;
  return !decisions.excludedSubmissionIds.has(String(submissionId));
}

/** Whether a creator's bonus earned on `platform` (e.g. most-verified) is paid. */
export function isCreatorPlatformCounted(
  decisions: HighestPlatformDecisions | null | undefined,
  creatorId: string | null | undefined,
  platform: string | null | undefined,
): boolean {
  if (!decisions?.enabled || !creatorId) return true;
  const decision = decisions.byCreator.get(String(creatorId));
  if (!decision?.winner) return true;
  return (
    highestPlatformBucket(platform, decisions.platforms) === decision.winner
  );
}

/** Copy of a per-submission cents map with excluded submissions set to 0. */
export function maskExcludedCents(
  map: Map<string, number>,
  decisions: HighestPlatformDecisions | null | undefined,
): Map<string, number> {
  if (!decisions?.enabled || decisions.excludedSubmissionIds.size === 0) {
    return map;
  }
  const out = new Map(map);
  decisions.excludedSubmissionIds.forEach((id) => {
    if (out.has(id)) out.set(id, 0);
  });
  return out;
}

export function highestPlatformLabel(
  platform: VideoContestPlatform | null | undefined,
): string {
  return platform ? VIDEO_PLATFORM_LABELS[platform] : "";
}

/** Short note shown wherever the rule applies. */
export function highestPlatformRuleNote(
  platforms: VideoContestPlatform[],
): string {
  const tieBreak = platforms[0]
    ? ` Ties go to ${VIDEO_PLATFORM_LABELS[platforms[0]]}.`
    : "";
  return `If you post on more than one platform, you're paid for your highest-earning platform only. Your other platforms count $0.${tieBreak}`;
}

/** Label for a submission that does not count, e.g. "Not counted · paid for YouTube". */
export function notCountedLabel(
  decision: CreatorPlatformDecision | null | undefined,
): string {
  const winner = highestPlatformLabel(decision?.winner);
  if (!winner) return "Not counted";
  if (decision?.lockedByPayment) return `Not counted · paid for ${winner}`;
  return `Not counted · ${winner} earns more`;
}

/** Response code payout routes return when a submission does not count. */
export const HIGHEST_PLATFORM_NOT_COUNTED_CODE = "HIGHEST_PLATFORM_NOT_COUNTED";

/** Admin-facing reason a payout on a non-winning platform was refused or skipped. */
export function highestPlatformNotPayableMessage(
  decision: CreatorPlatformDecision | null | undefined,
): string {
  const winner = highestPlatformLabel(decision?.winner);
  return winner
    ? `Not counted: this creator is paid for ${winner} (their highest-earning platform).`
    : "Not counted: this creator is paid for their highest-earning platform only.";
}

/**
 * Wallet credit note for a payout on a highest-platform-only campaign: metadata
 * recording the decision, and a description suffix when the creator earned on
 * more than one platform. Null when the rule is off.
 */
export function highestPlatformPayoutLedgerNote(
  decisions: HighestPlatformDecisions | null | undefined,
  creatorId: string | null | undefined,
): {
  metadata: {
    highest_platform_payout: {
      winner: string;
      totals_cents: Partial<Record<VideoContestPlatform, number>>;
    };
  };
  descriptionSuffix: string;
} | null {
  if (!decisions?.enabled || !creatorId) return null;
  const decision = decisions.byCreator.get(String(creatorId));
  if (!decision?.winner) return null;
  const multiPlatform = Object.keys(decision.totalsCents).length >= 2;
  return {
    metadata: {
      highest_platform_payout: {
        winner: decision.winner,
        totals_cents: decision.totalsCents,
      },
    },
    descriptionSuffix: multiPlatform
      ? ` – paid for ${highestPlatformLabel(decision.winner)} (highest-earning platform)`
      : "",
  };
}

export type HighestPlatformLedgerNote = NonNullable<
  ReturnType<typeof highestPlatformPayoutLedgerNote>
>;
