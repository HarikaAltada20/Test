/**
 * Requested fields for GET /open_api/v1.3/business/video/list/
 * @see TikTok API for Business — business video list (v1.3)
 *
 * `item_id` must be included when requesting multiple fields. Some fields need
 * `video.list` / `video.insights` permissions; if the API rejects the request,
 * trim to a smaller set.
 */
export const TIKTOK_BUSINESS_VIDEO_LIST_FIELDS = [
  "item_id",
  "media_type",
  "thumbnail_url",
  "share_url",
  "embed_url",
  "caption",
  "video_duration",
  "likes",
  "comments",
  "shares",
  "favorites",
  "create_time",
  "reach",
  "video_views",
  "total_time_watched",
  "average_time_watched",
  "full_video_watched_rate",
  "new_followers",
  "profile_views",
  "website_clicks",
  "phone_number_clicks",
  "lead_submissions",
  "app_download_clicks",
  "email_clicks",
  "address_clicks",
  "video_view_retention",
  "impression_sources",
  "audience_genders",
  "audience_countries",
  "audience_cities",
  "audience_types",
  "engagement_likes",
] as const;

export type TikTokBusinessVideoListField =
  (typeof TIKTOK_BUSINESS_VIDEO_LIST_FIELDS)[number];
