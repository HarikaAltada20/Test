import { watchTimeToMsSeconds } from "@/lib/tiktok/watch-time-ms";

/**
 * Map one row from GET /open_api/v1.3/business/video/list/ into submission-friendly data.
 * Field names align with TikTok Business docs; API may omit keys.
 */
export type TikTokBusinessVideoRowMetrics = {
  itemId: string;
  shareUrl: string | null;
  embedUrl: string | null;
  caption: string | null;
  mediaType: string | null;
  thumbnailUrl: string | null;
  createTime: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  favorites: number;
  reach: number;
  avgWatchTimeMs: number;
  totalWatchTimeMs: number;
  fullVideoWatchedRate: number;
  videoDurationSec: number;
  newFollowers: number;
  profileViews: number;
  websiteClicks: number;
  phoneNumberClicks: number;
  leadSubmissions: number;
  appDownloadClicks: number;
  emailClicks: number;
  addressClicks: number;
  impressionSources: unknown[] | null;
  audienceGenders: unknown[] | null;
  audienceCountries: unknown[] | null;
  audienceCities: unknown[] | null;
  audienceTypes: unknown[] | null;
  videoViewRetention: unknown[] | null;
  engagementLikes: unknown[] | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s ? s : null;
}

function jsonArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null;
}

export function mapBusinessVideoListRow(
  row: Record<string, unknown>,
): TikTokBusinessVideoRowMetrics | null {
  const itemId = String(row.item_id ?? row.id ?? "");
  if (!itemId) return null;

  const shareUrl =
    nonEmptyString(row.share_url) ?? nonEmptyString(row.embed_url);

  const embedUrl = nonEmptyString(row.embed_url);

  const avgSec = num(
    row.average_time_watched ?? row.avg_watch_time ?? row.avg_play_time,
  );
  const totalSec = num(
    row.total_time_watched ?? row.total_play_time ?? row.total_watch_time,
  );

  return {
    itemId,
    shareUrl,
    embedUrl,
    caption:
      typeof row.caption === "string"
        ? row.caption
        : row.caption != null
          ? String(row.caption)
          : null,
    mediaType: str(row.media_type),
    thumbnailUrl: nonEmptyString(row.thumbnail_url),
    createTime: str(row.create_time),
    views: num(row.video_views ?? row.view_count ?? row.views),
    likes: num(row.likes ?? row.like_count),
    comments: num(row.comments ?? row.comment_count),
    shares: num(row.shares ?? row.share_count),
    favorites: num(row.favorites ?? row.favorite_count),
    reach: num(row.reach ?? row.reach_count ?? row.video_reach),
    avgWatchTimeMs: watchTimeToMsSeconds(avgSec),
    totalWatchTimeMs: watchTimeToMsSeconds(totalSec),
    fullVideoWatchedRate: num(row.full_video_watched_rate),
    videoDurationSec: num(row.video_duration ?? row.duration),
    newFollowers: num(row.new_followers),
    profileViews: num(row.profile_views),
    websiteClicks: num(row.website_clicks),
    phoneNumberClicks: num(row.phone_number_clicks),
    leadSubmissions: num(row.lead_submissions),
    appDownloadClicks: num(row.app_download_clicks),
    emailClicks: num(row.email_clicks),
    addressClicks: num(row.address_clicks),
    impressionSources: jsonArray(row.impression_sources),
    audienceGenders: jsonArray(row.audience_genders),
    audienceCountries: jsonArray(row.audience_countries),
    audienceCities: jsonArray(row.audience_cities),
    audienceTypes: jsonArray(row.audience_types),
    videoViewRetention: jsonArray(row.video_view_retention),
    engagementLikes: jsonArray(row.engagement_likes),
  };
}

function nonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}
