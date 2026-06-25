import { POST_CONTEST_STATUS } from "@/lib/constants-status";

const LOCKED_POST_CONTEST_STATUSES = new Set<string>([
  POST_CONTEST_STATUS.in_review,
  POST_CONTEST_STATUS.verification_complete,
  POST_CONTEST_STATUS.payouts_processed,
]);

/** True when post-contest workflow has started review / locked metrics. */
export function isPostContestMetricsLocked(
  postContestStatus: string | null | undefined,
): boolean {
  if (!postContestStatus) return false;
  return LOCKED_POST_CONTEST_STATUSES.has(postContestStatus);
}

/** Contests eligible for scheduled (cron) metrics refresh. */
export function isContestEligibleForScheduledMetricsRefresh(contest: {
  views_locked_at?: string | null;
  post_contest_status?: string | null;
}): boolean {
  if (contest.views_locked_at) return false;
  return !isPostContestMetricsLocked(contest.post_contest_status);
}

/**
 * PostgREST `.or()` filter for contests that may receive scheduled refresh.
 * Matches null post_contest_status or pending_review only.
 */
export const SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER =
  "post_contest_status.is.null,post_contest_status.eq.pending_review";
