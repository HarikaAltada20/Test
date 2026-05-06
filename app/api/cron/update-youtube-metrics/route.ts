import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { refreshAccessToken, extractYoutubeId } from "@/lib/youtube-api";
import {
  getVideoAnalytics,
  computeBotScore,
  isYouTubeShort,
  getDefaultAnalyticsStartDate,
} from "@/lib/youtube-analytics";
import { updateYouTubeCpmContestBudgets } from "@/lib/youtube-cpm-contest-budgets";

// youtube_account JSON from creator_profiles (tokens + channel fields)
type YouTubeAccountJson = Record<string, any>;

type SubmissionUpdate = {
  id: string;
  views: number;
  newOtherStats: any;
  insightsStatus: "ok";
};

type TokenUpdate = {
  userId: string;
  newAccountData: YouTubeAccountJson;
};

// Helper function to chunk array
const chunkArray = <T>(array: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );

const isTokenExpired = (expiresAt: string): boolean =>
  new Date(expiresAt) <= new Date();

// Refresh YouTube token if needed
async function handleTokenRefresh(
  creator: any,
  tokenUpdates: TokenUpdate[]
): Promise<string | null> {
  const account = creator.youtube_account as YouTubeAccountJson;
  if (!account?.refresh_token || !isTokenExpired(account.expires_at)) {
    return account.access_token;
  }

  try {
    const newTokens = await refreshAccessToken(account.refresh_token);
    const newAccountData = {
      ...account,
      access_token: newTokens.access_token,
      expires_at: newTokens.expires_at,
      refresh_token: newTokens.refresh_token || account.refresh_token,
      needs_reconnect: false,
    };

    tokenUpdates.push({ userId: creator.id, newAccountData });
    return newTokens.access_token;
  } catch (error) {
    console.error(`Token refresh failed for creator ${creator.id}:`, error);
    tokenUpdates.push({
      userId: creator.id,
      newAccountData: {
        ...account,
        needs_reconnect: true,
        updated_at: new Date().toISOString(),
      },
    });
    return null;
  }
}

// Fetch and process YouTube stats (Data API v3 only — basic metrics).
// Advanced analytics (watch time, demographics, traffic sources, bot score)
// are fetched on-demand via /api/youtube/refresh-detailed-analytics.
async function fetchYouTubeStats(
  creator: any,
  videoIds: string[],
  accessToken: string,
  submissionsByCreator: any
): Promise<SubmissionUpdate[]> {
  const updates: SubmissionUpdate[] = [];
  const youtube = google.youtube("v3");
  const chunks = chunkArray(videoIds, 50);
  const now = new Date().toISOString();

  for (const chunk of chunks) {
    try {
      const response = await youtube.videos.list({
        part: ["statistics"],
        id: chunk,
        access_token: accessToken,
      });

      const videoStats = response.data.items || [];

      for (const video of videoStats) {
        const stats = video.statistics!;
        const rawViews = parseInt(stats.viewCount || "0", 10);
        const rawLikes = parseInt(stats.likeCount || "0", 10);
        const rawComments = parseInt(stats.commentCount || "0", 10);

        const matchingSubmissions = submissionsByCreator[creator.id].filter(
          (s: any) => s.video_id === video.id
        );

        for (const sub of matchingSubmissions) {
          // CRITICAL: Read existing other_stats.youtube so we never wipe on-demand data.
          // Daily cron only updates views/likes/comments (Data API v3). Core analytics,
          // traffic_sources, and demographics are fetched on-demand by admin; we must
          // carry them forward so the daily run does not remove them.
          const existingYT = (sub.other_stats?.youtube || sub.other_stats || {}) as Record<string, any>;

          // Preserve every existing YouTube analytics key and only overwrite
          // basic fields refreshed by Data API in this cron path.
          const cleanMetrics: Record<string, any> = {
            ...(existingYT || {}),
            views: rawViews,
            likes: rawLikes,
            comments: rawComments,
            analytics_needs_reauth: existingYT.analytics_needs_reauth || false,
            last_basic_update: now,
          };

          updates.push({
            id: sub.id,
            views: rawViews,
            // Preserve non-YouTube root keys too (if any) while updating youtube branch.
            newOtherStats: {
              ...(sub.other_stats || {}),
              youtube: cleanMetrics,
            },
            insightsStatus: "ok",
          });
        }
      }
    } catch (error: any) {
      console.error(
        `YouTube API error for creator ${creator.id}:`,
        error.message
      );
      if (error.code === 401 || error.code === 403) break;
    }
  }

  return updates;
}

// Batch update database records
async function batchUpdateDatabase(
  supabaseAdmin: any,
  updates: SubmissionUpdate[],
  tokenUpdates: TokenUpdate[]
): Promise<void> {
  const now = new Date().toISOString();

  // Update submissions
  const updatePromises = updates.map((update) =>
    supabaseAdmin
      .from("submissions")
      .update({
        views: update.views,
        other_stats: update.newOtherStats,
        insights_status: update.insightsStatus,
        last_insights_update: now,
        updated_at: now,
      })
      .eq("id", update.id)
  );

  // Update tokens
  const tokenPromises = tokenUpdates.map((tokenUpdate) =>
    supabaseAdmin
      .from("creator_profiles")
      .update({
        youtube_account: tokenUpdate.newAccountData,
        updated_at: now,
      })
      .eq("id", tokenUpdate.userId)
  );

  try {
    await Promise.allSettled([...updatePromises, ...tokenPromises]);
  } catch (error) {
    console.error("Batch update failed:", error);
  }
}

export async function GET(request: Request) {
  // Verify CRON secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Check if this is a contest-specific refresh
    const url = new URL(request.url);
    const contestId = url.searchParams.get("contestId");
    const isContestSpecific = !!contestId;

    // Determine active contests up-front to avoid touching finalized ones
    let activeIds: string[] | undefined = undefined;
    if (isContestSpecific) {
      const { data: c } = await supabaseAdmin
        .from("contests")
        .select("id, views_locked_at")
        .eq("id", contestId)
        .single();
      if (!c || c.views_locked_at) {
        // Finalized or not found: skip submission updates entirely
        return NextResponse.json({
          message: `Contest ${contestId} is finalized or not found; nothing to update`,
        });
      }
    } else {
      const { data: activeContests } = await supabaseAdmin
        .from("contests")
        .select("id")
        .is("views_locked_at", null);
      activeIds = (activeContests || []).map((c: any) => c.id);
      if (!activeIds.length) {
        return NextResponse.json({ message: "No active contests to update" });
      }
    }

    // Fetch submissions to update (only from active contests)
    let submissionsQuery = supabaseAdmin
      .from("submissions")
      .select("id, creator_id, content_link, views, contest_id, created_at, other_stats")
      .in("status", ["verified", "pending"])
      .not("content_link", "is", null);

    // If contest-specific, filter by contest_id
    if (isContestSpecific) {
      submissionsQuery = submissionsQuery.eq("contest_id", contestId);
      console.log(
        `Contest-specific YouTube metrics update for contest: ${contestId}`
      );
    } else if (activeIds && activeIds.length) {
      submissionsQuery = submissionsQuery.in("contest_id", activeIds);
    }

    const { data: submissions, error: submissionError } =
      await submissionsQuery;

    if (submissionError)
      throw new Error(`Submission fetch failed: ${submissionError.message}`);
    if (!submissions?.length) {
      return NextResponse.json({
        message: `No submissions to update${
          isContestSpecific ? ` for contest ${contestId}` : ""
        }`,
      });
    }

    // Group submissions by creator
    const submissionsByCreator = submissions.reduce((acc, sub) => {
      const videoId = extractYoutubeId(sub.content_link);
      if (videoId) {
        if (!acc[sub.creator_id]) acc[sub.creator_id] = [];
        acc[sub.creator_id].push({ ...sub, video_id: videoId });
      }
      return acc;
    }, {} as Record<string, any[]>);

    const creatorIds = Object.keys(submissionsByCreator);
    if (!creatorIds.length) {
      await updateYouTubeCpmContestBudgets(supabaseAdmin);
      return NextResponse.json({ message: "No valid video IDs found" });
    }

    // Fetch creators with YouTube accounts
    const { data: creators, error: creatorsError } = await supabaseAdmin
      .from("creator_profiles")
      .select("id, youtube_account")
      .in("id", creatorIds)
      .not("youtube_account", "is", null);

    if (creatorsError)
      throw new Error(`Creator fetch failed: ${creatorsError.message}`);
    if (!creators?.length) {
      await updateYouTubeCpmContestBudgets(supabaseAdmin);
      return NextResponse.json({
        message: "No connected YouTube accounts found",
      });
    }

    // Process each creator
    const allUpdates: SubmissionUpdate[] = [];
    const tokenUpdates: TokenUpdate[] = [];

    for (const creator of creators) {
      const accessToken = await handleTokenRefresh(creator, tokenUpdates);
      if (!accessToken) continue;

      const videoIds = submissionsByCreator[creator.id].map((s) => s.video_id);
      const updates = await fetchYouTubeStats(
        creator,
        videoIds,
        accessToken,
        submissionsByCreator
      );
      allUpdates.push(...updates);
    }

    // Batch update database
    await batchUpdateDatabase(supabaseAdmin, allUpdates, tokenUpdates);

    // Update CPM contest budgets
    await updateYouTubeCpmContestBudgets(
      supabaseAdmin,
      isContestSpecific ? contestId : undefined
    );

    return NextResponse.json({
      message: `Updated ${allUpdates.length} submissions${
        isContestSpecific ? ` for contest ${contestId}` : ""
      } and CPM contest budgets`,
    });
  } catch (error: any) {
    console.error("CRON job failed:", error);
    return NextResponse.json(
      { error: `Cron job failed: ${error.message}` },
      { status: 500 }
    );
  }
}
