import { NextResponse } from "next/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { TikTokApiClient } from "@/lib/tiktok/api/TikTokApiClient";
import { TikTokProvider } from "@/lib/tiktok/provider/TikTokProvider";

// Type definition for the tiktok_account JSON object
type TikTokAccount = {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO String timestamp
  username?: string;
  open_id?: string;
  [key: string]: any;
};

type SubmissionUpdate = {
  id: string;
  views: number;
  newOtherStats: any;
  video_thumbnail_url?: string | null;
};

type TokenUpdate = {
  userId: string;
  newAccountData: TikTokAccount;
};

const isTokenExpired = (expiresAt: string): boolean =>
  new Date(expiresAt) <= new Date();

// Refresh TikTok token if needed
async function handleTokenRefresh(
  creator: any,
  tokenUpdates: TokenUpdate[],
): Promise<string | null> {
  const account = creator.tiktok_account as TikTokAccount;
  if (!account?.refresh_token || !isTokenExpired(account.expires_at)) {
    return account.access_token;
  }

  try {
    const provider = new TikTokProvider();
    const newTokens = await provider.refreshAccessToken(account.refresh_token);
    const newAccountData: TikTokAccount = {
      ...account,
      access_token: newTokens.accessToken,
      refresh_token: newTokens.refreshToken || account.refresh_token,
      expires_at: new Date(
        Date.now() + (newTokens.expiresIn || 86400) * 1000,
      ).toISOString(),
    };

    tokenUpdates.push({ userId: creator.id, newAccountData });
    return newTokens.accessToken;
  } catch (error) {
    console.error(
      `[TikTok Cron] Token refresh failed for creator ${creator.id}:`,
      error,
    );
    return null;
  }
}

// Extract TikTok video ID from a content link
function extractTikTokVideoId(contentLink: string): string | null {
  if (!contentLink) return null;

  // Match standard TikTok video URL: https://www.tiktok.com/@username/video/1234567890
  const match = contentLink.match(/video\/(\d+)/);
  if (match) return match[1];

  return null;
}

// Fetch and process TikTok stats
async function fetchTikTokStats(
  creator: any,
  videoIds: string[],
  accessToken: string,
  submissionsByCreator: Record<string, any[]>,
): Promise<SubmissionUpdate[]> {
  const updates: SubmissionUpdate[] = [];
  const now = new Date().toISOString();

  try {
    const apiClient = new TikTokApiClient();

    // TikTok queryVideos supports up to 20 video IDs at a time
    const chunkSize = 20;
    for (let i = 0; i < videoIds.length; i += chunkSize) {
      const chunk = videoIds.slice(i, i + chunkSize);

      const response = await apiClient.queryVideos(accessToken, chunk);
      const videos = response?.data?.videos || [];

      for (const video of videos) {
        const views = video.view_count || 0;
        const likes = video.like_count || 0;
        const comments = video.comment_count || 0;
        const shares = video.share_count || 0;

        const matchingSubmissions = submissionsByCreator[creator.id].filter(
          (s: any) => s.video_id === video.id,
        );

        for (const sub of matchingSubmissions) {
          // Preserve existing stats and update with fresh data
          const existingTikTok = (sub.other_stats?.tiktok || {}) as Record<
            string,
            any
          >;

          const tiktokMetrics: Record<string, any> = {
            views,
            likes,
            comments,
            shares,
            // Carry forward any existing extra data
            ...Object.fromEntries(
              Object.entries(existingTikTok).filter(
                ([key]) =>
                  ![
                    "views",
                    "likes",
                    "comments",
                    "shares",
                    "last_basic_update",
                  ].includes(key),
              ),
            ),
            last_basic_update: now,
          };

          updates.push({
            id: sub.id,
            views,
            newOtherStats: { tiktok: tiktokMetrics },
            video_thumbnail_url: video.cover_image_url || null,
          });
        }
      }
    }
  } catch (error: any) {
    console.error(
      `[TikTok Cron] API error for creator ${creator.id}:`,
      error.message,
    );
  }

  return updates;
}

// Batch update database records
async function batchUpdateDatabase(
  supabaseAdmin: any,
  updates: SubmissionUpdate[],
  tokenUpdates: TokenUpdate[],
): Promise<void> {
  const now = new Date().toISOString();

  // Update submissions
  const updatePromises = updates.map((update) =>
    supabaseAdmin
      .from("submissions")
      .update({
        views: update.views,
        other_stats: update.newOtherStats,
        ...(update.video_thumbnail_url
          ? { video_thumbnail_url: update.video_thumbnail_url }
          : {}),
        last_insights_update: now,
        updated_at: now,
      })
      .eq("id", update.id),
  );

  // Update tokens
  const tokenPromises = tokenUpdates.map((tokenUpdate) =>
    supabaseAdmin
      .from("creator_profiles")
      .update({
        tiktok_account: tokenUpdate.newAccountData,
        updated_at: now,
      })
      .eq("id", tokenUpdate.userId),
  );

  try {
    await Promise.allSettled([...updatePromises, ...tokenPromises]);
  } catch (error) {
    console.error("[TikTok Cron] Batch update failed:", error);
  }
}

// Function to update budget spent for CPM contests
async function updateCpmContestBudgets(
  supabaseAdmin: any,
  contestId?: string,
): Promise<void> {
  try {
    let contestsQuery = supabaseAdmin
      .from("contests")
      .select("id, contest_based_details, views_locked_at")
      .eq("contest_type", "cpm")
      .not("contest_based_details", "is", null)
      .is("views_locked_at", null);

    if (contestId) {
      contestsQuery = contestsQuery.eq("id", contestId);
    }

    const { data: contests, error } = await contestsQuery;

    if (error || !contests?.length) {
      return;
    }

    for (const contest of contests) {
      const cpmConfig = contest.contest_based_details?.cpm_contest;
      if (!cpmConfig?.cpm_rate_usd) continue;

      // Only process TikTok platform contests
      // Fetch contest platform to filter
      const { data: contestDetail } = await supabaseAdmin
        .from("contests")
        .select("platform, max_earnings_per_creator")
        .eq("id", contest.id)
        .single();

      if (contestDetail?.platform !== "tiktok") continue;

      const maxEarningsPerCreator =
        contestDetail?.max_earnings_per_creator || null;

      const { data: submissions } = await supabaseAdmin
        .from("submissions")
        .select(
          "views, creator_id, created_at, paid, bonus_paid, earnings, bonus_amount",
        )
        .eq("contest_id", contest.id)
        .in("status", ["verified", "paid"])
        .order("created_at", { ascending: true });

      if (!submissions?.length) continue;

      const creatorEarnings = new Map<
        string,
        { cpmTotal: number; bonusTotal: number }
      >();
      const flatFeeBonus = cpmConfig.flat_fee_bonus || 0;
      const flatFeeBonusCap = cpmConfig.flat_fee_bonus_cap || null;
      let totalBonusSpentSoFar = 0;
      const capInDollars = flatFeeBonusCap ? flatFeeBonusCap / 100 : null;

      for (const sub of submissions) {
        const creatorId = sub.creator_id;
        if (!creatorEarnings.has(creatorId)) {
          creatorEarnings.set(creatorId, { cpmTotal: 0, bonusTotal: 0 });
        }

        const creatorData = creatorEarnings.get(creatorId)!;

        if (sub.paid && sub.earnings != null) {
          creatorData.cpmTotal += sub.earnings / 100;
        } else {
          let views = sub.views || 0;
          if (cpmConfig.min_views && views < cpmConfig.min_views) views = 0;
          if (cpmConfig.max_views && views > cpmConfig.max_views)
            views = cpmConfig.max_views;

          const submissionEarnings = (views * cpmConfig.cpm_rate_usd) / 1000;

          if (maxEarningsPerCreator) {
            const maxEarningsInDollars = maxEarningsPerCreator / 100;
            const remainingCap = maxEarningsInDollars - creatorData.cpmTotal;
            if (remainingCap > 0) {
              creatorData.cpmTotal += Math.min(
                submissionEarnings,
                remainingCap,
              );
            }
          } else {
            creatorData.cpmTotal += submissionEarnings;
          }
        }

        if (sub.bonus_paid && sub.bonus_amount != null) {
          const actualBonus = sub.bonus_amount / 100;
          creatorData.bonusTotal += actualBonus;
          totalBonusSpentSoFar += actualBonus;
        } else if (flatFeeBonus > 0) {
          const bonusAmount = flatFeeBonus / 100;
          if (
            capInDollars === null ||
            totalBonusSpentSoFar + bonusAmount <= capInDollars
          ) {
            creatorData.bonusTotal += bonusAmount;
            totalBonusSpentSoFar += bonusAmount;
          }
        }
      }

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
    console.error("[TikTok Cron] CPM budget update failed:", error);
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    // Check if this is a contest-specific refresh
    const url = new URL(request.url);
    const contestId = url.searchParams.get("contestId");
    const isContestSpecific = !!contestId;

    // Determine active contests
    let activeIds: string[] | undefined = undefined;
    if (isContestSpecific) {
      const { data: c } = await supabaseAdmin
        .from("contests")
        .select("id, views_locked_at")
        .eq("id", contestId)
        .single();
      if (!c || c.views_locked_at) {
        return NextResponse.json({
          message: `Contest ${contestId} is finalized or not found; nothing to update`,
        });
      }
    } else {
      // For non-contest-specific, get all active TikTok contests
      const { data: activeContests } = await supabaseAdmin
        .from("contests")
        .select("id")
        .eq("platform", "tiktok")
        .is("views_locked_at", null);
      activeIds = (activeContests || []).map((c: any) => c.id);
      if (!activeIds.length) {
        return NextResponse.json({
          message: "No active TikTok contests to update",
        });
      }
    }

    // Fetch TikTok submissions to update
    let submissionsQuery = supabaseAdmin
      .from("submissions")
      .select(
        "id, creator_id, content_link, views, contest_id, created_at, other_stats, video_id",
      )
      .in("status", ["verified", "pending"])
      .eq("platform", "tiktok")
      .not("content_link", "is", null);

    if (isContestSpecific) {
      submissionsQuery = submissionsQuery.eq("contest_id", contestId);
      console.log(
        `[TikTok Cron] Contest-specific metrics update for contest: ${contestId}`,
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
        message: `No TikTok submissions to update${
          isContestSpecific ? ` for contest ${contestId}` : ""
        }`,
      });
    }

    // Group submissions by creator
    const submissionsByCreator = submissions.reduce(
      (acc, sub) => {
        // Use video_id column if available, otherwise extract from content_link
        const videoId = sub.video_id || extractTikTokVideoId(sub.content_link);
        if (videoId) {
          if (!acc[sub.creator_id]) acc[sub.creator_id] = [];
          acc[sub.creator_id].push({ ...sub, video_id: videoId });
        }
        return acc;
      },
      {} as Record<string, any[]>,
    );

    const creatorIds = Object.keys(submissionsByCreator);
    if (!creatorIds.length) {
      await updateCpmContestBudgets(supabaseAdmin, contestId || undefined);
      return NextResponse.json({
        message: "No valid TikTok video IDs found",
      });
    }

    // Fetch creators with TikTok accounts
    const { data: creators, error: creatorsError } = await supabaseAdmin
      .from("creator_profiles")
      .select("id, tiktok_account")
      .in("id", creatorIds)
      .not("tiktok_account", "is", null);

    if (creatorsError)
      throw new Error(`Creator fetch failed: ${creatorsError.message}`);
    if (!creators?.length) {
      await updateCpmContestBudgets(supabaseAdmin, contestId || undefined);
      return NextResponse.json({
        message: "No connected TikTok accounts found",
      });
    }

    // Process each creator
    const allUpdates: SubmissionUpdate[] = [];
    const tokenUpdates: TokenUpdate[] = [];

    for (const creator of creators) {
      const accessToken = await handleTokenRefresh(creator, tokenUpdates);
      if (!accessToken) continue;

      const videoIds = [
        ...new Set(
          submissionsByCreator[creator.id].map((s: any) => s.video_id),
        ),
      ];
      const updates = await fetchTikTokStats(
        creator,
        videoIds,
        accessToken,
        submissionsByCreator,
      );
      allUpdates.push(...updates);
    }

    // Batch update database
    await batchUpdateDatabase(supabaseAdmin, allUpdates, tokenUpdates);

    // Update CPM contest budgets for TikTok contests
    await updateCpmContestBudgets(
      supabaseAdmin,
      isContestSpecific ? contestId! : undefined,
    );

    return NextResponse.json({
      message: `Updated ${allUpdates.length} TikTok submissions${
        isContestSpecific ? ` for contest ${contestId}` : ""
      }`,
    });
  } catch (error: any) {
    console.error("[TikTok Cron] Job failed:", error);
    return NextResponse.json(
      { error: `TikTok cron job failed: ${error.message}` },
      { status: 500 },
    );
  }
}
