import {
  fetchContestSubmissionsAllPages,
  formatSubmissionFetchError,
} from "@/lib/fetch-contest-submissions";
import {
  computeHighestPlatformDecisions,
  emptyHighestPlatformDecisions,
  isHighestPlatformPayoutOnly,
  type HighestPlatformContest,
  type HighestPlatformDecisions,
  type HighestPlatformSubmissionRow,
} from "@/lib/highest-platform-payout";

/** Columns the highest-platform decision needs from `submissions`. */
export const HIGHEST_PLATFORM_SUBMISSION_COLUMNS =
  "id, creator_id, created_at, status, paid, paid_at, earnings, bonus_amount, bonus_paid, views, platform, other_stats";

/** Live statuses (values of submission_status_enum; there is no "approved"). */
export const HIGHEST_PLATFORM_SUBMISSION_STATUSES = [
  "pending",
  "verified",
  "paid",
] as const;

/**
 * Load every live submission of the campaign and decide each creator's paid
 * platform. Returns an inactive result when the switch is off.
 */
export async function loadHighestPlatformDecisions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestId: string,
  contest: HighestPlatformContest,
): Promise<{ decisions: HighestPlatformDecisions; error: string | null }> {
  if (!isHighestPlatformPayoutOnly(contest)) {
    return { decisions: emptyHighestPlatformDecisions(), error: null };
  }
  const { data, error } =
    await fetchContestSubmissionsAllPages<HighestPlatformSubmissionRow>(
      supabase,
      contestId,
      HIGHEST_PLATFORM_SUBMISSION_COLUMNS,
      {
        statusIn: [...HIGHEST_PLATFORM_SUBMISSION_STATUSES],
        order: { column: "created_at", ascending: true },
      },
    );
  if (error) {
    return {
      decisions: emptyHighestPlatformDecisions(),
      error: formatSubmissionFetchError(error),
    };
  }
  return {
    decisions: computeHighestPlatformDecisions(contest, data || []),
    error: null,
  };
}
