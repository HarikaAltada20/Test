/**
 * Filters for which submissions are included in queued insights/metrics refreshes
 * (Instagram, TikTok, and YouTube batch workers share this predicate).
 */

/** How long we wait before retrying after insights_status permanent_failure (red). */
export const INSIGHTS_PERMANENT_FAILURE_RETRY_COOLDOWN_MS =
  24 * 60 * 60 * 1000;

/**
 * PostgREST `.or()` filter fragment for submissions that may be refreshed:
 * - null / ok / temporary_failure (yellow) — always
 * - permanent_failure — only if never updated or last attempt older than cooldown
 *
 * Caller must still exclude rejected submissions separately (e.g. status.neq.rejected).
 */
export function insightsRefreshInsightsStatusOrFilter(
  nowMs: number = Date.now(),
): string {
  const cutoffIso = new Date(
    nowMs - INSIGHTS_PERMANENT_FAILURE_RETRY_COOLDOWN_MS,
  ).toISOString();
  return [
    "insights_status.is.null",
    "insights_status.eq.ok",
    "insights_status.eq.temporary_failure",
    `and(insights_status.eq.permanent_failure,or(last_insights_update.is.null,last_insights_update.lt.${cutoffIso}))`,
  ].join(",");
}
