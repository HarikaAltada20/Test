import type { SupabaseClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { extractYoutubeId } from "@/lib/youtube-api";
import {
  getVideoAnalytics,
  getVideoTrafficSources,
  getVideoTrafficDetails,
  getVideoSubscribedStatus,
  getVideoDemographics,
  getVideoDeviceBreakdown,
  getVideoAudienceRetention,
  computeBotScore,
  isYouTubeShort,
  getDefaultAnalyticsStartDate,
  type DeviceBreakdown,
  type AudienceRetentionPoint,
} from "@/lib/youtube-analytics";
import type { YouTubeRefreshScope } from "@/lib/queue/youtube-metrics-queue";

type SubRow = {
  id: string;
  creator_id: string;
  content_link: string;
  views: number | null;
  other_stats: Record<string, unknown> | null;
};

export type PrefetchedBasic = {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  isPrivate?: boolean;
};

type InsightsFailureType = "temporary_failure" | "permanent_failure";

export type YouTubeScopeProfile = {
  needsBasic: boolean;
  core: boolean;
  retention: boolean;
  traffic: boolean;
  trafficDetails: boolean;
  subscribed: boolean;
  demographics: boolean;
  geoDetail: boolean;
  devices: boolean;
};

export function getYouTubeScopeProfile(
  scope: YouTubeRefreshScope
): YouTubeScopeProfile | null {
  switch (scope) {
    case "basic":
      return {
        needsBasic: true,
        core: false,
        retention: false,
        traffic: false,
        trafficDetails: false,
        subscribed: false,
        demographics: false,
        geoDetail: false,
        devices: false,
      };
    case "core":
      return {
        needsBasic: false,
        core: true,
        retention: true,
        traffic: false,
        trafficDetails: false,
        subscribed: false,
        demographics: false,
        geoDetail: false,
        devices: false,
      };
    case "traffic":
      return {
        needsBasic: false,
        core: false,
        retention: false,
        traffic: true,
        trafficDetails: true,
        subscribed: true,
        demographics: false,
        geoDetail: false,
        devices: false,
      };
    case "demographics":
      return {
        needsBasic: false,
        core: false,
        retention: false,
        traffic: false,
        trafficDetails: false,
        subscribed: false,
        demographics: true,
        geoDetail: true,
        devices: true,
      };
    case "all":
      return {
        needsBasic: true,
        core: true,
        retention: true,
        traffic: true,
        trafficDetails: true,
        subscribed: true,
        demographics: true,
        geoDetail: true,
        devices: true,
      };
    case "all_standard":
      return {
        needsBasic: true,
        core: true,
        retention: false,
        traffic: true,
        trafficDetails: false,
        subscribed: false,
        demographics: true,
        geoDetail: false,
        devices: false,
      };
    default:
      return null;
  }
}

export function isYouTubeAllLikeScope(scope: YouTubeRefreshScope): boolean {
  return scope === "all" || scope === "all_standard";
}

async function fetchBasicFromDataApi(
  accessToken: string,
  videoId: string
): Promise<{ stats?: PrefetchedBasic; error?: any; notFound?: boolean; isPrivate?: boolean }> {
  const youtube = google.youtube("v3");
  try {
    const response = await youtube.videos.list({
      part: ["statistics", "status"],
      id: [videoId],
      access_token: accessToken,
    });
    const item = response.data.items?.[0];
    const stats = item?.statistics;

    if (!item) {
      return { notFound: true };
    }

    const isPrivate = item.status?.privacyStatus === "private";

    if (!stats) {
      return { stats: undefined, isPrivate };
    }

    return {
      stats: {
        viewCount: parseInt(stats.viewCount || "0", 10),
        likeCount: parseInt(stats.likeCount || "0", 10),
        commentCount: parseInt(stats.commentCount || "0", 10),
      },
      isPrivate,
    };
  } catch (err) {
    return { error: err };
  }
}

function buildYoutubeMetricsFromBasic(
  rawViews: number,
  rawLikes: number,
  rawComments: number,
  existingYT: Record<string, unknown>,
  now: string
): Record<string, unknown> {
  const youtubeMetrics: Record<string, unknown> = {
    views: rawViews,
    likes: rawLikes,
    comments: rawComments,
    estimated_minutes_watched: existingYT.estimated_minutes_watched || undefined,
    avg_view_duration_seconds: existingYT.avg_view_duration_seconds || undefined,
    avg_view_percentage: existingYT.avg_view_percentage || undefined,
    engaged_views: existingYT.engaged_views || undefined,
    dislikes: existingYT.dislikes || undefined,
    shares: existingYT.shares || undefined,
    subscribers_gained: existingYT.subscribers_gained || undefined,
    subscribers_lost: existingYT.subscribers_lost || undefined,
    videos_added_to_playlists: existingYT.videos_added_to_playlists || undefined,
    videos_removed_from_playlists: existingYT.videos_removed_from_playlists || undefined,
    traffic_sources: existingYT.traffic_sources || undefined,
    traffic_source_details: existingYT.traffic_source_details || undefined,
    subscribed_status: existingYT.subscribed_status || undefined,
    last_traffic_update: existingYT.last_traffic_update || undefined,
    demographics: existingYT.demographics || undefined,
    devices: existingYT.devices || undefined,
    audience_retention: existingYT.audience_retention || undefined,
    last_demographics_update: existingYT.last_demographics_update || undefined,
    bot_score: existingYT.bot_score ?? undefined,
    bot_flags: existingYT.bot_flags || undefined,
    analytics_needs_reauth: existingYT.analytics_needs_reauth || false,
    last_basic_update: now,
  };
  return Object.fromEntries(Object.entries(youtubeMetrics).filter(([, v]) => v !== undefined));
}

/**
 * Updates one submission row for the given queue scope (Data API and/or Analytics API).
 * Returns whether the DB row was updated successfully.
 */
export async function updateYouTubeSubmissionForScope(
  supabaseAdmin: SupabaseClient,
  sub: SubRow,
  accessToken: string,
  scope: YouTubeRefreshScope,
  now: string,
  options?: { prefetchedBasic?: PrefetchedBasic | null }
): Promise<{
  ok: boolean;
  authError: boolean;
  failureType?: InsightsFailureType;
  errorMessage?: string;
}> {
  const classifyYoutubeError = (err: unknown): InsightsFailureType => {
    const e = err as {
      code?: number | string;
      status?: number;
      message?: string;
      errors?: Array<{ reason?: string; message?: string }>;
    };
    const statusNum =
      typeof e?.status === "number"
        ? e.status
        : typeof e?.code === "number"
          ? e.code
          : undefined;
    const message = `${e?.message ?? ""} ${e?.errors?.map((x) => x.reason ?? x.message ?? "").join(" ")}`.toLowerCase();

    if (
      statusNum === 400 ||
      statusNum === 401 ||
      statusNum === 403 ||
      statusNum === 404
    ) {
      return "permanent_failure";
    }
    if (statusNum === 429 || (statusNum != null && statusNum >= 500)) {
      return "temporary_failure";
    }

    if (
      message.includes("quota") ||
      message.includes("rate limit") ||
      message.includes("backenderror") ||
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("temporar")
    ) {
      return "temporary_failure";
    }
    if (
      message.includes("forbidden") ||
      message.includes("permission") ||
      message.includes("insufficient") ||
      message.includes("unauthorized") ||
      message.includes("invalid_grant") ||
      message.includes("not found") ||
      message.includes("private") ||
      message.includes("disabled")
    ) {
      return "permanent_failure";
    }
    return "temporary_failure";
  };

  const existingStats = (sub.other_stats?.youtube || sub.other_stats || {}) as Record<string, unknown>;

  const markFailure = async (
    failureType: InsightsFailureType,
    errorMessage?: string,
    markNeedsReconnect?: boolean
  ) => {
    const existingYoutube = { ...existingStats } as Record<string, unknown>;
    const nextYoutube: Record<string, unknown> = {
      ...existingYoutube,
      ...(errorMessage ? { insights_error: errorMessage.slice(0, 400) } : {}),
      ...(markNeedsReconnect ? { analytics_needs_reauth: true } : {}),
    };

    await supabaseAdmin
      .from("submissions")
      .update({
        insights_status: failureType,
        last_insights_update: now,
        other_stats: {
          ...sub.other_stats,
          youtube: nextYoutube,
        },
        updated_at: now,
      })
      .eq("id", sub.id);
  };

  const videoId = extractYoutubeId(sub.content_link);
  if (!videoId) {
    const msg = "Invalid or missing YouTube video id";
    await markFailure("permanent_failure", msg, false);
    return {
      ok: false,
      authError: false,
      failureType: "permanent_failure",
      errorMessage: msg,
    };
  }

  const isShort = isYouTubeShort(sub.content_link);
  const startDate = getDefaultAnalyticsStartDate();

  const profile = getYouTubeScopeProfile(scope);
  if (!profile) {
    const msg = `Unknown YouTube refresh scope: ${scope}`;
    await markFailure("temporary_failure", msg, false);
    return {
      ok: false,
      authError: false,
      failureType: "temporary_failure",
      errorMessage: msg,
    };
  }

  const needsBasic = profile.needsBasic;

  let basic: PrefetchedBasic | null | undefined = options?.prefetchedBasic;
  let basicFetchRes: { stats?: PrefetchedBasic; error?: any; notFound?: boolean; isPrivate?: boolean } | undefined;

  if (needsBasic && basic === undefined) {
    basicFetchRes = await fetchBasicFromDataApi(accessToken, videoId);
    basic = basicFetchRes.stats ?? null;
  }

  const updates: Record<string, unknown> = {};
  let hadAuthError = false;
  let lastErrorMessage: string | undefined;
  let failureTypeFromErrors: InsightsFailureType | undefined;

  const isPrivate = basicFetchRes?.isPrivate ?? basic?.isPrivate;

  if (needsBasic && isPrivate) {
    const failureType = "temporary_failure";
    const msg = "YouTube video is private (set to public to sync)";
    await markFailure(failureType, msg, false);
    return {
      ok: false,
      authError: false,
      failureType,
      errorMessage: msg,
    };
  }

  if (needsBasic && basic) {
    const mergedBasic = buildYoutubeMetricsFromBasic(
      basic.viewCount,
      basic.likeCount,
      basic.commentCount,
      existingStats,
      now
    );
    Object.assign(updates, mergedBasic);
  } else if (needsBasic && !basic) {
    // Determine failure type based on why it was missing
    let failureType: InsightsFailureType = "temporary_failure";
    let msg = "Could not fetch basic YouTube statistics";

    if (basicFetchRes?.notFound) {
      failureType = "permanent_failure";
      msg = "YouTube video not found (likely deleted)";
    } else if (basicFetchRes?.error) {
      failureType = classifyYoutubeError(basicFetchRes.error);
      msg = `YouTube API Error: ${basicFetchRes.error?.message || "unknown"}`;
    } else if (basic === null && options?.prefetchedBasic === null) {
      // If it was null from prefetch, it means it wasn't in the batch list (not found)
      failureType = "permanent_failure";
      msg = "YouTube video not found in batch results";
    }

    await markFailure(failureType, msg, false);
    return {
      ok: false,
      authError: failureType === "permanent_failure" && (basicFetchRes?.error?.code === 401 || basicFetchRes?.error?.code === 403),
      failureType,
      errorMessage: msg,
    };
  }

  const hasDetailedWork =
    profile.core ||
    profile.traffic ||
    profile.demographics;

  if (hasDetailedWork) {
    try {
      if (profile.core) {
        try {
          const analytics = await getVideoAnalytics(accessToken, videoId, startDate);
          if (analytics) {
            updates.estimated_minutes_watched = analytics.estimated_minutes_watched;
            updates.avg_view_duration_seconds = analytics.avg_view_duration_seconds;
            updates.avg_view_percentage = analytics.avg_view_percentage;
            updates.engaged_views = analytics.engaged_views;
            updates.shares = analytics.shares;
            updates.subscribers_gained = analytics.subscribers_gained;
            updates.subscribers_lost = analytics.subscribers_lost;
            updates.videos_added_to_playlists = analytics.videos_added_to_playlists;
            updates.videos_removed_from_playlists = analytics.videos_removed_from_playlists;
          }
        } catch (err: unknown) {
          const code = (err as { code?: number; status?: number })?.code ?? (err as { status?: number })?.status;
          if (code === 403 || code === 401) hadAuthError = true;
          const classified = classifyYoutubeError(err);
          failureTypeFromErrors =
            failureTypeFromErrors === "permanent_failure" || classified === "permanent_failure"
              ? "permanent_failure"
              : classified;
          lastErrorMessage =
            (err as Error)?.message ?? lastErrorMessage ?? "Core analytics fetch failed";
          console.error(`[youtube-refresh] Core analytics error for ${sub.id}:`, (err as Error)?.message);
        }

        if (profile.retention) {
          try {
            const retention = await getVideoAudienceRetention(accessToken, videoId, startDate);
            if (retention && retention.length > 0) {
              updates.audience_retention = retention;
            }
          } catch (err: unknown) {
            console.error(
              `[youtube-refresh] Audience retention error for ${sub.id}:`,
              (err as Error)?.message
            );
          }
        }
      }

      if (profile.traffic) {
        try {
          const trafficPromises: Promise<unknown>[] = [
            getVideoTrafficSources(accessToken, videoId, startDate),
          ];
          if (profile.trafficDetails) {
            trafficPromises.push(
              getVideoTrafficDetails(accessToken, videoId, startDate)
            );
          }
          if (profile.subscribed) {
            trafficPromises.push(
              getVideoSubscribedStatus(accessToken, videoId, startDate)
            );
          }

          const trafficResults = await Promise.all(trafficPromises);
          const trafficSources = trafficResults[0] as Record<string, number> | null;
          let resultIdx = 1;
          const trafficDetails = profile.trafficDetails
            ? (trafficResults[resultIdx++] as Awaited<
                ReturnType<typeof getVideoTrafficDetails>
              >)
            : null;
          const subscribedStatus = profile.subscribed
            ? (trafficResults[resultIdx] as Record<string, number> | null)
            : null;

          if (trafficSources) updates.traffic_sources = trafficSources;
          if (trafficDetails) {
            updates.traffic_source_details = {
              ...((existingStats.traffic_source_details as Record<string, unknown>) ?? {}),
              ...trafficDetails,
            };
          }
          if (subscribedStatus) updates.subscribed_status = subscribedStatus;
          updates.last_traffic_update = now;
        } catch (err: unknown) {
          const code = (err as { code?: number; status?: number })?.code ?? (err as { status?: number })?.status;
          if (code === 403 || code === 401) hadAuthError = true;
          const classified = classifyYoutubeError(err);
          failureTypeFromErrors =
            failureTypeFromErrors === "permanent_failure" || classified === "permanent_failure"
              ? "permanent_failure"
              : classified;
          lastErrorMessage =
            (err as Error)?.message ?? lastErrorMessage ?? "Traffic sources fetch failed";
          console.error(`[youtube-refresh] Traffic sources error for ${sub.id}:`, (err as Error)?.message);
        }
      }

      if (profile.demographics) {
        try {
          const demographicsPromise = getVideoDemographics(
            accessToken,
            videoId,
            startDate,
            { includeGeoDetail: profile.geoDetail }
          );
          const devicesPromise = profile.devices
            ? getVideoDeviceBreakdown(accessToken, videoId, startDate)
            : Promise.resolve(null);

          const [demographics, devices] = await Promise.all([
            demographicsPromise,
            devicesPromise,
          ]);

          if (demographics) {
            const prevDemo = (existingStats.demographics as Record<string, unknown>) ?? {};
            updates.demographics = { ...prevDemo, ...demographics };
          }
          if (devices) updates.devices = devices;
          updates.last_demographics_update = now;
        } catch (err: unknown) {
          const code = (err as { code?: number; status?: number })?.code ?? (err as { status?: number })?.status;
          if (code === 403 || code === 401) hadAuthError = true;
          const classified = classifyYoutubeError(err);
          failureTypeFromErrors =
            failureTypeFromErrors === "permanent_failure" || classified === "permanent_failure"
              ? "permanent_failure"
              : classified;
          lastErrorMessage =
            (err as Error)?.message ?? lastErrorMessage ?? "Demographics fetch failed";
          console.error(`[youtube-refresh] Demographics error for ${sub.id}:`, (err as Error)?.message);
        }
      }
    } catch (err) {
      console.error(`[youtube-refresh] Detailed block for ${sub.id}:`, (err as Error)?.message);
    }
  }

  if (hadAuthError) {
    const msg = lastErrorMessage ?? "YouTube permissions/auth error";
    await markFailure("permanent_failure", msg, true);
    return {
      ok: false,
      authError: true,
      failureType: "permanent_failure",
      errorMessage: msg,
    };
  }

  if (Object.keys(updates).length === 0) {
    const failureType = failureTypeFromErrors ?? "temporary_failure";
    const msg = lastErrorMessage ?? "No analytics data returned";
    await markFailure(failureType, msg, false);
    return {
      ok: false,
      authError: false,
      failureType,
      errorMessage: msg,
    };
  }

  const merged = { ...existingStats, ...updates };
  const coreForScore = {
    estimated_minutes_watched: Number(merged.estimated_minutes_watched) || 0,
    avg_view_duration_seconds: Number(merged.avg_view_duration_seconds) || 0,
    avg_view_percentage: Number(merged.avg_view_percentage) || 0,
    engaged_views: Number(merged.engaged_views) || 0,
    likes: Number(merged.likes) || 0,
    dislikes: Number(merged.dislikes) || 0,
    comments: Number(merged.comments) || 0,
    shares: Number(merged.shares) || 0,
    subscribers_gained: Number(merged.subscribers_gained) || 0,
    subscribers_lost: Number(merged.subscribers_lost) || 0,
    videos_added_to_playlists: Number(merged.videos_added_to_playlists) || 0,
    videos_removed_from_playlists: Number(merged.videos_removed_from_playlists) || 0,
  };

  const botContext =
    profile.retention || profile.subscribed || profile.devices
      ? {
          trafficSources:
            (merged.traffic_sources as Record<string, number> | null) || null,
          subscribedStatus: profile.subscribed
            ? ((merged.subscribed_status as Record<string, number> | null) || null)
            : null,
          devices: profile.devices
            ? ((merged.devices as DeviceBreakdown | null) || null)
            : null,
          audienceRetention: profile.retention
            ? ((merged.audience_retention as AudienceRetentionPoint[] | null) ||
              null)
            : null,
        }
      : undefined;

  const { score, flags } = computeBotScore(
    coreForScore,
    sub.views || 0,
    (merged.traffic_sources as Record<string, number> | null) || null,
    isShort,
    botContext
  );
  updates.bot_score = score;
  updates.bot_flags = flags;
  updates.analytics_needs_reauth = false;

  const newViews =
    typeof updates.views === "number" ? updates.views : sub.views ?? 0;

  const patch: Record<string, unknown> = {
    other_stats: { ...sub.other_stats, youtube: { ...existingStats, ...updates } },
    insights_status: "ok",
    last_insights_update: now,
    updated_at: now,
  };
  if (needsBasic && typeof updates.views === "number") {
    patch.views = newViews;
  }

  const { error } = await supabaseAdmin.from("submissions").update(patch).eq("id", sub.id);
  if (error) {
    console.error(`[youtube-refresh] DB update failed ${sub.id}:`, error.message);
    return {
      ok: false,
      authError: false,
      failureType: "temporary_failure",
      errorMessage: error.message,
    };
  }
  return { ok: true, authError: false };
}

/**
 * Batch-fetch YouTube Data API statistics for many video IDs (max 50 per request).
 */
export async function fetchYouTubeBasicStatsByVideoId(
  accessToken: string,
  videoIds: string[]
): Promise<Map<string, PrefetchedBasic>> {
  const out = new Map<string, PrefetchedBasic>();
  const youtube = google.youtube("v3");
  const unique = [...new Set(videoIds)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    try {
      const response = await youtube.videos.list({
        part: ["statistics", "status"],
        id: chunk,
        access_token: accessToken,
      });
      for (const video of response.data.items || []) {
        const stats = video.statistics;
        if (!video.id || !stats) continue;
        out.set(video.id, {
          viewCount: parseInt(stats.viewCount || "0", 10),
          likeCount: parseInt(stats.likeCount || "0", 10),
          commentCount: parseInt(stats.commentCount || "0", 10),
          isPrivate: video.status?.privacyStatus === "private",
        });
      }
    } catch (e) {
      console.error("[youtube-refresh] videos.list chunk failed:", (e as Error)?.message);
    }
  }
  return out;
}
