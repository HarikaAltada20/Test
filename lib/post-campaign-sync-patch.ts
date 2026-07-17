/** Metric columns that sync must not overwrite unless overwriteMetrics is true. */
export const POST_CAMPAIGN_PRESERVED_METRIC_KEYS = [
  "views",
  "other_stats",
  "last_insights_update",
  "insights_status",
] as const;

/**
 * Build the update patch for an existing overlay row.
 * Default preserves refreshed metrics; overwriteMetrics copies them from submissions.
 */
export function buildPostCampaignExistingRowPatch(
  snapshotFields: Record<string, unknown>,
  metricFields: Record<string, unknown>,
  overwriteMetrics: boolean,
): Record<string, unknown> {
  if (!overwriteMetrics) return { ...snapshotFields };
  return { ...snapshotFields, ...metricFields };
}
