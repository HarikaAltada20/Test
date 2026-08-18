export type YouTubeMetricsWriteTarget =
  | "submissions"
  | "post_campaign_submission_metrics";

/** Live contest writes `submissions`; post-campaign writes the overlay table only. */
export function youtubeMetricsWriteTarget(
  isPostCampaign: boolean,
): YouTubeMetricsWriteTarget {
  return isPostCampaign ? "post_campaign_submission_metrics" : "submissions";
}

/** Options for `updateYouTubeSubmissionForScope` so live payout rows are never the post-campaign target. */
export function youtubeDetailedRefreshWriteOptions(isPostCampaign: boolean): {
  metricsTarget: YouTubeMetricsWriteTarget;
} {
  return { metricsTarget: youtubeMetricsWriteTarget(isPostCampaign) };
}
