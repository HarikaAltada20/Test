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

// Type definition for the youtube_account JSON object
type YouTubeAccount = {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO String timestamp
  // Include other fields if they exist, though not strictly needed here
};

type SubmissionUpdate = {
  id: string;
  views: number;
  newOtherStats: any;
};

type TokenUpdate = {
  userId: string;
  newAccountData: YouTubeAccount;
};

// Helper function to chunk array
const chunkArray = <T>(array: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );

const isTokenExpired = (expiresAt: string): boolean =>
  new Date(expiresAt) <= new Date();

// Function to update budget spent for CPM contests
async function updateCpmContestBudgets(
  supabaseAdmin: any,
  contestId?: string
): Promise<void> {
  try {
    let contestsQuery = supabaseAdmin
      .from("contests")
      .select("id, contest_based_details, views_locked_at")
      .eq("contest_type", "cpm")
      .not("contest_based_details", "is", null)
      .is("views_locked_at", null); // Only update contests that haven't been finalized

    // If contest-specific, filter by contest ID
    if (contestId) {
      contestsQuery = contestsQuery.eq("id", contestId);
    }

    const { data: contests, error } = await contestsQuery;

    if (error || !contests?.length) {
      console.log("No CPM contests to update");
      return;
    }

    for (const contest of contests) {
      const cpmConfig = contest.contest_based_details?.cpm_contest;
      if (!cpmConfig?.cpm_rate_usd) continue;

      // Fetch contest details for cap
      const { data: contestDetails } = await supabaseAdmin
        .from("contests")
        .select("max_earnings_per_creator")
        .eq("id", contest.id)
        .single();

      const maxEarningsPerCreator =
        contestDetails?.max_earnings_per_creator || null;

      // Get submissions with payment status
      const { data: submissions } = await supabaseAdmin
        .from("submissions")
        .select(
          "views, creator_id, created_at, paid, bonus_paid, earnings, bonus_amount"
        )
        .eq("contest_id", contest.id)
        .in("status", ["verified", "paid"])
        .order("created_at", { ascending: true });

      if (!submissions?.length) continue;

      // Group by creator to respect earnings cap
      const creatorEarnings = new Map<
        string,
        { cpmTotal: number; bonusTotal: number }
      >();
      const flatFeeBonus = cpmConfig.flat_fee_bonus || 0;
      const flatFeeBonusCap = cpmConfig.flat_fee_bonus_cap || null;

      // Track total bonus spending to apply cap (first-come-first-served)
      let totalBonusSpentSoFar = 0;
      const capInDollars = flatFeeBonusCap ? flatFeeBonusCap / 100 : null;

      for (const sub of submissions) {
        const creatorId = sub.creator_id;
        if (!creatorEarnings.has(creatorId)) {
          creatorEarnings.set(creatorId, { cpmTotal: 0, bonusTotal: 0 });
        }

        const creatorData = creatorEarnings.get(creatorId)!;

        // Use actual paid earnings if paid, otherwise calculate expected
        if (sub.paid && sub.earnings != null) {
          // Use actual paid amount from database
          creatorData.cpmTotal += sub.earnings / 100; // Convert cents to dollars
        } else {
          // Calculate expected CPM earnings for verified but unpaid submissions
          let views = sub.views || 0;
          if (cpmConfig.min_views && views < cpmConfig.min_views) views = 0;
          if (cpmConfig.max_views && views > cpmConfig.max_views)
            views = cpmConfig.max_views;

          const submissionEarnings = (views * cpmConfig.cpm_rate_usd) / 1000;

          // Apply creator cap if exists
          if (maxEarningsPerCreator) {
            const maxEarningsInDollars = maxEarningsPerCreator / 100;
            const remainingCap = maxEarningsInDollars - creatorData.cpmTotal;
            if (remainingCap > 0) {
              creatorData.cpmTotal += Math.min(
                submissionEarnings,
                remainingCap
              );
            }
          } else {
            creatorData.cpmTotal += submissionEarnings;
          }
        }

        // Use actual bonus amount if bonus_paid, otherwise calculate expected
        // Apply cap during calculation (first-come-first-served)
        if (sub.bonus_paid && sub.bonus_amount != null) {
          // Use actual bonus amount from database
          const actualBonus = sub.bonus_amount / 100;
          creatorData.bonusTotal += actualBonus;
          totalBonusSpentSoFar += actualBonus;
        } else if (flatFeeBonus > 0) {
          const bonusAmount = flatFeeBonus / 100;
          // Check if adding this bonus would exceed the cap
          if (
            capInDollars === null ||
            totalBonusSpentSoFar + bonusAmount <= capInDollars
          ) {
            creatorData.bonusTotal += bonusAmount;
            totalBonusSpentSoFar += bonusAmount;
          }
          // If cap would be exceeded, this submission gets $0 bonus (cap reached)
        }
      }

      // Sum up all creator earnings
      let totalCPM = 0;
      let totalBonus = 0;
      for (const [_, earnings] of creatorEarnings) {
        totalCPM += earnings.cpmTotal;
        totalBonus += earnings.bonusTotal;
      }

      const totalSpent = totalCPM + totalBonus;

      const now = new Date().toISOString();
      await supabaseAdmin
        .from("contests")
        .update({
          contest_based_details: {
            ...contest.contest_based_details,
            cpm_contest: {
              ...cpmConfig,
              budget_spent: Math.round(totalSpent * 100),
            },
          },
          last_metrics_updated: now,
          updated_at: now,
        })
        .eq("id", contest.id);
    }
  } catch (error) {
    console.error("CPM budget update failed:", error);
  }
}

// Refresh YouTube token if needed
async function handleTokenRefresh(
  creator: any,
  tokenUpdates: TokenUpdate[]
): Promise<string | null> {
  const account = creator.youtube_account as YouTubeAccount;
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
    };

    tokenUpdates.push({ userId: creator.id, newAccountData });
    return newTokens.access_token;
  } catch (error) {
    console.error(`Token refresh failed for creator ${creator.id}:`, error);
    return null;
  }
}

// Fetch and process YouTube stats (Data API v3 + Analytics API)
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
          // Preserve previously fetched traffic/demographics data
          const existingYT = (sub.other_stats?.youtube || sub.other_stats || {}) as Record<string, any>;

          // Start with the base Data API metrics
          const youtubeMetrics: Record<string, any> = {
            views: rawViews,
            likes: rawLikes,
            comments: rawComments,
            // Carry forward on-demand data if it exists
            traffic_sources: existingYT.traffic_sources || undefined,
            last_traffic_update: existingYT.last_traffic_update || undefined,
            demographics: existingYT.demographics || undefined,
            last_demographics_update: existingYT.last_demographics_update || undefined,
            analytics_needs_reauth: existingYT.analytics_needs_reauth || false,
            last_basic_update: now,
          };

          // --- Call 1: Core Analytics via YouTube Analytics API ---
          try {
            // Use a configurable rolling window (see YT_ANALYTICS_DEFAULT_WINDOW_DAYS)
            // so non-technical users can adjust how much history is considered.
            const startDate = getDefaultAnalyticsStartDate();

            const analytics = await getVideoAnalytics(
              accessToken,
              sub.video_id,
              startDate
            );

            if (analytics) {
              Object.assign(youtubeMetrics, {
                estimated_minutes_watched: analytics.estimated_minutes_watched,
                avg_view_duration_seconds: analytics.avg_view_duration_seconds,
                avg_view_percentage: analytics.avg_view_percentage,
                engaged_views: analytics.engaged_views,
                // Override likes/comments from Analytics API (more accurate for the date range)
                likes: analytics.likes || rawLikes,
                dislikes: analytics.dislikes,
                comments: analytics.comments || rawComments,
                shares: analytics.shares,
                subscribers_gained: analytics.subscribers_gained,
                subscribers_lost: analytics.subscribers_lost,
                videos_added_to_playlists: analytics.videos_added_to_playlists,
                videos_removed_from_playlists: analytics.videos_removed_from_playlists,
              });

              // Compute bot score with core analytics (traffic sources added when fetched on-demand)
              const { score, flags } = computeBotScore(
                analytics,
                rawViews,
                youtubeMetrics.traffic_sources || null,
                isYouTubeShort(sub.content_link || "")
              );
              youtubeMetrics.bot_score = score;
              youtubeMetrics.bot_flags = flags;
              youtubeMetrics.analytics_needs_reauth = false;
            }
          } catch (analyticsError: any) {
            const code = analyticsError?.code ?? analyticsError?.status;
            // 403 = insufficient scope, 401 = invalid/expired token missing scope
            if (code === 403 || code === 401) {
              youtubeMetrics.analytics_needs_reauth = true;
              console.warn(
                `Analytics API auth error (${code}) for creator ${creator.id} — ` +
                `creator must reconnect YouTube account with yt-analytics.readonly scope`
              );
            } else {
              console.error(
                `Analytics API error for video ${sub.video_id}:`,
                analyticsError?.message,
                analyticsError?.errors
              );
            }
          }

          // Strip undefined keys to keep JSONB clean
          const cleanMetrics = Object.fromEntries(
            Object.entries(youtubeMetrics).filter(([, v]) => v !== undefined)
          );

          updates.push({
            id: sub.id,
            views: rawViews,
            newOtherStats: { youtube: cleanMetrics },
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
      await updateCpmContestBudgets(supabaseAdmin);
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
      await updateCpmContestBudgets(supabaseAdmin);
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
    await updateCpmContestBudgets(
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
