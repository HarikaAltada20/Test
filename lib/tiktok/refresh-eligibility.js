/**
 * Shared eligibility predicates used by TikTok enqueue + batch processing flows.
 */

/**
 * @param {{ video_id: string | null | undefined, content_link: string | null | undefined, insights_status: string | null | undefined }} row
 * @returns {boolean}
 */
export function isEligibleForTikTokRefresh(row) {
  const hasVideoReference = !!row.video_id || !!row.content_link;
  const isNotPermanentFailure =
    row.insights_status == null || row.insights_status !== "permanent_failure";
  return hasVideoReference && isNotPermanentFailure;
}

/**
 * @param {{ video_id: string | null | undefined, content_link: string | null | undefined, insights_status: string | null | undefined, last_insights_update: string | null | undefined }} row
 * @param {string} runStartedAt
 * @returns {boolean}
 */
export function isEligibleSubmissionForRun(row, runStartedAt) {
  const isBaseEligible = isEligibleForTikTokRefresh(row);
  const isDueForRefresh =
    row.last_insights_update == null || row.last_insights_update < runStartedAt;
  return isBaseEligible && isDueForRefresh;
}
