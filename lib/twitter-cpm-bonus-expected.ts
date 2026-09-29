/**
 * Flat-fee bonus expected per submission (cents), in submission `created_at` order,
 * with global bonus budget cap. Matches admin UI / CreatorSubmissionsModal logic.
 *
 * Multi-platform: same bonus+budget → one All-tab FCFS pool. Different per-platform
 * bonus/budget → independent FCFS ladders.
 */

import {
  parseVideoContestPlatforms,
  resolveFlatFeeBonusPlan,
  flatFeeBonusLadderForSubmission,
  type FlatFeeBonusLadder,
} from "@/lib/video-platform-campaigns";

export type FlatFeeBonusSubmissionInput = {
  id: string;
  created_at?: string | null;
  is_twitter_tweet?: boolean;
  moderation_status?: string | null;
  status?: string | null;
  paid?: boolean;
  platform?: string | null;
};

export type FlatFeeBonusContestInput = {
  contest_type?: string | null;
  platform?: string | null;
  contest_based_details?: Record<string, unknown> | null;
};

function isTwitterFlatFeeBonusRow(
  submission: Pick<FlatFeeBonusSubmissionInput, "is_twitter_tweet" | "platform">,
): boolean {
  if (submission.is_twitter_tweet === true) return true;
  const platform = String(submission.platform || "").toLowerCase();
  return platform === "twitter" || platform === "x";
}

/** Normalize UI/API rows so Twitter tweets and `approved` still count as verified. */
export function toFlatFeeBonusSubmissionInput(row: {
  id?: string | null;
  created_at?: string | null;
  tweet_created_at?: string | null;
  is_twitter_tweet?: boolean;
  moderation_status?: string | null;
  status?: string | null;
  paid?: boolean;
  platform?: string | null;
}): FlatFeeBonusSubmissionInput {
  return {
    id: String(row.id || ""),
    created_at: row.created_at || row.tweet_created_at || null,
    is_twitter_tweet: isTwitterFlatFeeBonusRow(row),
    moderation_status: row.moderation_status ?? null,
    status: row.status ?? null,
    paid: row.paid === true,
    platform: row.platform ?? null,
  };
}

export function getFlatFeeBonusCentsFromContest(
  contest: FlatFeeBonusContestInput | null | undefined,
): number {
  if (!contest) return 0;
  const plan = resolveFlatFeeBonusPlan(
    contest.contest_based_details,
    contest.platform,
    contest.contest_type,
  );
  if (plan.shareAcrossAllPlatforms || plan.platforms.length < 2) {
    return plan.shared.amountCents;
  }
  const fromPlatforms = Math.max(
    0,
    ...plan.platforms.map(
      (platform) => plan.byPlatform[platform]?.amountCents || 0,
    ),
  );
  return fromPlatforms > 0 ? fromPlatforms : plan.shared.amountCents;
}

export function getFlatFeeBonusLadderForSubmission(
  contest: FlatFeeBonusContestInput | null | undefined,
  submissionPlatform?: string | null,
): FlatFeeBonusLadder {
  if (!contest) return { amountCents: 0, budgetCents: null };
  const plan = resolveFlatFeeBonusPlan(
    contest.contest_based_details,
    contest.platform,
    contest.contest_type,
  );
  return flatFeeBonusLadderForSubmission(
    plan,
    submissionPlatform,
    contest.platform,
  );
}

export function getNormalizedSubmissionStatusForFlatFeeBonus(
  submission: FlatFeeBonusSubmissionInput,
): string {
  const isTwitterTweet = isTwitterFlatFeeBonusRow(submission);
  const rawStatus =
    (isTwitterTweet
      ? submission.moderation_status || submission.status
      : submission.status || submission.moderation_status) || "pending";
  const statusLower = String(rawStatus).toLowerCase();

  if (statusLower === "paid") return "paid";
  if (statusLower === "approved" || statusLower === "verified") {
    return "verified";
  }
  if (statusLower === "rejected") return "rejected";
  return statusLower;
}

function isFlatFeeBonusEligibleStatus(
  submission: FlatFeeBonusSubmissionInput,
): boolean {
  const normalizedStatus = getNormalizedSubmissionStatusForFlatFeeBonus(
    submission,
  );
  return (
    normalizedStatus === "verified" ||
    normalizedStatus === "paid" ||
    submission.paid === true
  );
}

function allocateFlatFeeBonusWalk(
  rows: readonly FlatFeeBonusSubmissionInput[],
  amountCents: number,
  budgetCents: number | null,
  map: Map<string, number>,
): void {
  if (amountCents <= 0) {
    rows.forEach((s) => map.set(s.id, 0));
    return;
  }

  const bonusBudget =
    budgetCents != null && budgetCents > 0
      ? budgetCents
      : Number.MAX_SAFE_INTEGER;

  const sorted = [...rows].sort((a, b) => {
    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
    return at - bt;
  });

  let currentTotalExpectedBonus = 0;
  sorted.forEach((sub) => {
    if (!isFlatFeeBonusEligibleStatus(sub)) {
      map.set(sub.id, 0);
      return;
    }
    const remainingBudget = bonusBudget - currentTotalExpectedBonus;
    if (remainingBudget <= 0) {
      map.set(sub.id, 0);
      return;
    }
    if (remainingBudget >= amountCents) {
      map.set(sub.id, amountCents);
      currentTotalExpectedBonus += amountCents;
    } else {
      map.set(sub.id, remainingBudget);
      currentTotalExpectedBonus += remainingBudget;
    }
  });
}

/**
 * Expected flat-fee bonus cents per submission id (0 for ineligible rows).
 * Walks `submissions` sorted by `created_at` ascending.
 */
export function buildFlatFeeBonusExpectedCentsBySubmissionId(
  contest: FlatFeeBonusContestInput | null | undefined,
  submissions: readonly FlatFeeBonusSubmissionInput[],
): Map<string, number> {
  const map = new Map<string, number>();
  const rows = submissions.map((s) => toFlatFeeBonusSubmissionInput(s));
  if (!contest) {
    rows.forEach((s) => map.set(s.id, 0));
    return map;
  }
  if (!rows.length) return map;

  const plan = resolveFlatFeeBonusPlan(
    contest.contest_based_details,
    contest.platform,
    contest.contest_type,
  );

  if (plan.shareAcrossAllPlatforms || plan.platforms.length < 2) {
    allocateFlatFeeBonusWalk(
      rows,
      plan.shared.amountCents,
      plan.shared.budgetCents,
      map,
    );
    rows.forEach((s) => {
      if (!map.has(s.id)) map.set(s.id, 0);
    });
    return map;
  }

  rows.forEach((s) => map.set(s.id, 0));
  for (const platform of plan.platforms) {
    const ladder = plan.byPlatform[platform] ?? plan.shared;
    const platformRows = rows.filter((row) => {
      const key =
        parseVideoContestPlatforms(row.platform)[0] ??
        parseVideoContestPlatforms(contest.platform)[0];
      return key === platform;
    });
    allocateFlatFeeBonusWalk(
      platformRows,
      ladder.amountCents,
      ladder.budgetCents,
      map,
    );
  }

  return map;
}
