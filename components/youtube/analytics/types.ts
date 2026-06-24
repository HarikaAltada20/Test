export interface YouTubeDemographics {
  age_groups?: Record<string, number>;
  gender?: Record<string, number>;
  countries?: Record<string, import("@/lib/youtube-geo-metrics").GeoMetricValue>;
  cities?: Record<string, import("@/lib/youtube-geo-metrics").GeoMetricValue>;
  provinces?: Record<string, import("@/lib/youtube-geo-metrics").GeoMetricValue>;
}

export interface YouTubeDeviceBreakdown {
  device_types?: Record<string, number>;
  operating_systems?: Record<string, number>;
}

export interface YouTubeTrafficSourceDetails {
  YT_SEARCH?: Record<string, number>;
  EXT_URL?: Record<string, number>;
  RELATED_VIDEO?: Record<string, number>;
}

export interface YouTubeRetentionPoint {
  elapsed_ratio: number;
  watch_ratio: number;
  relative_performance?: number;
}

export interface YouTubeMetrics {
  views?: number;
  likes?: number;
  dislikes?: number;
  comments?: number;
  shares?: number;
  subscribers_gained?: number;
  subscribers_lost?: number;
  videos_added_to_playlists?: number;
  videos_removed_from_playlists?: number;
  estimated_minutes_watched?: number;
  avg_view_duration_seconds?: number;
  avg_view_percentage?: number;
  engaged_views?: number;
  traffic_sources?: Record<string, number> | null;
  traffic_source_details?: YouTubeTrafficSourceDetails | null;
  subscribed_status?: Record<string, number> | null;
  demographics?: YouTubeDemographics | null;
  devices?: YouTubeDeviceBreakdown | null;
  audience_retention?: YouTubeRetentionPoint[] | null;
  bot_score?: number | null;
  bot_flags?: string[];
  analytics_needs_reauth?: boolean;
  last_basic_update?: string | null;
  last_traffic_update?: string | null;
  last_demographics_update?: string | null;
}
