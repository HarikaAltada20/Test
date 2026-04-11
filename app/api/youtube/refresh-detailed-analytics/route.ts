import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { refreshAccessToken, extractYoutubeId } from "@/lib/youtube-api";
import {
  getVideoAnalytics,
  getVideoTrafficSources,
  getVideoDemographics,
  computeBotScore,
  isYouTubeShort,
  getDefaultAnalyticsStartDate,
} from "@/lib/youtube-analytics";

/**
 * POST /api/youtube/refresh-detailed-analytics
 *
 * On-demand fetch of Traffic Sources (Call 2) and/or Demographics (Call 3).
 * Admin-only. Accepts one of three targeting modes:
 *   - { type, submissionId }              → single submission
 *   - { type, creatorId, contestId }      → all submissions by creator in contest
 *   - { type, contestId }                 → all YouTube submissions in contest
 *
 * type: "traffic" | "demographics" | "both"
 */
export async function POST(request: Request) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const {
    type,
    submissionId,
    creatorId,
    contestId,
  }: {
    type: "core" | "traffic" | "demographics" | "both" | "all";
    submissionId?: string;
    creatorId?: string;
    contestId?: string;
  } = body;

  if (!type || !["core", "traffic", "demographics", "both", "all"].includes(type)) {
    return NextResponse.json(
      { error: "type must be 'core', 'traffic', 'demographics', 'both', or 'all'" },
      { status: 400 }
    );
  }

  if (!submissionId && !contestId) {
    return NextResponse.json(
      { error: "Provide submissionId, contestId, or creatorId + contestId" },
      { status: 400 }
    );
  }

  const supabaseAdmin = createAdminSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // --- Fetch target submissions ---
  let submissionsQuery = supabaseAdmin
    .from("submissions")
    .select("id, creator_id, content_link, views, other_stats, created_at, platform")
    .in("status", ["verified", "pending"])
    .not("content_link", "is", null);

  if (submissionId) {
    submissionsQuery = submissionsQuery.eq("id", submissionId);
  } else if (creatorId && contestId) {
    submissionsQuery = submissionsQuery
      .eq("creator_id", creatorId)
      .eq("contest_id", contestId);
  } else if (contestId) {
    submissionsQuery = submissionsQuery.eq("contest_id", contestId);
  }

  const { data: submissions, error: subError } = await submissionsQuery;

  if (subError) {
    return NextResponse.json(
      { error: `Failed to fetch submissions: ${subError.message}` },
      { status: 500 }
    );
  }

  const youtubeSubmissions = (submissions || []).filter(
    (s) =>
      s.platform?.toLowerCase().includes("youtube") &&
      s.content_link
  );

  if (youtubeSubmissions.length === 0) {
    return NextResponse.json({ message: "No YouTube submissions found", updated: 0 });
  }

  // --- Group by creator to reuse tokens ---
  const creatorIds = [...new Set(youtubeSubmissions.map((s) => s.creator_id))];

  const { data: creators, error: creatorsError } = await supabaseAdmin
    .from("creator_profiles")
    .select("id, youtube_account")
    .in("id", creatorIds)
    .not("youtube_account", "is", null);

  if (creatorsError || !creators?.length) {
    return NextResponse.json(
      { error: "No connected YouTube accounts found for these submissions" },
      { status: 400 }
    );
  }

  const tokenMap = new Map<string, string>();
  const needsReauthCreators: string[] = [];

  // Refresh tokens where needed
  for (const creator of creators) {
    const account = creator.youtube_account as any;
    if (!account?.access_token) continue;

    let token = account.access_token;
    const isExpired = account.expires_at && new Date(account.expires_at) <= new Date();

    if (isExpired && account.refresh_token) {
      try {
        const newTokens = await refreshAccessToken(account.refresh_token);
        token = newTokens.access_token;
        await supabaseAdmin
          .from("creator_profiles")
          .update({
            youtube_account: {
              ...account,
              access_token: newTokens.access_token,
              expires_at: newTokens.expires_at,
              refresh_token: newTokens.refresh_token || account.refresh_token,
              needs_reconnect: false,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", creator.id);
      } catch {
        await supabaseAdmin
          .from("creator_profiles")
          .update({
            youtube_account: {
              ...account,
              needs_reconnect: true,
              updated_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", creator.id);
        needsReauthCreators.push(creator.id);
        continue;
      }
    }

    tokenMap.set(creator.id, token);
  }

  let updated = 0;
  let failed = 0;
  const reauthNeeded: string[] = [];
  const now = new Date().toISOString();

  // --- Process each submission ---
  for (const sub of youtubeSubmissions) {
    const accessToken = tokenMap.get(sub.creator_id);
    if (!accessToken) {
      if (needsReauthCreators.includes(sub.creator_id)) {
        reauthNeeded.push(sub.id);
      }
      failed++;
      continue;
    }

    const videoId = extractYoutubeId(sub.content_link);
    if (!videoId) {
      failed++;
      continue;
    }

    // Use the shared default rolling window (see YT_ANALYTICS_DEFAULT_WINDOW_DAYS)
    // so admins can change it once and affect all analytics queries.
    const startDate = getDefaultAnalyticsStartDate();

    const existingStats = (sub.other_stats?.youtube || sub.other_stats || {}) as Record<string, any>;
    const isShort = isYouTubeShort(sub.content_link);

    try {
      const updates: Record<string, any> = {};
      let hadAuthError = false;

      // ── Call 1: Core analytics (on-demand) ──────────────────────────────────
      if (type === "core" || type === "all") {
        try {
          const analytics = await getVideoAnalytics(accessToken, videoId, startDate);
          if (analytics) {
            updates.estimated_minutes_watched = analytics.estimated_minutes_watched;
            updates.avg_view_duration_seconds = analytics.avg_view_duration_seconds;
            updates.avg_view_percentage = analytics.avg_view_percentage;
            updates.engaged_views = analytics.engaged_views;
            updates.likes = analytics.likes;
            updates.dislikes = analytics.dislikes;
            updates.comments = analytics.comments;
            updates.shares = analytics.shares;
            updates.subscribers_gained = analytics.subscribers_gained;
            updates.subscribers_lost = analytics.subscribers_lost;
            updates.videos_added_to_playlists = analytics.videos_added_to_playlists;
            updates.videos_removed_from_playlists = analytics.videos_removed_from_playlists;
            updates.last_basic_update = now;
          }
        } catch (err: any) {
          const code = err?.code ?? err?.status;
          if (code === 403 || code === 401) {
            hadAuthError = true;
          } else {
            console.error(`Core analytics error for ${sub.id}:`, err.message);
          }
        }
      }

      // ── Call 2: Traffic sources ──────────────────────────────────────────────
      if (type === "traffic" || type === "both" || type === "all") {
        try {
          const trafficSources = await getVideoTrafficSources(accessToken, videoId, startDate);
          updates.traffic_sources = trafficSources;
          updates.last_traffic_update = now;
        } catch (err: any) {
          const code = err?.code ?? err?.status;
          if (code === 403 || code === 401) {
            hadAuthError = true;
          } else {
            console.error(`Traffic sources error for ${sub.id}:`, err.message);
          }
        }
      }

      // ── Call 3: Demographics ─────────────────────────────────────────────────
      if (type === "demographics" || type === "both" || type === "all") {
        try {
          const demographics = await getVideoDemographics(accessToken, videoId, startDate);
          updates.demographics = demographics;
          updates.last_demographics_update = now;
        } catch (err: any) {
          const code = err?.code ?? err?.status;
          if (code === 403 || code === 401) {
            hadAuthError = true;
          } else {
            console.error(`Demographics error for ${sub.id}:`, err.message);
          }
        }
      }

      if (hadAuthError) {
        reauthNeeded.push(sub.id);
        await supabaseAdmin
          .from("submissions")
          .update({
            other_stats: {
              ...sub.other_stats,
              youtube: { ...existingStats, analytics_needs_reauth: true },
            },
            updated_at: now,
          })
          .eq("id", sub.id);
        failed++;
        continue;
      }

      if (Object.keys(updates).length === 0) {
        failed++;
        continue;
      }

      // ── Recompute bot score from all available analytics ─────────────────────
      const merged = { ...existingStats, ...updates };
      const coreForScore = {
        estimated_minutes_watched: merged.estimated_minutes_watched || 0,
        avg_view_duration_seconds: merged.avg_view_duration_seconds || 0,
        avg_view_percentage: merged.avg_view_percentage || 0,
        engaged_views: merged.engaged_views || 0,
        likes: merged.likes || 0,
        dislikes: merged.dislikes || 0,
        comments: merged.comments || 0,
        shares: merged.shares || 0,
        subscribers_gained: merged.subscribers_gained || 0,
        subscribers_lost: merged.subscribers_lost || 0,
        videos_added_to_playlists: merged.videos_added_to_playlists || 0,
        videos_removed_from_playlists: merged.videos_removed_from_playlists || 0,
      };

      const { score, flags } = computeBotScore(
        coreForScore,
        sub.views || 0,
        merged.traffic_sources || null,
        isShort
      );
      updates.bot_score = score;
      updates.bot_flags = flags;
      updates.analytics_needs_reauth = false;

      await supabaseAdmin
        .from("submissions")
        .update({
          other_stats: { ...sub.other_stats, youtube: { ...existingStats, ...updates } },
          updated_at: now,
        })
        .eq("id", sub.id);

      updated++;
    } catch (err: any) {
      console.error(`Failed for submission ${sub.id}:`, err.message);
      failed++;
    }
  }

  // Update contest-level last-updated timestamps for contest-wide refreshes
  if (contestId) {
    const { data: contestRow } = await supabaseAdmin
      .from("contests")
      .select("contest_based_details")
      .eq("id", contestId)
      .maybeSingle();

    const existing = (contestRow?.contest_based_details as Record<string, unknown>) || {};
    const existingYt = (existing.youtube_metrics_last_updated as Record<string, string>) || {};
    const now = new Date().toISOString();
    const nextYt = { ...existingYt };
    if (type === "core" || type === "all") nextYt.core = now;
    if (type === "traffic" || type === "both" || type === "all") nextYt.traffic = now;
    if (type === "demographics" || type === "both" || type === "all") nextYt.demographics = now;
    await supabaseAdmin
      .from("contests")
      .update({
        contest_based_details: { ...existing, youtube_metrics_last_updated: nextYt },
      })
      .eq("id", contestId);
  }

  return NextResponse.json({
    success: true,
    updated,
    failed,
    reauth_needed: reauthNeeded.length > 0 ? reauthNeeded : undefined,
    message: `Updated ${updated} submission(s)${reauthNeeded.length ? `. ${reauthNeeded.length} creator(s) need to reconnect their YouTube account.` : ""}`,
  });
}
