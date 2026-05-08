/**
 * Flat-fee bonus expected per submission (cents), in submission `created_at` order,
 * with global bonus budget cap. Matches admin UI / CreatorSubmissionsModal logic.
 */

export type FlatFeeBonusSubmissionInput = {
  id: string;
  created_at?: string | null;
  is_twitter_tweet?: boolean;
  moderation_status?: string | null;
  status?: string | null;
  paid?: boolean;
};

export type FlatFeeBonusContestInput = {
  contest_type?: string | null;
  contest_based_details?: {
    cpm_contest?: {
      flat_fee_bonus?: number;
      total_budget?: number;
      flat_fee_bonus_cap?: number | null;
    };
    leaderboard_contest?: {
      flat_fee_bonus?: number;
      total_budget?: number;
    };
  } | null;
};

export function getFlatFeeBonusCentsFromContest(
  contest: FlatFeeBonusContestInput | null | undefined,
): number {
  if (!contest) return 0;
  if (contest.contest_type === "cpm") {
    return (
      Number(
        (contest.contest_based_details as any)?.cpm_contest?.flat_fee_bonus,
      ) || 0
    );
  }
  if (contest.contest_type === "leaderboard") {
    return (
      Number(
        (contest.contest_based_details as any)?.leaderboard_contest
          ?.flat_fee_bonus,
      ) || 0
    );
  }
  return 0;
}

export function getNormalizedSubmissionStatusForFlatFeeBonus(
  submission: FlatFeeBonusSubmissionInput,
): string {
  const isTwitterTweet = submission.is_twitter_tweet === true;
  const rawStatus =
    (isTwitterTweet
      ? submission.moderation_status || submission.status
      : submission.status) || "pending";
  const statusLower = String(rawStatus).toLowerCase();

  if (isTwitterTweet) {
    if (statusLower === "paid") return "paid";
    if (statusLower === "approved" || statusLower === "verified")
      return "verified";
    if (statusLower === "rejected") return "rejected";
    return "pending";
  }

  return statusLower;
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
  if (!contest) {
    submissions.forEach((s) => map.set(s.id, 0));
    return map;
  }
  const flatFeeBonus = getFlatFeeBonusCentsFromContest(contest);
  if (flatFeeBonus <= 0 || !submissions.length) {
    submissions.forEach((s) => map.set(s.id, 0));
    return map;
  }

  const totalBudget =
    contest.contest_type === "cpm"
      ? Number(
          (contest.contest_based_details as any)?.cpm_contest?.total_budget,
        ) || 0
      : Number(
          (contest.contest_based_details as any)?.leaderboard_contest
            ?.total_budget,
        ) || 0;

  const bonusBudget =
    contest.contest_type === "cpm"
      ? Number(
          (contest.contest_based_details as any)?.cpm_contest
            ?.flat_fee_bonus_cap,
        ) || totalBudget
      : totalBudget;

  const sorted = [...submissions].sort((a, b) => {
    const at = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
    return at - bt;
  });

  let currentTotalExpectedBonus = 0;

  sorted.forEach((sub) => {
    const normalizedStatus = getNormalizedSubmissionStatusForFlatFeeBonus(sub);
    const isBonusStatus =
      normalizedStatus === "verified" ||
      normalizedStatus === "paid" ||
      sub.paid === true;

    if (isBonusStatus) {
      const remainingBudget = bonusBudget - currentTotalExpectedBonus;
      if (remainingBudget > 0) {
        if (remainingBudget >= flatFeeBonus) {
          map.set(sub.id, flatFeeBonus);
          currentTotalExpectedBonus += flatFeeBonus;
        } else {
          map.set(sub.id, remainingBudget);
          currentTotalExpectedBonus += remainingBudget;
        }
      } else {
        map.set(sub.id, 0);
      }
    } else {
      map.set(sub.id, 0);
    }
  });

  submissions.forEach((s) => {
    if (!map.has(s.id)) map.set(s.id, 0);
  });

  return map;
}
