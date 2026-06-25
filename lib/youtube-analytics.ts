import { google } from 'googleapis';
import {
  YT_ANALYTICS_DEFAULT_WINDOW_DAYS,
  YT_GEO_MAX_CITIES_PER_COUNTRY,
  YT_GEO_TOP_COUNTRIES_FOR_CITIES,
  YT_TRAFFIC_DETAIL_MAX_RESULTS,
  YT_TRAFFIC_DETAIL_SOURCES,
} from './youtube-constants';
import {
  type GeoMetricRow,
  type GeoMetricValue,
  geoSortScore,
  rowsToGeoMetrics,
} from './youtube-geo-metrics';

export type { GeoMetricRow, GeoMetricValue } from './youtube-geo-metrics';

const GEO_ACTIVITY_METRICS =
  'views,estimatedMinutesWatched,averageViewDuration';

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

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

/** Convert view rows to percentage map. */
function rowsToViewPercentages(
  rows: any[][] | null | undefined
): Record<string, number> {
  if (!rows || rows.length === 0) return {};
  const totalViews = rows.reduce(
    (sum: number, row: any[]) => sum + Number(row[1] || 0),
    0
  );
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = row[0] as string;
    const views = Number(row[1] || 0);
    out[key] =
      totalViews > 0 ? Math.round((views / totalViews) * 1000) / 10 : 0;
  }
  return out;
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
  countries: Record<string, GeoMetricValue>;
  cities?: Record<string, GeoMetricValue>;
  provinces?: Record<string, GeoMetricValue>;
}

export interface DeviceBreakdown {
  device_types: Record<string, number>;
  operating_systems: Record<string, number>;
}

export type TrafficSourceDetails = Partial<
  Record<(typeof YT_TRAFFIC_DETAIL_SOURCES)[number], Record<string, number>>
>;

export interface AudienceRetentionPoint {
  elapsed_ratio: number;
  watch_ratio: number;
  relative_performance?: number;
}

export interface BotDetectionContext {
  trafficSources?: Record<string, number> | null;
  subscribedStatus?: Record<string, number> | null;
  devices?: DeviceBreakdown | null;
  audienceRetention?: AudienceRetentionPoint[] | null;
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
 */
export async function getVideoAnalytics(
  accessToken: string,
  videoId: string,
  startDate: string
): Promise<CoreAnalytics | null> {
  const youtubeAnalytics = createAnalyticsClient(accessToken);
  const today = todayIso();

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
 * Audience retention curve (~100 points per video).
 */
export async function getVideoAudienceRetention(
  accessToken: string,
  videoId: string,
  startDate: string
): Promise<AudienceRetentionPoint[] | null> {
  const youtubeAnalytics = createAnalyticsClient(accessToken);
  const today = todayIso();

  try {
    const response = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate: today,
      dimensions: 'elapsedVideoTimeRatio',
      metrics: 'audienceWatchRatio,relativeRetentionPerformance',
      filters: `video==${videoId}`,
      sort: 'elapsedVideoTimeRatio',
    } as any);

    const rows = response.data.rows;
    if (!rows || rows.length === 0) return null;

    return rows.map((row: any[]) => ({
      elapsed_ratio: Number(row[0]) || 0,
      watch_ratio: Number(row[1]) || 0,
      relative_performance:
        row[2] != null ? Number(row[2]) : undefined,
    }));
  } catch {
    return null;
  }
}

/**
 * Traffic source type → percentage of total views.
 */
export async function getVideoTrafficSources(
  accessToken: string,
  videoId: string,
  startDate: string
): Promise<Record<string, number> | null> {
  const youtubeAnalytics = createAnalyticsClient(accessToken);
  const today = todayIso();

  const response = await youtubeAnalytics.reports.query({
    ids: 'channel==MINE',
    startDate,
    endDate: today,
    dimensions: 'insightTrafficSourceType',
    metrics: 'views',
    filters: `video==${videoId}`,
  });

  const rows = response.data.rows;
  if (!rows || rows.length === 0) return null;
  return rowsToViewPercentages(rows);
}

/**
 * Top referrers per traffic source type (search terms, external URLs, etc.).
 */
export async function getVideoTrafficDetails(
  accessToken: string,
  videoId: string,
  startDate: string
): Promise<TrafficSourceDetails | null> {
  const youtubeAnalytics = createAnalyticsClient(accessToken);
  const today = todayIso();

  const results = await Promise.allSettled(
    YT_TRAFFIC_DETAIL_SOURCES.map((sourceType) =>
      youtubeAnalytics.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate: today,
        dimensions: 'insightTrafficSourceDetail',
        metrics: 'views',
        filters: `video==${videoId};insightTrafficSourceType==${sourceType}`,
        sort: '-views',
        maxResults: YT_TRAFFIC_DETAIL_MAX_RESULTS,
      } as any).then((res) => ({
        sourceType,
        rows: res.data.rows ?? [],
      }))
    )
  );

  const details: TrafficSourceDetails = {};
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { sourceType, rows } = result.value;
    const pct = rowsToViewPercentages(rows);
    if (Object.keys(pct).length > 0) {
      details[sourceType] = pct;
    }
  }

  return Object.keys(details).length > 0 ? details : null;
}

/**
 * Subscribed vs unsubscribed view split.
 */
export async function getVideoSubscribedStatus(
  accessToken: string,
  videoId: string,
  startDate: string
): Promise<Record<string, number> | null> {
  const youtubeAnalytics = createAnalyticsClient(accessToken);
  const today = todayIso();

  try {
    const response = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate: today,
      dimensions: 'subscribedStatus',
      metrics: 'views',
      filters: `video==${videoId}`,
    });

    const rows = response.data.rows;
    if (!rows || rows.length === 0) return null;
    return rowsToViewPercentages(rows);
  } catch {
    return null;
  }
}

async function getVideoCitiesForCountry(
  accessToken: string,
  videoId: string,
  startDate: string,
  countryCode: string
): Promise<Record<string, GeoMetricRow>> {
  const youtubeAnalytics = createAnalyticsClient(accessToken);
  const today = todayIso();

  try {
    const response = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate: today,
      dimensions: 'city',
      metrics: GEO_ACTIVITY_METRICS,
      filters: `video==${videoId};country==${countryCode}`,
      sort: '-views',
      maxResults: YT_GEO_MAX_CITIES_PER_COUNTRY,
    } as any);

    const byCity = rowsToGeoMetrics(response.data.rows);
    const out: Record<string, GeoMetricRow> = {};
    for (const [city, metric] of Object.entries(byCity)) {
      out[`${countryCode}|${city}`] = metric;
    }
    return out;
  } catch {
    return {};
  }
}

async function getVideoUsProvinces(
  accessToken: string,
  videoId: string,
  startDate: string
): Promise<Record<string, GeoMetricRow>> {
  const youtubeAnalytics = createAnalyticsClient(accessToken);
  const today = todayIso();

  try {
    const response = await youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate: today,
      dimensions: 'province',
      metrics: GEO_ACTIVITY_METRICS,
      filters: `video==${videoId};country==US`,
      sort: '-views',
      maxResults: 20,
    } as any);

    return rowsToGeoMetrics(response.data.rows);
  } catch {
    return {};
  }
}

/**
 * Device type and operating system breakdown.
 */
export async function getVideoDeviceBreakdown(
  accessToken: string,
  videoId: string,
  startDate: string
): Promise<DeviceBreakdown | null> {
  const youtubeAnalytics = createAnalyticsClient(accessToken);
  const today = todayIso();

  const [deviceResult, osResult] = await Promise.allSettled([
    youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate: today,
      dimensions: 'deviceType',
      metrics: 'views',
      filters: `video==${videoId}`,
    }),
    youtubeAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate: today,
      dimensions: 'operatingSystem',
      metrics: 'views',
      filters: `video==${videoId}`,
    }),
  ]);

  const device_types =
    deviceResult.status === 'fulfilled'
      ? rowsToViewPercentages(deviceResult.value.data.rows)
      : {};
  const operating_systems =
    osResult.status === 'fulfilled'
      ? rowsToViewPercentages(osResult.value.data.rows)
      : {};

  if (
    Object.keys(device_types).length === 0 &&
    Object.keys(operating_systems).length === 0
  ) {
    return null;
  }

  return { device_types, operating_systems };
}

export type GetVideoDemographicsOptions = {
  /** When false, skip city and US province API calls. Default true. */
  includeGeoDetail?: boolean;
};

/**
 * Demographics: age/gender, countries, cities (top countries), US provinces.
 */
export async function getVideoDemographics(
  accessToken: string,
  videoId: string,
  startDate: string,
  options?: GetVideoDemographicsOptions
): Promise<Demographics | null> {
  const includeGeoDetail = options?.includeGeoDetail !== false;
  const youtubeAnalytics = createAnalyticsClient(accessToken);
  const today = todayIso();

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
      metrics: GEO_ACTIVITY_METRICS,
      filters: `video==${videoId}`,
      sort: '-views',
      maxResults: 20,
    } as any),
  ]);

  const ageGroups: Record<string, number> = {};
  const genderTotals: Record<string, number> = {};
  const countries: Record<string, GeoMetricRow> = {};

  if (ageGenderResult.status === 'fulfilled') {
    const rows = ageGenderResult.value.data.rows ?? [];
    for (const row of rows) {
      const ageGroup = row[0] as string;
      const gender = row[1] as string;
      const percentage = Number(row[2] || 0);
      ageGroups[ageGroup] =
        Math.round(((ageGroups[ageGroup] || 0) + percentage) * 10) / 10;
      genderTotals[gender] =
        Math.round(((genderTotals[gender] || 0) + percentage) * 10) / 10;
    }
  }

  if (countryResult.status === 'fulfilled') {
    Object.assign(countries, rowsToGeoMetrics(countryResult.value.data.rows));
  }

  const cities: Record<string, GeoMetricRow> = {};
  let provinces: Record<string, GeoMetricRow> = {};

  if (includeGeoDetail) {
    const topCountryCodes = Object.entries(countries)
      .sort((a, b) => geoSortScore(b[1]) - geoSortScore(a[1]))
      .slice(0, YT_GEO_TOP_COUNTRIES_FOR_CITIES)
      .map(([code]) => code);

    const cityResults = await Promise.allSettled(
      topCountryCodes.map((code) =>
        getVideoCitiesForCountry(accessToken, videoId, startDate, code)
      )
    );

    for (const result of cityResults) {
      if (result.status === 'fulfilled') {
        Object.assign(cities, result.value);
      }
    }

    if (topCountryCodes.includes('US')) {
      provinces = await getVideoUsProvinces(accessToken, videoId, startDate);
    }
  }

  const hasData =
    Object.keys(ageGroups).length > 0 ||
    Object.keys(genderTotals).length > 0 ||
    Object.keys(countries).length > 0 ||
    Object.keys(cities).length > 0 ||
    Object.keys(provinces).length > 0;

  if (!hasData) return null;

  const demo: Demographics = {
    age_groups: ageGroups,
    gender: genderTotals,
    countries,
  };
  if (Object.keys(cities).length > 0) demo.cities = cities;
  if (Object.keys(provinces).length > 0) demo.provinces = provinces;

  return demo;
}

/**
 * Computes a bot risk score (0–100) and returns human-readable flags.
 */
export function computeBotScore(
  analytics: CoreAnalytics,
  views: number,
  trafficSources: Record<string, number> | null,
  isShort: boolean,
  context?: BotDetectionContext
): BotDetectionResult {
  if (views === 0) return { score: 0, flags: [] };

  let score = 0;
  const flags: string[] = [];

  if (analytics.avg_view_percentage > 0) {
    if (analytics.avg_view_percentage < 10) {
      score += 35;
      flags.push(
        `Very low avg view % (${analytics.avg_view_percentage.toFixed(1)}%) — bots don't watch`
      );
    } else if (analytics.avg_view_percentage < 20) {
      score += 15;
      flags.push(`Low avg view % (${analytics.avg_view_percentage.toFixed(1)}%)`);
    }
  }

  if (analytics.engaged_views > 0 && views > 0) {
    const engagedRatio = analytics.engaged_views / views;
    if (engagedRatio < 0.3) {
      score += 25;
      flags.push(
        `Low engaged-view ratio (${(engagedRatio * 100).toFixed(1)}%) — bots drop off instantly`
      );
    } else if (engagedRatio < 0.5) {
      score += 10;
      flags.push(
        `Below-average engaged-view ratio (${(engagedRatio * 100).toFixed(1)}%)`
      );
    }
  }

  if (views > 5000) {
    const shareRate = analytics.shares / views;
    if (shareRate < 0.001) {
      score += 15;
      flags.push(
        `Near-zero share rate (${(shareRate * 100).toFixed(3)}%) — bots never share`
      );
    }
  }

  if (analytics.subscribers_gained === 0 && views > 10000) {
    score += 15;
    flags.push('Zero subscribers gained despite high view count');
  }

  const sources = context?.trafficSources ?? trafficSources;
  if (sources) {
    const suspicious =
      (sources['EXT_URL'] || 0) +
      (sources['NO_LINK_OTHER'] || 0) +
      (sources['NO_LINK_EMBEDDED'] || 0);

    if (suspicious > 60) {
      score += 40;
      flags.push(
        `Very high suspicious traffic (${suspicious.toFixed(1)}% external/unknown)`
      );
    } else if (suspicious > 30) {
      score += 20;
      flags.push(
        `High suspicious traffic (${suspicious.toFixed(1)}% external/unknown)`
      );
    }

    if (isShort && views > 10000) {
      const shortsTraffic = sources['SHORTS'] || 0;
      if (shortsTraffic < 20) {
        score += 15;
        flags.push(
          `Unexpectedly low Shorts-feed traffic (${shortsTraffic.toFixed(1)}%) for a Short`
        );
      }
    }
  }

  const retention = context?.audienceRetention;
  if (retention && retention.length > 0 && views > 5000) {
    const pastQuarter = retention.filter((p) => p.elapsed_ratio >= 0.25);
    if (pastQuarter.length > 0) {
      const avgWatch =
        pastQuarter.reduce((s, p) => s + p.watch_ratio, 0) / pastQuarter.length;
      if (avgWatch < 0.15) {
        score += 20;
        flags.push(
          `Steep retention drop (${(avgWatch * 100).toFixed(0)}% still watching after 25%)`
        );
      }
    }
  }

  const devices = context?.devices;
  if (devices && views > 10000) {
    const osEntries = Object.entries(devices.operating_systems ?? {});
    if (osEntries.length > 0) {
      const maxOs = Math.max(...osEntries.map(([, v]) => v));
      if (maxOs > 95) {
        score += 10;
        const dominant = osEntries.find(([, v]) => v === maxOs)?.[0];
        flags.push(`Single OS dominates traffic (${dominant}: ${maxOs.toFixed(1)}%)`);
      }
    }
  }

  const subscribed = context?.subscribedStatus;
  if (subscribed && views > 10000) {
    const subPct = subscribed['SUBSCRIBED'] ?? 0;
    const shortsDominant = (sources?.['SHORTS'] ?? 0) > 50;
    if (subPct === 0 && !shortsDominant) {
      score += 10;
      flags.push('Zero subscribed-viewer traffic despite high view count');
    }
  }

  return { score: Math.min(score, 100), flags };
}
