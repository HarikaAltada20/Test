import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import ContestDetailClient from "./contest-detail-client"; // Import the new client component

export default async function ContestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const contestId = resolvedParams.id;
  console.log(`[page.tsx] Processing request for Contest ID: ${contestId}`);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: userData } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .single();

  const isAdmin = userData?.user_type === "admin";
  const isAdvertiser = userData?.user_type === "advertiser";

  if (!isAdmin && !isAdvertiser) {
    redirect("/dashboard");
  }

  // For admin users, fetch any contest. For advertisers, only their contests
  let contestQuery = supabase
    .from("contests_with_status")
    .select("*")
    .eq("id", contestId);

  if (isAdvertiser) {
    // Advertisers can only access their own contests
    contestQuery = contestQuery.eq("advertiser_id", user.id);
  }
  // Admin users can access any contest (no additional filter)

  const { data: contestData } = await contestQuery.single();

  console.log("contestData", contestData);

  if (!contestData) {
    redirect("/dashboard/contests");
  }

  // Additional security check: if contest doesn't belong to user and user is not admin, deny access
  if (!isAdmin && contestData.advertiser_id !== user.id) {
    console.log(
      `Access denied: User ${user.id} attempted to access contest ${contestId} owned by ${contestData.advertiser_id}`
    );
    redirect("/dashboard/contests");
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

  console.log(`[page.tsx] Contest detection:`, {
    platform: contestData.platform,
    contest_format: contestData.contest_format,
    isTwitterCampaign,
  });

  // Fetch submissions (for YouTube/Instagram - manual submissions)
  const { data: submissionsData, error: submissionsError } = await supabase
    .from("submissions")
    .select(
      `
      id,
      created_at,
      content_link,
      status,
      views, 
      earnings,
      other_stats,
      platform,
      video_thumbnail_url,
      video_title,
      creator_id,
      paid,
      paid_at,
      bonus_paid,
      bonus_paid_at
    `
    )
    .eq("contest_id", contestId)
    .order("created_at", { ascending: false });

  if (submissionsError) {
    console.error(
      `[page.tsx] Supabase error fetching submissions for contest ${contestId}:`,
      submissionsError
    );
  }

  // For Twitter campaigns, fetch tweets from twitter_campaign_tweets table
  // OPTIMIZATION: Only fetch first page (50 tweets) on initial load instead of all tweets
  // This improves page load time from 2-5 seconds to <500ms for contests with 10,000+ tweets
  let twitterTweetsData: any[] = [];
  const INITIAL_TWEET_LIMIT = 50; // Only load first 50 tweets initially - rest loaded via pagination
  if (isTwitterCampaign) {
    // First, try to fetch with all columns (including moderation if migration ran)
    // If it fails due to missing columns, fall back to basic columns
    let tweetsData: any = null;
    let tweetsError: any = null;

    // Try with all columns first - OPTIMIZED: Only fetch first page
    // Include all tweets (including rejected) so brands/admins can see and change their status
    const queryWithAll = supabase
      .from("twitter_campaign_tweets")
      .select(
        `
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
        filter_status,
        first_fetched_at,
        last_updated_at
      `,
        { count: "exact" }
      )
      .eq("contest_id", contestId)
      // Don't filter by is_eligible - include all tweets so rejected ones are visible for status changes
      .order("tweet_created_at", { ascending: false })
      .range(0, INITIAL_TWEET_LIMIT - 1); // Only fetch first page

    const resultWithAll = await queryWithAll;
    tweetsData = resultWithAll.data;
    tweetsError = resultWithAll.error;

    // If error is about missing columns, try without moderation columns
    if (tweetsError && tweetsError.code === "42703") {
      console.log(`[page.tsx] Some columns don't exist, fetching without them`);
      const queryBasic = supabase
        .from("twitter_campaign_tweets")
        .select(
          `
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
          filter_status,
          first_fetched_at,
          last_updated_at
        `,
          { count: "exact" }
        )
        .eq("contest_id", contestId)
        // Don't filter by is_eligible - include all tweets so rejected ones are visible for status changes
        .order("tweet_created_at", { ascending: false })
        .range(0, INITIAL_TWEET_LIMIT - 1); // Only fetch first page

      const resultBasic = await queryBasic;
      tweetsData = resultBasic.data;
      tweetsError = resultBasic.error;
    }

    if (tweetsError) {
      console.error(
        `[page.tsx] Supabase error fetching Twitter tweets for contest ${contestId}:`,
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
        `[page.tsx] Fetched ${twitterTweetsData.length} Twitter tweets for contest ${contestId}`,
        twitterTweetsData.length > 0
          ? `Sample tweet: ${JSON.stringify(twitterTweetsData[0], null, 2)}`
          : "No tweets found"
      );
    }
  } else {
    console.log(
      `[page.tsx] Not a Twitter campaign - skipping Twitter tweets fetch`
    );
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
      paid?: boolean;
      paid_at?: string | null;
      earnings?: number;
      paid_rank?: number | null;
    }
  > = {};
  if (isTwitterCampaign) {
    try {
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from("twitter_campaign_leaderboard")
        .select(
          "creator_id, moderation_status, rejection_reason, manual_points_adjustment, manual_points_reason, total_points, total_eligible_tweets, total_likes, total_replies, total_retweets, total_quote_reposts, total_impressions, current_rank, paid, paid_at, earnings, paid_rank"
        )
        .eq("contest_id", contestId);

      if (leaderboardError) {
        console.error(
          `[page.tsx] Error fetching creator leaderboard data:`,
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
              paid: entry.paid || false,
              paid_at: entry.paid_at || null,
              earnings: entry.earnings || 0,
              paid_rank: entry.paid_rank || null,
            };
          }
        });
      }
    } catch (error) {
      console.error(
        `[page.tsx] Error fetching creator leaderboard data:`,
        error
      );
    }
  }

  console.log(
    `[page.tsx] Raw submissionsData for contest ${contestId}:`,
    JSON.stringify(submissionsData, null, 2)
  );

  // Fetch creator profiles and user data for the submissions and Twitter tweets
  let creatorProfilesData: any[] = [];
  let usersData: any[] = [];

  // Combine creator IDs from both submissions and Twitter tweets
  const allCreatorIds = new Set<string>();
  if (submissionsData && submissionsData.length > 0) {
    submissionsData.forEach((sub) => {
      if (sub.creator_id) allCreatorIds.add(sub.creator_id);
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
          twitter_account
        `
        )
        .in("id", creatorIds);

      if (profilesError) {
        console.error(
          `[page.tsx] Supabase error fetching creator profiles:`,
          profilesError
        );
      } else {
        creatorProfilesData = profilesData || [];
      }

      // Fetch user data for fallbacks
      const { data: userData, error: userError } = await supabase
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

      if (userError) {
        console.error(`[page.tsx] Supabase error fetching users:`, userError);
      } else {
        usersData = userData || [];
      }
    }
  }

  const isLive = contestData.status === "active";

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

  // Ensure contestData and submissionsData are compatible with the client component props
  // The client component expects specific shapes for contest and submissions
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
    tracking_links: contestData.tracking_links,
    resources: contestData.resources,
    contest_type: contestData.contest_type,
    contest_based_details: contestData.contest_based_details,
    last_metrics_updated: contestData.last_metrics_updated,
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
    // Categories, subcategories, and interests
    categories: contestData.categories,
    subcategories: contestData.subcategories,
    interests: contestData.interests,
    // Region data
    region: contestData.region,
    // Twitter-specific fields (all stored in contest_based_details.twitter_campaign)
    contest_format: contestData.contest_format,
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

        // Try to get Twitter account info
        if (creatorProfile?.twitter_account) {
          try {
            const twitterAccount =
              typeof creatorProfile.twitter_account === "string"
                ? JSON.parse(creatorProfile.twitter_account)
                : creatorProfile.twitter_account;
            creatorDisplayName =
              twitterAccount?.name || twitterAccount?.username;
            creatorUsername =
              twitterAccount?.username || tweet.twitter_username;
            creatorAvatarUrl = twitterAccount?.profile_picture_url;
          } catch (e) {
            console.error("[page.tsx] Error parsing Twitter account JSON:", e);
          }
        }

        // Fallback to tweet data
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

        // Calculate base points for raid campaigns
        // For raid campaigns, points field contains base + bonus, so we need to calculate base from tweet_type
        // For regular campaigns, points is just the base points
        let basePoints = 0;
        if (tweet.target_tweet_id) {
          // This is a raid engagement - calculate base points from tweet_type
          const tweetType = tweet.tweet_type;
          if (tweetType === "reply" || tweetType === "comment") {
            basePoints = 1; // comment_base_points
          } else if (tweetType === "retweet") {
            basePoints = 5; // retweet_base_points
          } else if (tweetType === "quote" || tweetType === "quote_repost") {
            basePoints = 10; // quote_repost_base_points
          } else {
            // Fallback: if we can't determine type, use points as base (for backwards compatibility)
            basePoints = tweet.points || 0;
          }
        } else {
          // Regular campaign - points is just base points
          basePoints = tweet.points || 0;
        }
        const manualAdjustment = tweet.manual_points_adjustment || 0;
        const totalPoints = (tweet.points || 0) + manualAdjustment;

        // Get moderation_status (default to "pending" if column doesn't exist)
        const moderationStatus = (tweet as any).moderation_status || "pending";

        return {
          id: tweet.id,
          created_at: tweet.tweet_created_at || tweet.created_at,
          content_link: tweet.tweet_url,
          status: moderationStatus, // Use moderation_status as status
          views: tweet.impressions || 0,
          earnings: null, // Twitter campaigns don't use earnings
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
          paid: false,
          paid_at: null,
          bonus_paid: false,
          bonus_paid_at: null,
          creator_display_name: creatorDisplayName,
          creator_username: creatorUsername,
          creator_avatar_url: creatorAvatarUrl,
          creator_id: actualCreatorProfileId,
          // Mark as Twitter tweet for UI handling
          is_twitter_tweet: true,
          tweet_id: tweet.tweet_id,
          moderation_status: moderationStatus, // Default to "pending" if column doesn't exist
          manual_points_adjustment: manualAdjustment,
          manual_points_reason: tweet.manual_points_reason,
          filter_status: (tweet as any).filter_status || null, // Track eligibility deletion status
          // Add nested creator object for compatibility
          creator: {
            id: actualCreatorProfileId,
            username: creatorUsername,
            profile_picture_url: creatorAvatarUrl,
            full_name: creatorDisplayName,
          },
        };
      })
    : [];

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
              creatorDisplayName =
                igAccount?.name_of_account ||
                igAccount?.full_name ||
                igAccount?.display_name;
              creatorUsername = igAccount?.username;
            }
          } catch (e) {
            console.error("[page.tsx] Error parsing social account JSON:", e);
            // Keep username/avatar as null if parsing fails
          }

          // Fallback if platform-specific data extraction failed or platform is different
          if (!creatorDisplayName && user?.full_name)
            creatorDisplayName = user.full_name; // Use user full_name as fallback
          if (!creatorUsername && user?.username)
            creatorUsername = user.username; // Use user username as fallback

          // Final fallbacks using user data if available
          if (!creatorDisplayName)
            creatorDisplayName =
              user?.full_name || user?.username || "Unknown Creator";
          if (!creatorUsername)
            creatorUsername = user?.username || "Unknown User";
          // Ensure we have a profile picture (already set above, but keep as fallback)
          if (!creatorAvatarUrl)
            creatorAvatarUrl = user?.profile_picture_url || null;
        } else {
          // No creator profile found, use user data as fallback
          creatorDisplayName =
            user?.full_name || user?.username || "Unknown Creator";
          creatorUsername = user?.username || "Unknown User";
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
          platform: sub.platform,
          video_thumbnail_url: sub.video_thumbnail_url,
          video_title: sub.video_title,
          paid: sub.paid,
          paid_at: sub.paid_at,
          bonus_paid: sub.bonus_paid,
          bonus_paid_at: sub.bonus_paid_at,
          creator_display_name: creatorDisplayName,
          creator_username: creatorUsername,
          creator_avatar_url: creatorAvatarUrl,
          creator_id: actualCreatorProfileId,
          // Add nested creator object for creator-wise grouping compatibility
          creator: {
            id: actualCreatorProfileId,
            username: creatorUsername,
            profile_picture_url: creatorAvatarUrl,
            full_name: creatorDisplayName,
          },
        };
      })
    : [];

  // Combine regular submissions and Twitter tweets
  const allSubmissions: any[] = [...submissions, ...twitterSubmissions];

  console.log(`[page.tsx] Mapped submissions for contest ${contestId}:`, {
    regular: submissions.length,
    twitter: twitterSubmissions.length,
    total: allSubmissions.length,
    isTwitterCampaign,
    platform: contestData.platform,
    contest_format: contestData.contest_format,
    sampleTwitterSubmission:
      twitterSubmissions.length > 0 ? twitterSubmissions[0] : null,
  });

  return (
    <ContestDetailClient
      contest={contest}
      initialSubmissions={allSubmissions}
      durationDays={durationDays}
      contestId={contestId}
      isAdminView={isAdmin}
      user={user}
      creatorModerationData={creatorModerationData}
    />
  );
}
