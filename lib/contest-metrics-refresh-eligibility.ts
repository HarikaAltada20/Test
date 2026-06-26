import { CONTEST_MODERATION_STATUS, POST_CONTEST_STATUS } from "@/lib/constants-status";

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

/** When true, transition to this post_contest_status should set contests.views_locked_at. */
export function postContestStatusLocksViews(
  postContestStatus: string | null | undefined,
): boolean {
  return isPostContestMetricsLocked(postContestStatus);
}

/**
 * PostgREST `.or()` filter for contests that may receive scheduled refresh.
 * Matches null post_contest_status or pending_review only.
 */
export const SCHEDULED_METRICS_REFRESH_POST_CONTEST_OR_FILTER =
  "post_contest_status.is.null,post_contest_status.eq.pending_review";

/** Live (in window) or ended; excludes upcoming and undated contests. */
export function isContestLiveOrEnded(
  contest: {
    start_date?: string | null;
    end_date?: string | null;
  },
  now: Date = new Date(),
): boolean {
  const { start_date, end_date } = contest;
  if (!start_date || !end_date) return false;
  const start = new Date(start_date);
  if (Number.isNaN(start.getTime())) return false;
  return now >= start;
}

/** Only published campaigns accept public submissions and scheduled metrics refresh. */
export function isContestPublished(
  moderationStatus: string | null | undefined,
): boolean {
  return moderationStatus === CONTEST_MODERATION_STATUS.published;
}

/** Full scheduled-cron eligibility: published + unlocked post-contest + live or ended window. */
export function isContestEligibleForScheduledMetricsCron(contest: {
  views_locked_at?: string | null;
  post_contest_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  moderation_status?: string | null;
}): boolean {
  return (
    isContestPublished(contest.moderation_status) &&
    isContestEligibleForScheduledMetricsRefresh(contest) &&
    isContestLiveOrEnded(contest)
  );
}
