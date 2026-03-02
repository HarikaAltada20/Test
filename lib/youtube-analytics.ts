import { google } from 'googleapis';
import { YT_ANALYTICS_DEFAULT_WINDOW_DAYS } from './youtube-constants';

/** Creates an authenticated YouTube Analytics v2 client using a bearer token. */
function createAnalyticsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.youtubeAnalytics({ version: 'v2', auth });
}

/** Returns YYYY-MM-DD startDate based on the default rolling window. */
export function getDefaultAnalyticsStartDate(): string {
  const start = new Date();
  start.setDate(start.getDate() - YT_ANALYTICS_DEFAULT_WINDOW_DAYS);
  return start.toISOString().split('T')[0];
}

export interface CoreAnalytics {
  estimated_minutes_watched: number;
  avg_view_duration_seconds: number;
  avg_view_percentage: number;
  engaged_views: number;
  likes: number;
  dislikes: number;
  comments: number;
  shares: number;
  subscribers_gained: number;
  subscribers_lost: number;
  videos_added_to_playlists: number;
  videos_removed_from_playlists: number;
}

export interface Demographics {
  age_groups: Record<string, number>;
  gender: Record<string, number>;
  countries: Record<string, number>; // ISO-3166-1 alpha-2 code → % of total views
}

export interface BotDetectionResult {
  score: number;
  flags: string[];
}

/** Returns true when the content_link is a YouTube Shorts URL */
export function isYouTubeShort(url: string): boolean {
  return url.toLowerCase().includes('/shorts/');
}

/**
 * Call 1 — Core Analytics
 * Fetches engagement + watch-time metrics for a single video.
 * Runs on every basic metrics refresh (cron).
 */
export async function getVideoAnalytics(
  accessToken: string,
  videoId: string,
  startDate: string // YYYY-MM-DD — use submission created_at date
): Promise<CoreAnalytics | null> {
  const youtubeAnalytics = createAnalyticsClient(accessToken);
  const today = new Date().toISOString().split('T')[0];

  const response = await youtubeAnalytics.reports.query({
    ids: 'channel==MINE',
    startDate,
    endDate: today,
    metrics: [
      'estimatedMinutesWatched',
      'averageViewDuration',
      'averageViewPercentage',
      'engagedViews',
      'likes',
      'dislikes',
      'comments',
      'shares',
      'subscribersGained',
      'subscribersLost',
      'videosAddedToPlaylists',
      'videosRemovedFromPlaylists',
    ].join(','),
    filters: `video==${videoId}`,
  });

  const rows = response.data.rows;
  if (!rows || rows.length === 0) return null;

  const [
    estimatedMinutesWatched,
    averageViewDuration,
    averageViewPercentage,
    engagedViews,
    likes,
    dislikes,
    comments,
    shares,
    subscribersGained,
    subscribersLost,
    videosAddedToPlaylists,
    videosRemovedFromPlaylists,
  ] = rows[0];

  return {
    estimated_minutes_watched: Number(estimatedMinutesWatched) || 0,
    avg_view_duration_seconds: Number(averageViewDuration) || 0,
    avg_view_percentage: Number(averageViewPercentage) || 0,
    engaged_views: Number(engagedViews) || 0,
    likes: Number(likes) || 0,
    dislikes: Number(dislikes) || 0,
    comments: Number(comments) || 0,
    shares: Number(shares) || 0,
    subscribers_gained: Number(subscribersGained) || 0,
    subscribers_lost: Number(subscribersLost) || 0,
    videos_added_to_playlists: Number(videosAddedToPlaylists) || 0,
    videos_removed_from_playlists: Number(videosRemovedFromPlaylists) || 0,
  };
}

/**
 * Call 2 — Traffic Sources (on-demand)
 * Returns a map of traffic source type → percentage of total views.
 * Key bot-detection signal for Shorts: bots use EXT_URL / NO_LINK_OTHER.
 */
export async function getVideoTrafficSources(
  accessToken: string,
  videoId: string,
  startDate: string
): Promise<Record<string, number> | null> {
  const youtubeAnalytics = createAnalyticsClient(accessToken);
  const today = new Date().toISOString().split('T')[0];

  const response = await youtubeAnalytics.reports.query({
    ids: 'channel==MINE',
    startDate,
    endDate: today,
    dimensions: 'insightTrafficSourceType',
    metrics: 'views',
    filters: `video==${videoId}`,
  });

  const rows = response.data.rows;
  if (!rows || rows.length === 0) return {};

  const totalViews = rows.reduce(
    (sum: number, row: any[]) => sum + Number(row[1] || 0),
    0
  );

  const sources: Record<string, number> = {};
  for (const row of rows) {
    const source = row[0] as string;
    const views = Number(row[1] || 0);
    sources[source] =
      totalViews > 0
        ? Math.round((views / totalViews) * 1000) / 10
        : 0;
  }
  return sources;
}

/**
 * Call 3 — Demographics (on-demand)
 * Fetches age/gender breakdown (viewerPercentage) AND top countries (% of views) in parallel.
 * May return null if the video has too few logged-in viewers (YouTube privacy threshold).
 */
export async function getVideoDemographics(
  accessToken: string,
  videoId: string,
  startDate: string
): Promise<Demographics | null> {
  const youtubeAnalytics = createAnalyticsClient(accessToken);
  const today = new Date().toISOString().split('T')[0];

  const [ageGenderResult, countryResult] = await Promise.allSettled([
    youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate: today,
      dimensions: 'ageGroup,gender',
      metrics: 'viewerPercentage',
      filters: `video==${videoId}`,
    }),
    youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate: today,
      dimensions: 'country',
      metrics: 'views',
      filters: `video==${videoId}`,
      sort: '-views',
      maxResults: 20,
    } as any),
  ]);

  const ageGroups: Record<string, number> = {};
  const genderTotals: Record<string, number> = {};
  const countries: Record<string, number> = {};

  if (ageGenderResult.status === 'fulfilled') {
    const rows = ageGenderResult.value.data.rows ?? [];
    for (const row of rows) {
      const ageGroup = row[0] as string;
      const gender = row[1] as string;
      const percentage = Number(row[2] || 0);
      ageGroups[ageGroup] = Math.round(((ageGroups[ageGroup] || 0) + percentage) * 10) / 10;
      genderTotals[gender] = Math.round(((genderTotals[gender] || 0) + percentage) * 10) / 10;
    }
  }

  if (countryResult.status === 'fulfilled') {
    const rows = countryResult.value.data.rows ?? [];
    const totalViews = rows.reduce((sum: number, row: any[]) => sum + Number(row[1] || 0), 0);
    for (const row of rows) {
      const code = row[0] as string;
      const views = Number(row[1] || 0);
      countries[code] = totalViews > 0 ? Math.round((views / totalViews) * 1000) / 10 : 0;
    }
  }

  const hasData =
    Object.keys(ageGroups).length > 0 ||
    Object.keys(genderTotals).length > 0 ||
    Object.keys(countries).length > 0;

  if (!hasData) return null;

  return { age_groups: ageGroups, gender: genderTotals, countries };
}

/**
 * Computes a bot risk score (0–100) and returns human-readable flags.
 * Uses different signal weights for Shorts vs regular videos.
 */
export function computeBotScore(
  analytics: CoreAnalytics,
  views: number,
  trafficSources: Record<string, number> | null,
  isShort: boolean
): BotDetectionResult {
  if (views === 0) return { score: 0, flags: [] };

  let score = 0;
  const flags: string[] = [];

  // --- Signal 1: Average view percentage (works for both formats) ---
  if (analytics.avg_view_percentage > 0) {
    if (analytics.avg_view_percentage < 10) {
      score += 35;
      flags.push(`Very low avg view % (${analytics.avg_view_percentage.toFixed(1)}%) — bots don't watch`);
    } else if (analytics.avg_view_percentage < 20) {
      score += 15;
      flags.push(`Low avg view % (${analytics.avg_view_percentage.toFixed(1)}%)`);
    }
  }

  // --- Signal 2: Engaged views ratio (works for both formats) ---
  if (analytics.engaged_views > 0 && views > 0) {
    const engagedRatio = analytics.engaged_views / views;
    if (engagedRatio < 0.3) {
      score += 25;
      flags.push(`Low engaged-view ratio (${(engagedRatio * 100).toFixed(1)}%) — bots drop off instantly`);
    } else if (engagedRatio < 0.5) {
      score += 10;
      flags.push(`Below-average engaged-view ratio (${(engagedRatio * 100).toFixed(1)}%)`);
    }
  }

  // --- Signal 3: Share rate (works for both formats) ---
  if (views > 5000) {
    const shareRate = analytics.shares / views;
    if (shareRate < 0.001) {
      score += 15;
      flags.push(`Near-zero share rate (${(shareRate * 100).toFixed(3)}%) — bots never share`);
    }
  }

  // --- Signal 4: Subscriber conversion (works for both formats) ---
  if (analytics.subscribers_gained === 0 && views > 10000) {
    score += 15;
    flags.push('Zero subscribers gained despite high view count');
  }

  // --- Signal 5: Traffic sources ---
  if (trafficSources) {
    const suspicious =
      (trafficSources['EXT_URL'] || 0) +
      (trafficSources['NO_LINK_OTHER'] || 0) +
      (trafficSources['NO_LINK_EMBEDDED'] || 0);

    if (suspicious > 60) {
      score += 40;
      flags.push(`Very high suspicious traffic (${suspicious.toFixed(1)}% external/unknown)`);
    } else if (suspicious > 30) {
      score += 20;
      flags.push(`High suspicious traffic (${suspicious.toFixed(1)}% external/unknown)`);
    }

    // Shorts-specific: organic Shorts should get most traffic from the Shorts feed
    if (isShort && views > 10000) {
      const shortsTraffic = trafficSources['SHORTS'] || 0;
      if (shortsTraffic < 20) {
        score += 15;
        flags.push(`Unexpectedly low Shorts-feed traffic (${shortsTraffic.toFixed(1)}%) for a Short`);
      }
    }
  }

  return { score: Math.min(score, 100), flags };
}
