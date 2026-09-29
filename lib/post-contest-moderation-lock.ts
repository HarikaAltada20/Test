import { POST_CONTEST_STATUS } from "@/lib/constants-status";

/** Matches API routes and DB trigger `submissions_enforce_moderation_lock`. */
export const SUBMISSION_MODERATION_LOCKED_MESSAGE =
  "Submission status cannot be changed after payouts are processed. Contest is fully finalized.";

export function postContestStatusLocksSubmissionModeration(
  status: string | null | undefined,
): boolean {
  return status === POST_CONTEST_STATUS.payouts_processed;
}

/** Whether verify / reject / pending controls should appear in the UI. */
export function submissionModerationUiAllowed(
  postContestStatus: string | null | undefined,
  options?: { isPaidRow?: boolean; forBulkBar?: boolean },
): boolean {
  if (postContestStatusLocksSubmissionModeration(postContestStatus)) {
    return false;
  }
  if (postContestStatus === POST_CONTEST_STATUS.verification_complete) {
    if (options?.forBulkBar) return false;
    return options?.isPaidRow === true;
  }
  return true;
}
