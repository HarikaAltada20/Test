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

export type PostCampaignOverlayMetrics = {
  submission_id: string;
  views: number | null;
  other_stats: Record<string, unknown> | null;
};

/** Overlay metrics win when present; missing overlay keeps the live submission row. */
export function applyPostCampaignOverlayRow<T extends {
  id: string;
  views: number | null;
  other_stats: Record<string, unknown> | null;
}>(row: T, overlay?: PostCampaignOverlayMetrics | null): T {
  if (!overlay) return row;
  return {
    ...row,
    views: overlay.views ?? row.views,
    other_stats: overlay.other_stats ?? row.other_stats,
  };
}

/** Minimal overlay insert so detailed refresh can write without dropping the row. */
export function postCampaignOverlayInsertFromSubmission(
  row: {
    id: string;
    contest_id: string;
    creator_id: string;
    content_link: string | null;
    views: number | null;
    other_stats: Record<string, unknown> | null;
    platform?: string | null;
  },
  now: string,
): {
  submission_id: string;
  contest_id: string;
  creator_id: string;
  content_link: string | null;
  views: number;
  other_stats: Record<string, unknown> | null;
  platform: string | null;
  synced_at: string;
  updated_at: string;
} {
  return {
    submission_id: row.id,
    contest_id: row.contest_id,
    creator_id: row.creator_id,
    content_link: row.content_link,
    views: row.views ?? 0,
    other_stats: row.other_stats,
    platform: row.platform ?? null,
    synced_at: now,
    updated_at: now,
  };
}
