export type ReviewSubmission = {
  id: string;
  status: string;
  contentLink: string | null;
  platform: string | null;
  videoId: string | null;
  videoThumbnailUrl: string | null;
  videoTitle: string | null;
  creatorDisplayName: string | null;
  /** Handle on the submission platform (Instagram username, YouTube @handle / channel id). */
  creatorUsername: string | null;
  /** Game of Creators account username. */
  appUsername: string | null;
  creatorAvatarUrl: string | null;
  createdAt: string | null;
  /** 1-based rank in the current sort, if known. */
  rank: number | null;
  /** Clip quality score (1–5) set by admins, if any. */
  qualityScore: number | null;
  /** When platform analytics were last refreshed. */
  metricsUpdatedAt: string | null;
  insightsStatus: string | null;
  /** This creator's clips in the current campaign. */
  creatorCampaign: ReviewCreatorCampaignCounts | null;
  /** Admin-only creator track record; null when hidden. */
  creatorStats: ReviewCreatorStats | null;
};

export type ReviewCreatorCampaignCounts = {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
};

export type ReviewCreatorStats = {
  trustScore: number | null;
  avgQuality: number | null;
  totalEarnedCents: number | null;
  totalViews: number | null;
};

/** Subset of `extractPlatformMetrics` output that Review Mode displays. */
export type ReviewMetricsSource = {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  dislikes?: number;
  saves?: number;
  reach?: number;
  impressions?: number;
  reposts?: number | null;
  total_interactions?: number;
  reels_skip_rate?: number | null;
  engagement_rate?: number;
  avg_view_percentage?: number;
  estimated_minutes_watched?: number;
  avg_view_duration_seconds?: number;
  duration_seconds?: number | null;
  engaged_views?: number;
  subscribers_gained?: number;
  subscribers_lost?: number;
  videos_added_to_playlists?: number;
  avg_watch_time_ms?: number;
  total_watch_time_ms?: number;
  bot_score?: number | null;
  bot_flags?: unknown[];
  last_basic_update?: string | null;
};

export type ReviewRewardLine = {
  amount: number;
  label: string;
};

export type ReviewRewardSummary = {
  expected: ReviewRewardLine | null;
  granted: ReviewRewardLine | null;
};

export type ReviewModerationAction = "verify" | "reject" | "pending";
