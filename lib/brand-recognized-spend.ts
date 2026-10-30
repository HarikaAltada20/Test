import { getChargeableBudgetCents } from "@/lib/contest-chargeable-budget";
import {
  computeBudgetPaidCents,
  getPoolBudgetSpentCentsForDisplay,
  type BudgetTileSubmission,
} from "@/lib/contest-budget-tile-metrics";
import { fetchAllRows } from "@/lib/supabase-fetch-all";

export type ContestForRecognizedSpend = {
  id: string;
  status?: string | null;
  moderation_status?: string | null;
  post_contest_status?: string | null;
  contest_type?: string | null;
  platform?: string | null;
  contest_based_details?: Record<string, unknown> | null;
};

function isPublished(contest: ContestForRecognizedSpend): boolean {
  return contest.moderation_status === "published";
}

function isLiveOrUpcoming(contest: ContestForRecognizedSpend): boolean {
  return contest.status === "active" || contest.status === "upcoming";
}

function isEnded(contest: ContestForRecognizedSpend): boolean {
  return contest.status === "ended";
}

/** Full campaign budget (what’s committed while the campaign is still running). */
export function getContestBudgetCommitmentCents(
  contest: ContestForRecognizedSpend,
): number {
  return getChargeableBudgetCents({
    id: contest.id,
    contest_type: contest.contest_type,
    contest_based_details: contest.contest_based_details,
  });
}

/**
 * Best-effort “actually paid” for an ended campaign without loading submissions.
 * Uses persisted pool/budget spent trackers on the contest.
 */
export function getContestEndedPaidEstimateCents(
  contest: ContestForRecognizedSpend,
): number {
  return Math.max(
    0,
    getPoolBudgetSpentCentsForDisplay({
      contest_type: contest.contest_type,
      post_contest_status: contest.post_contest_status,
      contest_based_details: contest.contest_based_details,
      platform: contest.platform,
    }),
  );
}

/**
 * Recognized spend for one campaign:
 * - upcoming / live → full budget commitment
 * - ended → actual paid (estimate from persisted spend, or override)
 * - drafts / unpublished → 0
 */
export function getContestRecognizedSpendCents(
  contest: ContestForRecognizedSpend,
  endedPaidOverrideCents?: number,
): number {
  if (!isPublished(contest)) return 0;

  if (isLiveOrUpcoming(contest)) {
    return getContestBudgetCommitmentCents(contest);
  }

  if (isEnded(contest)) {
    if (typeof endedPaidOverrideCents === "number") {
      return Math.max(0, endedPaidOverrideCents);
    }
    return getContestEndedPaidEstimateCents(contest);
  }

  return 0;
}

export function sumRecognizedSpendCents(
  contests: ContestForRecognizedSpend[],
  endedPaidByContestId?: Map<string, number>,
): number {
  return contests.reduce((sum, contest) => {
    const override = endedPaidByContestId?.get(contest.id);
    return sum + getContestRecognizedSpendCents(contest, override);
  }, 0);
}

type PaidSubmissionRow = BudgetTileSubmission & {
  contest_id: string;
  dual_rewards_payout?: unknown;
  milestone_bonus_paid?: unknown;
};

/**
 * Sum actual creator payouts for ended contests (via computeBudgetPaidCents).
 * Used so billing “Spent” reflects money actually paid after a campaign ends.
 */
export async function fetchEndedContestPaidCentsById(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  endedContests: ContestForRecognizedSpend[],
): Promise<Map<string, number>> {
  const byId = new Map<string, number>();
  const endedContestIds = endedContests.map((c) => c.id);
  if (endedContestIds.length === 0) return byId;

  const submissionsByContest = new Map<string, BudgetTileSubmission[]>();

  const CHUNK = 100;
  for (let i = 0; i < endedContestIds.length; i += CHUNK) {
    const idChunk = endedContestIds.slice(i, i + CHUNK);
    const { data, error } = await fetchAllRows<PaidSubmissionRow>((from, to) =>
      supabase
        .from("submissions")
        .select(
          "id, contest_id, creator_id, created_at, status, paid, paid_at, earnings, views, platform, other_stats, bonus_paid, bonus_amount, dual_rewards_payout, milestone_bonus_paid, metadata",
        )
        .in("contest_id", idChunk)
        .order("id", { ascending: true })
        .range(from, to),
    );

    if (error) {
      console.error("Failed to load ended-contest submissions:", error.message);
      continue;
    }

    for (const row of data ?? []) {
      const list = submissionsByContest.get(row.contest_id) ?? [];
      list.push(row);
      submissionsByContest.set(row.contest_id, list);
    }
  }

  for (const contest of endedContests) {
    const subs = submissionsByContest.get(contest.id) ?? [];
    const paid = computeBudgetPaidCents(
      {
        contest_type: contest.contest_type,
        post_contest_status: contest.post_contest_status,
        contest_based_details: contest.contest_based_details,
        platform: contest.platform,
      },
      subs,
    );
    // If nothing paid yet on an ended campaign, keep 0 (do not fall back to full budget).
    byId.set(contest.id, Math.max(0, paid));
  }

  // Contests with no submission rows still get an explicit 0 entry
  for (const id of endedContestIds) {
    if (!byId.has(id)) byId.set(id, 0);
  }

  return byId;
}
