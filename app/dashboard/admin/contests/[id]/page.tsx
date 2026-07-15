import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";
import ContestDetailClient from "../../../contests/[id]/contest-detail-client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { isMilestoneContestType } from "@/lib/contest-type";
import { REVERSAL_TRANSACTION_REMARK } from "@/lib/payment-utils";
import {
  fetchContestSubmissionsAllPages,
  formatSubmissionFetchError,
} from "@/lib/fetch-contest-submissions";
import {
  fetchLiveTrustMetricsByCreatorIds,
  getCreatorTrustScoreFromMetrics,
  isVideoContestFormat,
  resolveCreatorTrustMetrics,
} from "@/lib/trust-score";
import { fetchLiveQualityMetricsByCreatorIds } from "@/lib/quality-score";
import { resolveCreatorEligibilityProfileFields, getCreatorProfileQualityScoreSum } from "@/lib/creator-requirements";

async function fetchTwitterTweetsAllPages(
  supabase: any,
  contestId: string,
  selectBody: string,
  chunkSize: number,
  maxRows: number,
): Promise<{ data: any[] | null; error: any }> {
  const first = await supabase
    .from("twitter_campaign_tweets")
    .select(selectBody, { count: "exact" })
    .eq("contest_id", contestId)
    .or(
      "is_eligible.eq.true,deleted_at.not.is.null,excluded_by_submission_cap.eq.false",
    )
    .order("tweet_created_at", { ascending: false })
    .range(0, chunkSize - 1);

  if (first.error) {
    return { data: null, error: first.error };
  }

  const rows = [...(first.data || [])];
  const total = typeof first.count === "number" ? first.count : rows.length;
  let offset = rows.length;

  while (offset < total && offset < maxRows) {
    const end = Math.min(offset + chunkSize - 1, maxRows - 1);
    const next = await supabase
      .from("twitter_campaign_tweets")
      .select(selectBody)
      .eq("contest_id", contestId)
      .or(
        "is_eligible.eq.true,deleted_at.not.is.null,excluded_by_submission_cap.eq.false",
      )
      .order("tweet_created_at", { ascending: false })
      .range(offset, end);

    if (next.error) {
      return { data: rows, error: next.error };
    }
    const chunk = next.data || [];
    if (chunk.length === 0) break;
    rows.push(...chunk);
    offset += chunk.length;
  }

  return { data: rows, error: null };
}

export default async function AdminContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const contestId = resolvedParams.id;

  // Verify admin access
  const { isAdmin, error } = await verifyAdminAccess();

  if (!isAdmin) {
    console.log(
      "Non-admin user attempted to access admin contest detail:",
      error
    );
    redirect("/dashboard");
  }

  const supabase = await createClient();

  try {
    // Admin users can access any contest (no advertiser_id filter)
    const { data: contestData } = await supabase
      .from("contests_with_status")
      .select("*")
      .eq("id", contestId)
      .single();

    console.log("Admin accessing contestData:", contestData);
    console.log("Contest status:", contestData.status);
    console.log("Contest moderation_status:", contestData.moderation_status);
    console.log(
      "Contest post_contest_status:",
      contestData.post_contest_status
    );

    if (!contestData) {
      redirect("/dashboard/admin/contests");
    }

    const isVideoContest = isVideoContestFormat(contestData.contest_format);

    // Contest settings live on contests table; contests_with_status view may not include them
    let contestSettings: {
      payout_adjustment_percentage: number | null;
      payout_adjustment_mode: string | null;
      trust_score: number | null;
      trust_number: number | null;
      min_best_quality_score: number | null;
      min_avg_quality_score: number | null;
      min_quality_score: number | null;
      min_platform_earnings: number | null;
      min_platform_views: number | null;
    } = {
      payout_adjustment_percentage: null,
      payout_adjustment_mode: null,
      trust_score: null,
      trust_number: null,
      min_best_quality_score: null,
      min_avg_quality_score: null,
      min_quality_score: null,
      min_platform_earnings: null,
      min_platform_views: null,
    };
    const { data: payoutRow } = await supabase
      .from("contests")
      .select(
        "payout_adjustment_percentage, payout_adjustment_mode, trust_score, trust_number, min_best_quality_score, min_avg_quality_score, min_quality_score, min_platform_earnings, min_platform_views",
      )
      .eq("id", contestId)
      .maybeSingle();
    if (payoutRow) {
      contestSettings = {
        payout_adjustment_percentage: payoutRow.payout_adjustment_percentage ?? null,
        payout_adjustment_mode: payoutRow.payout_adjustment_mode ?? null,
        trust_score: payoutRow.trust_score ?? null,
        trust_number: payoutRow.trust_number ?? null,
        min_best_quality_score: payoutRow.min_best_quality_score ?? null,
        min_avg_quality_score: payoutRow.min_avg_quality_score ?? null,
        min_quality_score: payoutRow.min_quality_score ?? null,
        min_platform_earnings: payoutRow.min_platform_earnings ?? null,
        min_platform_views: payoutRow.min_platform_views ?? null,
      };
    }

    let postCampaignLastMetricsUpdated: string | null = null;
    {
      const { data: pcRow } = await supabase
        .from("contests")
        .select("post_campaign_last_metrics_updated")
        .eq("id", contestId)
        .maybeSingle();
      postCampaignLastMetricsUpdated =
        pcRow?.post_campaign_last_metrics_updated ?? null;
    }

    // Remove all legacy parsing and filtering for inspiration_links
    const finalInspirationLinks = Array.isArray(contestData.inspiration_links)
      ? contestData.inspiration_links
      : [];

    // Check if this is a Twitter campaign
    // Twitter campaigns can be identified by:
    // 1. platform === "twitter" or "x"
    // 2. contest_format === "text_image" (for Twitter text/image campaigns)
    const isTwitterCampaign =
      (contestData.platform?.toLowerCase() === "twitter" ||
        contestData.platform?.toLowerCase() === "x") &&
      contestData.contest_format === "text_image";

    console.log(`[Admin page.tsx] Contest detection:`, {
      platform: contestData.platform,
      contest_format: contestData.contest_format,
      isTwitterCampaign,
    });

    // Fetch submissions (paginated; PostgREST caps at 1000 rows per request)
    const SUBMISSIONS_SELECT = `
        id,
        created_at,
        content_link,
        status,
        views, 
        earnings,
        other_stats,
        insights_status,
        last_insights_update,
        platform,
        video_id,
        video_thumbnail_url,
        video_title,
        creator_id,
        paid,
        paid_at,
        bonus_paid,
        bonus_paid_at,
        bonus_amount,
        milestone_bonus_paid,
        metadata,
        quality_score
      `;
    type AdminContestSubmissionRow = {
      creator_id?: string | null;
      [key: string]: unknown;
    };
    const { data: submissionsData, error: submissionsError } =
      await fetchContestSubmissionsAllPages<AdminContestSubmissionRow>(
        supabase,
        contestId,
        SUBMISSIONS_SELECT,
      );

    const submissionsFetchError = submissionsError
      ? formatSubmissionFetchError(submissionsError)
      : undefined;

    if (submissionsError) {
      console.error(
        `Admin: Supabase error fetching submissions for contest ${contestId}:`,
        submissionsError
      );
    }

    // Same as brand contest page: per-track ledger for most-verified milestone bonuses (admin UI).
    let milestoneBonusPaidByCreator: Record<
      string,
      { viewsPaidCents: number; reelsPaidCents: number }
    > = {};
    if (isMilestoneContestType(contestData.contest_type)) {
      try {
        const supabaseAdmin = createAdminClient();
        const [{ data: milestoneRewards }, { data: milestoneRefunds }] =
          await Promise.all([
            supabaseAdmin
              .from("money_transactions")
              .select("amount, metadata, user_id")
              .eq("type", "reward")
              .eq("status", "success")
              .contains("metadata", { contest_id: contestId }),
            supabaseAdmin
              .from("money_transactions")
              .select("amount, metadata, remarks, user_id")
              .eq("type", "refund")
              .contains("metadata", { contest_id: contestId }),
          ]);

        const addByTrack = (
          row: any,
          sign: 1 | -1,
          acc: Map<string, { views: number; reels: number }>,
        ) => {
          const creatorId = String(row?.user_id || "").trim();
          if (!creatorId) return;
          const bt = String(row?.metadata?.bonus_type || "");
          const amount = Number(row?.amount) || 0;
          if (amount <= 0) return;
          if (
            bt !== "milestone_most_verified_views" &&
            bt !== "milestone_most_verified_reels"
          )
            return;
          const cur = acc.get(creatorId) || { views: 0, reels: 0 };
          if (bt === "milestone_most_verified_views") {
            cur.views += sign * amount;
          } else {
            cur.reels += sign * amount;
          }
          acc.set(creatorId, cur);
        };

        const paidByTrack = new Map<string, { views: number; reels: number }>();
        (milestoneRewards || []).forEach((r: any) => addByTrack(r, 1, paidByTrack));
        (milestoneRefunds || [])
          .filter(
            (r: any) => !r?.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK,
          )
          .forEach((r: any) => addByTrack(r, -1, paidByTrack));

        paidByTrack.forEach((v, creatorId) => {
          milestoneBonusPaidByCreator[creatorId] = {
            viewsPaidCents: Math.max(0, v.views || 0),
            reelsPaidCents: Math.max(0, v.reels || 0),
          };
        });
      } catch (err) {
        console.error(
          "[admin contest page] Error fetching milestone bonus paid split by track:",
          err,
        );
      }
    }

    // For Twitter campaigns, fetch tweets from twitter_campaign_tweets table
    let twitterTweetsData: any[] = [];
    const TWITTER_PAGE_CHUNK = 500;
    const TWITTER_PAGE_MAX = 10_000;

    if (isTwitterCampaign) {
      let tweetsData: any = null;
      let tweetsError: any = null;

      const selectFull = `
        id,
        tweet_id,
        tweet_url,
        tweet_text,
        tweet_created_at,
        tweet_type,
        twitter_username,
        creator_id,
        likes,
        replies,
        retweets,
        quote_reposts,
        impressions,
        points,
        is_eligible,
        moderation_status,
        manual_points_adjustment,
        manual_points_reason,
        earnings,
        deleted_at,
        excluded_by_submission_cap,
        first_fetched_at,
        last_updated_at,
        bonus_paid,
        bonus_paid_at,
        bonus_amount
      `;

      const selectBasic = `
          id,
          tweet_id,
          tweet_url,
          tweet_text,
          tweet_created_at,
          tweet_type,
          twitter_username,
          creator_id,
          likes,
          replies,
          retweets,
          quote_reposts,
          impressions,
          points,
          is_eligible,
          deleted_at,
          excluded_by_submission_cap,
          first_fetched_at,
          last_updated_at
        `;

      let result = await fetchTwitterTweetsAllPages(
        supabase,
        contestId,
        selectFull,
        TWITTER_PAGE_CHUNK,
        TWITTER_PAGE_MAX,
      );
      tweetsData = result.data;
      tweetsError = result.error;

      if (tweetsError && tweetsError.code === "42703") {
        console.log(
          `[Admin page.tsx] Some columns don't exist, fetching without them`,
        );
        result = await fetchTwitterTweetsAllPages(
          supabase,
          contestId,
          selectBasic,
          TWITTER_PAGE_CHUNK,
          TWITTER_PAGE_MAX,
        );
        tweetsData = result.data;
        tweetsError = result.error;
      }

      if (tweetsError) {
        console.error(
          `[Admin page.tsx] Supabase error fetching Twitter tweets for contest ${contestId}:`,
          tweetsError
        );
        twitterTweetsData = [];
      } else {
        // Set defaults for any missing fields
        twitterTweetsData = (tweetsData || []).map((tweet: any) => ({
          ...tweet,
          moderation_status: tweet.moderation_status || "pending", // Default to pending if NULL or column doesn't exist
          manual_points_adjustment: tweet.manual_points_adjustment || 0,
          manual_points_reason: tweet.manual_points_reason || null,
          created_at:
            tweet.first_fetched_at ||
            tweet.last_updated_at ||
            tweet.tweet_created_at, // Use first_fetched_at as created_at
        }));
        console.log(
          `[Admin page.tsx] Fetched ${twitterTweetsData.length} Twitter tweets for contest ${contestId}`,
          twitterTweetsData.length > 0
            ? `Sample tweet: ${JSON.stringify(twitterTweetsData[0], null, 2)}`
            : "No tweets found"
        );
      }
    }

    // For Twitter campaigns, fetch creator-level leaderboard data from twitter_campaign_leaderboard
    let creatorModerationData: Record<
      string,
      {
        moderation_status?: string;
        rejection_reason?: string | null;
        manual_points_adjustment?: number;
        manual_points_reason?: string | null;
        total_points?: number;
        total_eligible_tweets?: number;
        total_likes?: number;
        total_replies?: number;
        total_retweets?: number;
        total_quote_reposts?: number;
        total_impressions?: number;
        current_rank?: number;
        paid_at?: string | null;
        earnings?: number;
        paid_rank?: number | null;
      }
    > = {};
    if (isTwitterCampaign) {
      try {
        const { data: leaderboardData, error: leaderboardError } =
          await supabase
            .from("twitter_campaign_leaderboard")
            .select(
              "creator_id, moderation_status, rejection_reason, manual_points_adjustment, manual_points_reason, total_points, total_eligible_tweets, total_likes, total_replies, total_retweets, total_quote_reposts, total_impressions, current_rank, paid_at, earnings, paid_rank"
            )
            .eq("contest_id", contestId);

        if (leaderboardError) {
          console.error(
            `[Admin page.tsx] Error fetching creator leaderboard data:`,
            leaderboardError
          );
        } else if (leaderboardData) {
          // Create a map of creator_id -> leaderboard data
          leaderboardData.forEach((entry: any) => {
            if (entry.creator_id) {
              creatorModerationData[entry.creator_id] = {
                moderation_status: entry.moderation_status || "pending",
                rejection_reason: entry.rejection_reason || null,
                manual_points_adjustment: entry.manual_points_adjustment || 0,
                manual_points_reason: entry.manual_points_reason || null,
                total_points: entry.total_points || 0,
                total_eligible_tweets: entry.total_eligible_tweets || 0,
                total_likes: entry.total_likes || 0,
                total_replies: entry.total_replies || 0,
                total_retweets: entry.total_retweets || 0,
                total_quote_reposts: entry.total_quote_reposts || 0,
                total_impressions: entry.total_impressions || 0,
                current_rank: entry.current_rank || null,
                paid_at: entry.paid_at || null,
                earnings: entry.earnings || 0,
                paid_rank: entry.paid_rank || null,
              };
            }
          });
        }
      } catch (error) {
        console.error(
          `[Admin page.tsx] Error fetching creator leaderboard data:`,
          error
        );
      }
    }

    // Fetch creator profiles and user data for the submissions and Twitter tweets
    let creatorProfilesData: any[] = [];
    let usersData: any[] = [];
    let liveGlobalTrustMetricsByCreatorId: Record<string, any> = {};
    let liveGlobalQualityMetricsByCreatorId: Record<string, any> = {};

    // Combine creator IDs from both submissions and Twitter tweets
    const allCreatorIds = new Set<string>();
    if (submissionsData && submissionsData.length > 0) {
      submissionsData.forEach((sub) => {
        if (sub.creator_id) allCreatorIds.add(String(sub.creator_id));
      });
    }
    if (twitterTweetsData && twitterTweetsData.length > 0) {
      twitterTweetsData.forEach((tweet) => {
        if (tweet.creator_id) allCreatorIds.add(tweet.creator_id);
      });
    }

    if (allCreatorIds.size > 0) {
      const creatorIds = Array.from(allCreatorIds);

      if (creatorIds.length > 0) {
        // Fetch creator profiles (including Twitter accounts for Twitter campaigns)
        const { data: profilesData, error: profilesError } = await supabase
          .from("creator_profiles")
          .select(
            `
            id,
            youtube_account,
            instagram_account,
            instagram_archive,
            twitter_account,
            trust_score_metrics,
            avg_quality_score,
            best_quality_score,
            quality_score_sum,
            total_money_won,
            total_views
          `
          )
          .in("id", creatorIds);

        if (profilesError) {
          console.error(
            `Admin: Supabase error fetching creator profiles:`,
            profilesError
          );
        } else {
          creatorProfilesData = profilesData || [];
        }

        if (isVideoContest) {
          const supabaseAdmin = createAdminClient();
          liveGlobalTrustMetricsByCreatorId =
            await fetchLiveTrustMetricsByCreatorIds(supabaseAdmin, creatorIds);
          liveGlobalQualityMetricsByCreatorId =
            await fetchLiveQualityMetricsByCreatorIds(supabaseAdmin, creatorIds);
        }

        // Fetch users for additional fallbacks
        const { data: fetchedUsers, error: usersError } = await supabase
          .from("users")
          .select(
            `
            id,
            full_name,
            username,
            profile_picture_url
          `
          )
          .in("id", creatorIds);

        if (usersError) {
          console.error(`Admin: Supabase error fetching users:`, usersError);
        } else {
          usersData = fetchedUsers || [];
        }
      }
    }

    const getCreatorTrustMetrics = (
      creatorProfile: any,
      creatorId?: string | null,
    ) =>
      isVideoContest
        ? resolveCreatorTrustMetrics(
            creatorProfile,
            creatorId,
            liveGlobalTrustMetricsByCreatorId,
          )
        : null;

    const getCreatorTrustScore = (
      creatorProfile: any,
      creatorId?: string | null,
    ): number | null =>
      isVideoContest
        ? getCreatorTrustScoreFromMetrics(
            creatorProfile,
            creatorId,
            liveGlobalTrustMetricsByCreatorId,
          )
        : null;

    const getCreatorEligibilityFields = (
      creatorProfile: any,
      creatorId?: string | null,
    ) => {
      if (!isVideoContest || !creatorId) {
        return {
          avg_quality_score: null,
          best_quality_score: null,
          quality_score_sum: null,
          total_money_won: 0,
          total_views: 0,
          quality_score_counts: { score1: 0, score2: 0, score3: 0 },
        };
      }
      const resolved = resolveCreatorEligibilityProfileFields(
        creatorProfile,
        liveGlobalQualityMetricsByCreatorId[creatorId] ?? null,
      );
      const liveQuality = liveGlobalQualityMetricsByCreatorId[creatorId];
      return {
        avg_quality_score: resolved.avgQualityScore,
        best_quality_score: resolved.bestQualityScore,
        quality_score_sum: getCreatorProfileQualityScoreSum(creatorProfile),
        total_money_won: resolved.totalPlatformEarningsCents,
        total_views: resolved.totalViews,
        quality_score_counts: liveQuality?.quality_score_counts ?? {
          score1: 0,
          score2: 0,
          score3: 0,
        },
      };
    };

    const calculateDurationDays = (
      start: string | null,
      end: string | null
    ): number | null => {
      if (!start || !end) return null;
      try {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
      } catch (error) {
        console.error("Error calculating duration:", error);
        return null;
      }
    };

    const durationDays = calculateDurationDays(
      contestData.start_date,
      contestData.end_date
    );

    // Prepare contest data for the client component
    const contest = {
      id: contestData.id,
      title: contestData.title,
      status: contestData.status,
      moderation_status: contestData.moderation_status,
      post_contest_status: contestData.post_contest_status,
      thumbnail_url: contestData.thumbnail_url,
      brief_html: contestData.brief_html,
      platform: contestData.platform,
      start_date: contestData.start_date,
      end_date: contestData.end_date,
      rules_html: contestData.rules_html,
      inspiration_links: finalInspirationLinks,
      resources: contestData.resources,
      contest_type: contestData.contest_type,
      contest_based_details: contestData.contest_based_details,
      last_metrics_updated: contestData.last_metrics_updated,
      post_campaign_last_metrics_updated: postCampaignLastMetricsUpdated,
      // Add other moderation fields for completeness
      submitted_for_approval_at: contestData.submitted_for_approval_at,
      approved_at: contestData.approved_at,
      approved_by: contestData.approved_by,
      published_at: contestData.published_at,
      rejection_reason: contestData.rejection_reason,
      // New features (2025-10-01)
      multiple_submissions_enabled: contestData.multiple_submissions_enabled,
      max_submissions_per_creator: contestData.max_submissions_per_creator,
      content_type: contestData.content_type,
      bonus_details: contestData.bonus_details,
      max_earnings_per_creator: contestData.max_earnings_per_creator,
      // Categories, subcategories, interests, and region
      categories: contestData.categories,
      subcategories: contestData.subcategories,
      interests: contestData.interests,
      region: contestData.region,
      // Twitter-specific fields (all stored in contest_based_details.twitter_campaign)
      contest_format: contestData.contest_format,
      // Payout adjustment (admin) – from contests table so they fill on refresh
      payout_adjustment_percentage: contestSettings.payout_adjustment_percentage,
      payout_adjustment_mode: contestSettings.payout_adjustment_mode,
      trust_score: isVideoContest
        ? (contestSettings.trust_score ?? contestData.trust_score ?? null)
        : null,
      trust_number: isVideoContest
        ? (contestSettings.trust_number ?? contestData.trust_number ?? null)
        : null,
      min_best_quality_score: isVideoContest
        ? (contestSettings.min_best_quality_score ??
          contestData.min_best_quality_score ??
          null)
        : null,
      min_avg_quality_score: isVideoContest
        ? (contestSettings.min_avg_quality_score ??
          contestData.min_avg_quality_score ??
          null)
        : null,
      min_quality_score: isVideoContest
        ? (contestSettings.min_quality_score ??
          contestData.min_quality_score ??
          null)
        : null,
      min_platform_earnings: isVideoContest
        ? (contestSettings.min_platform_earnings ??
          contestData.min_platform_earnings ??
          null)
        : null,
      min_platform_views: isVideoContest
        ? (contestSettings.min_platform_views ??
          contestData.min_platform_views ??
          null)
        : null,
    };

    // Transform Twitter tweets into submission-like format for display
    const twitterSubmissions = twitterTweetsData
      ? twitterTweetsData.map((tweet: any) => {
        let creatorDisplayName: string | null = null;
        let creatorUsername: string | null = null;
        let creatorAvatarUrl: string | null = null;
        const actualCreatorProfileId: string | null = tweet.creator_id;

        // Find the creator profile and user for this tweet
        const creatorProfile = creatorProfilesData.find(
          (profile) => profile.id === tweet.creator_id
        );
        const user = usersData.find((u) => u.id === tweet.creator_id);

        // Prefer tweet's twitter_username for platform handle (creator_username) so admin sees the handle that posted
        if (tweet.twitter_username) {
          creatorUsername = tweet.twitter_username;
        }
        // Try to get Twitter account info for display name and avatar (and fallback username)
        if (creatorProfile?.twitter_account) {
          try {
            const twitterAccount =
              typeof creatorProfile.twitter_account === "string"
                ? JSON.parse(creatorProfile.twitter_account)
                : creatorProfile.twitter_account;
            creatorDisplayName =
              twitterAccount?.name || twitterAccount?.username;
            if (!creatorUsername)
              creatorUsername =
                twitterAccount?.username || tweet.twitter_username;
            creatorAvatarUrl = twitterAccount?.profile_picture_url;
          } catch (e) {
            console.error(
              "[Admin page.tsx] Error parsing Twitter account JSON:",
              e
            );
          }
        }

        // Fallback to tweet data for platform username
        if (!creatorUsername) {
          creatorUsername = tweet.twitter_username || "Unknown User";
        }

        // Fallback to user data
        if (!creatorDisplayName && user?.full_name) {
          creatorDisplayName = user.full_name;
        }
        if (!creatorUsername && user?.username) {
          creatorUsername = user.username;
        }
        if (!creatorAvatarUrl && user?.profile_picture_url) {
          creatorAvatarUrl = user.profile_picture_url;
        }

        // Final fallbacks
        if (!creatorDisplayName) {
          creatorDisplayName =
            user?.full_name || user?.username || "Unknown Creator";
        }
        if (!creatorUsername) {
          creatorUsername =
            user?.username || tweet.twitter_username || "Unknown User";
        }

        // Calculate total points (base + manual adjustment)
        const basePoints = tweet.points || 0;
        const manualAdjustment = tweet.manual_points_adjustment || 0;
        const totalPoints = basePoints + manualAdjustment;

        // Get moderation_status (default to "pending" if column doesn't exist)
        const moderationStatus =
          (tweet as any).moderation_status || "pending";
        const tweetPaid = moderationStatus === "paid";
        const storedEarnings =
          typeof (tweet as any).earnings === "number" &&
          (tweet as any).earnings > 0
            ? (tweet as any).earnings
            : null;
        const isCpmTwitter = contestData.contest_type === "cpm";
        const cpmRate =
          (contestData.contest_based_details as any)?.cpm_contest
            ?.cpm_rate_usd || 0;
        const tweetTotalPoints = (tweet.points || 0) + manualAdjustment;
        const computedEarningsCents =
          isCpmTwitter && tweetPaid && cpmRate > 0
            ? Math.round(((tweetTotalPoints * cpmRate) / 1000) * 100)
            : null;

        return {
          id: tweet.id,
          created_at: tweet.tweet_created_at || tweet.created_at,
          content_link: tweet.tweet_url,
          status: moderationStatus, // Use moderation_status as status
          views: tweet.impressions || 0,
          earnings: tweetPaid
            ? storedEarnings ?? computedEarningsCents
            : null,
          other_stats: {
            likes: tweet.likes || 0,
            replies: tweet.replies || 0,
            retweets: tweet.retweets || 0,
            quote_reposts: tweet.quote_reposts || 0,
            impressions: tweet.impressions || 0,
            points: totalPoints,
            base_points: basePoints,
            manual_points_adjustment: manualAdjustment,
            manual_points_reason: tweet.manual_points_reason,
            tweet_type: tweet.tweet_type,
            tweet_text: tweet.tweet_text,
          },
          platform: "twitter",
          video_thumbnail_url: null,
          video_title: tweet.tweet_text?.substring(0, 100) || null,
          paid: tweetPaid,
          paid_at: null,
          // Source of truth: twitter_campaign_tweets.bonus_paid / bonus_amount /
          // bonus_paid_at. Fall back to false/null when the columns are missing
          // (legacy DBs without the bonus_columns migration); the client effect
          // will then hydrate via /api/contests/[id]/twitter-bonus-status.
          bonus_paid: (tweet as any).bonus_paid === true,
          bonus_paid_at: (tweet as any).bonus_paid_at ?? null,
          bonus_amount: (tweet as any).bonus_amount ?? null,
          creator_display_name: creatorDisplayName,
          creator_username: creatorUsername,
          creator_avatar_url: creatorAvatarUrl,
          creator_id: actualCreatorProfileId,
          trust_score: getCreatorTrustScore(
            creatorProfile,
            actualCreatorProfileId,
          ),
          trust_score_metrics: getCreatorTrustMetrics(
            creatorProfile,
            actualCreatorProfileId,
          ),
          // Explicit username from users table for creator-wise view (main line); creator_username = platform handle (second line)
          user_username: user?.username || null,
          // Mark as Twitter tweet for UI handling
          is_twitter_tweet: true,
          tweet_id: tweet.tweet_id,
          moderation_status: moderationStatus, // Default to "pending" if column doesn't exist
          manual_points_adjustment: manualAdjustment,
          manual_points_reason: tweet.manual_points_reason,
          is_eligible: (tweet as any).is_eligible === true,
          deleted_at: (tweet as any).deleted_at ?? null,
          excluded_by_submission_cap:
            (tweet as any).excluded_by_submission_cap ?? false,
          // Add nested creator object for compatibility
          creator: {
            id: actualCreatorProfileId,
            username: creatorUsername,
            profile_picture_url: creatorAvatarUrl,
            full_name: creatorDisplayName,
            trust_score: getCreatorTrustScore(
              creatorProfile,
              actualCreatorProfileId,
            ),
            trust_score_metrics: getCreatorTrustMetrics(
              creatorProfile,
              actualCreatorProfileId,
            ),
            ...getCreatorEligibilityFields(
              creatorProfile,
              actualCreatorProfileId,
            ),
          },
        };
      })
      : [];

    // Prepare regular submissions data
    const submissions = submissionsData
      ? submissionsData.map((sub: any) => {
        let creatorDisplayName: string | null = null;
        let creatorUsername: string | null = null;
        let creatorAvatarUrl: string | null = null;
        const actualCreatorProfileId: string | null = sub.creator_id;

        // Find the creator profile and user for this submission
        const creatorProfile = creatorProfilesData.find(
          (profile) => profile.id === sub.creator_id
        );
        const user = usersData.find((u) => u.id === sub.creator_id);

        // Prioritize user's profile_picture_url over YouTube/Instagram profile pictures
        creatorAvatarUrl = user?.profile_picture_url || null;

        if (creatorProfile) {
          const platform = sub.platform?.toLowerCase();

          try {
            if (
              platform?.includes("youtube") &&
              creatorProfile.youtube_account
            ) {
              const ytAccount =
                typeof creatorProfile.youtube_account === "string"
                  ? JSON.parse(creatorProfile.youtube_account)
                  : creatorProfile.youtube_account;
              creatorDisplayName = ytAccount?.channel_title;
              creatorUsername =
                ytAccount?.channel_custom_url || ytAccount?.channel_id;
            } else if (
              platform?.includes("instagram") &&
              creatorProfile.instagram_account
            ) {
              const igAccount =
                typeof creatorProfile.instagram_account === "string"
                  ? JSON.parse(creatorProfile.instagram_account)
                  : creatorProfile.instagram_account;
              // Mirror the working contests page mapping exactly
              creatorDisplayName =
                igAccount?.name_of_account ||
                igAccount?.full_name ||
                igAccount?.display_name;
              creatorUsername = igAccount?.username;
            }
          } catch (e) {
            console.error("Admin: Error parsing social account JSON:", e);
            // Keep username/avatar as null if parsing fails
          }

          // Fallbacks from user record
          if (!creatorDisplayName && user?.full_name)
            creatorDisplayName = user.full_name;
          if (!creatorUsername && user?.username)
            creatorUsername = user.username;

          // Final defaults
          if (!creatorDisplayName) creatorDisplayName = "Unknown Creator";
          if (!creatorUsername) creatorUsername = "unknown";
          // Ensure we have a profile picture (already set above, but keep as fallback)
          if (!creatorAvatarUrl) {
            creatorAvatarUrl = user?.profile_picture_url || null;
          }
        } else {
          creatorDisplayName =
            user?.full_name || user?.username || "Unknown Creator";
          creatorUsername = user?.username || "unknown";
          creatorAvatarUrl = user?.profile_picture_url || null;
        }

        return {
          id: sub.id,
          created_at: sub.created_at,
          content_link: sub.content_link,
          status: sub.status,
          views: sub.views,
          earnings: sub.earnings,
          other_stats: sub.other_stats,
          metadata: sub.metadata,
          insights_status: (sub as any).insights_status ?? null,
          last_insights_update: (sub as any).last_insights_update ?? null,
          platform: sub.platform,
          video_id: sub.video_id ?? null,
          video_thumbnail_url: sub.video_thumbnail_url,
          video_title: sub.video_title,
          creator_display_name: creatorDisplayName,
          creator_username: creatorUsername,
          creator_avatar_url: creatorAvatarUrl,
          creator_id: actualCreatorProfileId,
          trust_score: getCreatorTrustScore(
            creatorProfile,
            actualCreatorProfileId,
          ),
          trust_score_metrics: getCreatorTrustMetrics(
            creatorProfile,
            actualCreatorProfileId,
          ),
          // Explicit username from users table for creator-wise view (main line); creator_username = platform handle (second line)
          user_username: user?.username || null,
          paid: sub.paid,
          paid_at: sub.paid_at,
          bonus_paid: sub.bonus_paid,
          bonus_paid_at: sub.bonus_paid_at,
          bonus_amount: sub.bonus_amount,
          milestone_bonus_paid: sub.milestone_bonus_paid ?? null,
          // Add nested creator object for creator-wise grouping compatibility
          creator: {
            id: actualCreatorProfileId,
            username: creatorUsername,
            profile_picture_url: creatorAvatarUrl,
            full_name: creatorDisplayName,
            instagram_archive: creatorProfile?.instagram_archive ?? null,
            trust_score: getCreatorTrustScore(
              creatorProfile,
              actualCreatorProfileId,
            ),
            trust_score_metrics: getCreatorTrustMetrics(
              creatorProfile,
              actualCreatorProfileId,
            ),
            ...getCreatorEligibilityFields(
              creatorProfile,
              actualCreatorProfileId,
            ),
          },
          creator_instagram_archive: creatorProfile?.instagram_archive ?? null,
          quality_score: sub.quality_score ?? null,
        };
      })
      : [];

    // Combine regular submissions and Twitter tweets
    const allSubmissions: any[] = [...submissions, ...twitterSubmissions];

    let brandProfile: {
      company_name: string | null;
      website_url: string | null;
    } = { company_name: null, website_url: null };
    if (contestData.advertiser_id) {
      const adminDb = createAdminClient();
      const { data: advertiserProfile, error: advertiserProfileError } =
        await adminDb
        .from("advertiser_profiles")
        .select("company_name, website_url")
        .eq("id", contestData.advertiser_id)
        .maybeSingle();
      if (advertiserProfileError) {
        console.warn(
          `[AdminContestDetailPage] Failed to load advertiser profile for contest ${contestId} (advertiser ${contestData.advertiser_id}):`,
          advertiserProfileError.message,
        );
      }
      if (advertiserProfile) {
        brandProfile = advertiserProfile;
      }
      if (!brandProfile.company_name?.trim()) {
        const { data: advertiserUser } = await adminDb
          .from("users")
          .select("full_name, username")
          .eq("id", contestData.advertiser_id)
          .maybeSingle();
        const fallbackName =
          advertiserUser?.full_name?.trim() ||
          advertiserUser?.username?.trim() ||
          null;
        if (fallbackName) {
          brandProfile = { ...brandProfile, company_name: fallbackName };
        }
      }
    }

    return (
      <TooltipProvider>
        <div className="mb-4">
          <a
            href={`/dashboard/admin/affiliate/${contestId}`}
            className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Settle Affiliate Earnings
          </a>
        </div>
        <ContestDetailClient
          contest={contest}
          initialSubmissions={allSubmissions}
          durationDays={durationDays}
          contestId={contestId}
          isAdminView={true}
          creatorModerationData={creatorModerationData}
          milestoneBonusPaidByCreator={milestoneBonusPaidByCreator}
          submissionsFetchError={submissionsFetchError}
          brandProfile={brandProfile}
        />
      </TooltipProvider>
    );
  } catch (error) {
    console.error("Error in admin contest detail page:", error);
    redirect("/dashboard/admin/contests");
  }
}
