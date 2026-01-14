import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import axios from "axios";
import { extractTweetId, getTwitterRaidTarget } from "@/lib/twitter-utils";

export const dynamic = "force-dynamic";

// Points configuration - you can move this to contest_based_details later
// This configuration defines how points are awarded for raid campaign engagements
const RAID_POINTS_CONFIG = {
  // ============================================
  // BASE POINTS (for doing the action)
  // ============================================
  comment_base_points: 1, // Points for commenting on target tweet
  retweet_base_points: 5, // Points for retweeting target tweet
  quote_repost_base_points: 10, // Points for quote reposting target tweet

  // ============================================
  // COMMENT ENGAGEMENT MULTIPLIERS
  // (Reward for engagement on their comment)
  // ============================================
  comment_likes_multiplier: 0.1, // Points per like on their comment
  comment_replies_multiplier: 1, // Points per reply to their comment
  comment_impressions_multiplier: 0.001, // Points per impression on their comment
  comment_retweets_multiplier: 0, // (Comments can't be retweeted, but if they could)
  comment_quote_reposts_multiplier: 0, // (Comments can't be quote reposted)

  // ============================================
  // RETWEET ENGAGEMENT MULTIPLIERS
  // (Reward for engagement on their retweet)
  // ============================================
  retweet_likes_multiplier: 0.05, // Points per like on their retweet
  retweet_replies_multiplier: 0.05, // Points per reply to their retweet
  retweet_impressions_multiplier: 0.001, // Points per impression on their retweet
  retweet_retweets_multiplier: 0.05, // Points per retweet of their retweet (chain retweets)
  retweet_quote_reposts_multiplier: 0, // (Retweets can't be quote reposted)

  // ============================================
  // QUOTE REPOST ENGAGEMENT MULTIPLIERS
  // (Reward for engagement on their quote repost)
  // ============================================
  quote_repost_likes_multiplier: 0.1, // Points per like on their quote repost
  quote_repost_replies_multiplier: 0.1, // Points per reply to their quote repost
  quote_repost_impressions_multiplier: 0.001, // Points per impression on their quote repost
  quote_repost_retweets_multiplier: 0.1, // Points per retweet of their quote repost
  quote_repost_quote_reposts_multiplier: 0.1, // Points per quote repost of their quote repost

  // ============================================
  // OPTIONAL: Additional metrics (if available in future)
  // ============================================
  // comment_bookmarks_multiplier: 0.2,        // Points per bookmark on their comment
  // retweet_bookmarks_multiplier: 0.1,        // Points per bookmark on their retweet
  // quote_repost_bookmarks_multiplier: 0.2,   // Points per bookmark on their quote repost
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();
    const { id: contestId } = await params;

    // 1. Get contest and check if it's a raid campaign
    const { data: contest, error: contestError } = await supabaseAdmin
      .from("contests")
      .select("id, contest_type, contest_based_details, start_date")
      .eq("id", contestId)
      .maybeSingle();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const isCpmContest = contest.contest_type === "cpm";
    const twitterCampaign = contest.contest_based_details?.twitter_campaign;
    const raidTarget = twitterCampaign?.raid_target;
    const pointsConfig = twitterCampaign?.points_config || {};

    // Load brand-provided base points and multipliers for CPM contests
    // For CPM contests, use brand-provided values; otherwise use hardcoded RAID_POINTS_CONFIG
    let raidPointsConfig = { ...RAID_POINTS_CONFIG }; // Default to hardcoded values (for leaderboard contests)

    if (isCpmContest) {
      // For CPM contests: Use brand-assigned base points from points_config
      // For CPM raid campaigns: Use comments_weight.base_weight, retweets_weight.base_weight, quote_reposts_weight.base_weight

      // Comment base points: Check comments_weight.base_weight first, then fallback to comment_base_points, then default
      if (
        pointsConfig.comments_weight != null &&
        typeof pointsConfig.comments_weight === "object" &&
        pointsConfig.comments_weight.base_weight != null
      ) {
        // Use base_weight from comments_weight object
        raidPointsConfig.comment_base_points =
          typeof pointsConfig.comments_weight.base_weight === "number"
            ? pointsConfig.comments_weight.base_weight
            : parseFloat(pointsConfig.comments_weight.base_weight) || 1;
      } else if (pointsConfig.comment_base_points != null) {
        // Fallback: Use comment_base_points (backward compatibility)
        raidPointsConfig.comment_base_points =
          typeof pointsConfig.comment_base_points === "number"
            ? pointsConfig.comment_base_points
            : parseFloat(pointsConfig.comment_base_points) || 1;
      } else if (typeof pointsConfig.comments_weight === "number") {
        // Fallback: If comments_weight is a number, use it directly
        raidPointsConfig.comment_base_points = pointsConfig.comments_weight;
      } else {
        // Final fallback: Use default
        raidPointsConfig.comment_base_points =
          RAID_POINTS_CONFIG.comment_base_points;
      }

      // Retweet base points: Check retweets_weight.base_weight first, then fallback to retweet_base_points, then default
      if (
        pointsConfig.retweets_weight != null &&
        typeof pointsConfig.retweets_weight === "object" &&
        pointsConfig.retweets_weight.base_weight != null
      ) {
        // Use base_weight from retweets_weight object
        raidPointsConfig.retweet_base_points =
          typeof pointsConfig.retweets_weight.base_weight === "number"
            ? pointsConfig.retweets_weight.base_weight
            : parseFloat(pointsConfig.retweets_weight.base_weight) || 5;
      } else if (pointsConfig.retweet_base_points != null) {
        // Fallback: Use retweet_base_points (backward compatibility)
        raidPointsConfig.retweet_base_points =
          typeof pointsConfig.retweet_base_points === "number"
            ? pointsConfig.retweet_base_points
            : parseFloat(pointsConfig.retweet_base_points) || 5;
      } else if (typeof pointsConfig.retweets_weight === "number") {
        // Fallback: If retweets_weight is a number, use it directly
        raidPointsConfig.retweet_base_points = pointsConfig.retweets_weight;
      } else {
        // Final fallback: Use default
        raidPointsConfig.retweet_base_points =
          RAID_POINTS_CONFIG.retweet_base_points;
      }

      // Quote repost base points: Check quote_reposts_weight.base_weight first, then fallback to quote_repost_base_points, then default
      if (
        pointsConfig.quote_reposts_weight != null &&
        typeof pointsConfig.quote_reposts_weight === "object" &&
        pointsConfig.quote_reposts_weight.base_weight != null
      ) {
        // Use base_weight from quote_reposts_weight object
        raidPointsConfig.quote_repost_base_points =
          typeof pointsConfig.quote_reposts_weight.base_weight === "number"
            ? pointsConfig.quote_reposts_weight.base_weight
            : parseFloat(pointsConfig.quote_reposts_weight.base_weight) || 10;
      } else if (pointsConfig.quote_repost_base_points != null) {
        // Fallback: Use quote_repost_base_points (backward compatibility)
        raidPointsConfig.quote_repost_base_points =
          typeof pointsConfig.quote_repost_base_points === "number"
            ? pointsConfig.quote_repost_base_points
            : parseFloat(pointsConfig.quote_repost_base_points) || 10;
      } else if (typeof pointsConfig.quote_reposts_weight === "number") {
        // Fallback: If quote_reposts_weight is a number, use it directly
        raidPointsConfig.quote_repost_base_points =
          pointsConfig.quote_reposts_weight;
      } else {
        // Final fallback: Use default
        raidPointsConfig.quote_repost_base_points =
          RAID_POINTS_CONFIG.quote_repost_base_points;
      }

      // Override with brand-provided engagement multipliers for comments
      // Check inside comments_weight object first, then fallback to flat structure
      const commentsWeightObj =
        pointsConfig.comments_weight &&
        typeof pointsConfig.comments_weight === "object"
          ? pointsConfig.comments_weight
          : null;

      if (
        commentsWeightObj?.likes_multiplier != null ||
        pointsConfig.comment_likes_multiplier != null
      ) {
        raidPointsConfig.comment_likes_multiplier =
          commentsWeightObj?.likes_multiplier != null
            ? typeof commentsWeightObj.likes_multiplier === "number"
              ? commentsWeightObj.likes_multiplier
              : parseFloat(commentsWeightObj.likes_multiplier) || 0.1
            : typeof pointsConfig.comment_likes_multiplier === "number"
            ? pointsConfig.comment_likes_multiplier
            : parseFloat(pointsConfig.comment_likes_multiplier) || 0.1;
      }
      if (
        commentsWeightObj?.replies_multiplier != null ||
        pointsConfig.comment_replies_multiplier != null
      ) {
        raidPointsConfig.comment_replies_multiplier =
          commentsWeightObj?.replies_multiplier != null
            ? typeof commentsWeightObj.replies_multiplier === "number"
              ? commentsWeightObj.replies_multiplier
              : parseFloat(commentsWeightObj.replies_multiplier) || 1
            : typeof pointsConfig.comment_replies_multiplier === "number"
            ? pointsConfig.comment_replies_multiplier
            : parseFloat(pointsConfig.comment_replies_multiplier) || 1;
      }
      if (
        commentsWeightObj?.impressions_multiplier != null ||
        pointsConfig.comment_impressions_multiplier != null
      ) {
        raidPointsConfig.comment_impressions_multiplier =
          commentsWeightObj?.impressions_multiplier != null
            ? typeof commentsWeightObj.impressions_multiplier === "number"
              ? commentsWeightObj.impressions_multiplier
              : parseFloat(commentsWeightObj.impressions_multiplier) || 0.001
            : typeof pointsConfig.comment_impressions_multiplier === "number"
            ? pointsConfig.comment_impressions_multiplier
            : parseFloat(pointsConfig.comment_impressions_multiplier) || 0.001;
      }
      if (
        commentsWeightObj?.retweets_multiplier != null ||
        pointsConfig.comment_retweets_multiplier != null
      ) {
        raidPointsConfig.comment_retweets_multiplier =
          commentsWeightObj?.retweets_multiplier != null
            ? typeof commentsWeightObj.retweets_multiplier === "number"
              ? commentsWeightObj.retweets_multiplier
              : parseFloat(commentsWeightObj.retweets_multiplier) || 0
            : typeof pointsConfig.comment_retweets_multiplier === "number"
            ? pointsConfig.comment_retweets_multiplier
            : parseFloat(pointsConfig.comment_retweets_multiplier) || 0;
      }
      if (
        commentsWeightObj?.quote_reposts_multiplier != null ||
        pointsConfig.comment_quote_reposts_multiplier != null
      ) {
        raidPointsConfig.comment_quote_reposts_multiplier =
          commentsWeightObj?.quote_reposts_multiplier != null
            ? typeof commentsWeightObj.quote_reposts_multiplier === "number"
              ? commentsWeightObj.quote_reposts_multiplier
              : parseFloat(commentsWeightObj.quote_reposts_multiplier) || 0
            : typeof pointsConfig.comment_quote_reposts_multiplier === "number"
            ? pointsConfig.comment_quote_reposts_multiplier
            : parseFloat(pointsConfig.comment_quote_reposts_multiplier) || 0;
      }

      // Override with brand-provided engagement multipliers for retweets
      // Check inside retweets_weight object first, then fallback to flat structure
      const retweetsWeightObj =
        pointsConfig.retweets_weight &&
        typeof pointsConfig.retweets_weight === "object"
          ? pointsConfig.retweets_weight
          : null;

      if (
        retweetsWeightObj?.likes_multiplier != null ||
        pointsConfig.retweet_likes_multiplier != null
      ) {
        raidPointsConfig.retweet_likes_multiplier =
          retweetsWeightObj?.likes_multiplier != null
            ? typeof retweetsWeightObj.likes_multiplier === "number"
              ? retweetsWeightObj.likes_multiplier
              : parseFloat(retweetsWeightObj.likes_multiplier) || 0.05
            : typeof pointsConfig.retweet_likes_multiplier === "number"
            ? pointsConfig.retweet_likes_multiplier
            : parseFloat(pointsConfig.retweet_likes_multiplier) || 0.05;
      }
      if (
        retweetsWeightObj?.replies_multiplier != null ||
        pointsConfig.retweet_replies_multiplier != null
      ) {
        raidPointsConfig.retweet_replies_multiplier =
          retweetsWeightObj?.replies_multiplier != null
            ? typeof retweetsWeightObj.replies_multiplier === "number"
              ? retweetsWeightObj.replies_multiplier
              : parseFloat(retweetsWeightObj.replies_multiplier) || 0.05
            : typeof pointsConfig.retweet_replies_multiplier === "number"
            ? pointsConfig.retweet_replies_multiplier
            : parseFloat(pointsConfig.retweet_replies_multiplier) || 0.05;
      }
      if (
        retweetsWeightObj?.impressions_multiplier != null ||
        pointsConfig.retweet_impressions_multiplier != null
      ) {
        raidPointsConfig.retweet_impressions_multiplier =
          retweetsWeightObj?.impressions_multiplier != null
            ? typeof retweetsWeightObj.impressions_multiplier === "number"
              ? retweetsWeightObj.impressions_multiplier
              : parseFloat(retweetsWeightObj.impressions_multiplier) || 0.001
            : typeof pointsConfig.retweet_impressions_multiplier === "number"
            ? pointsConfig.retweet_impressions_multiplier
            : parseFloat(pointsConfig.retweet_impressions_multiplier) || 0.001;
      }
      if (
        retweetsWeightObj?.retweets_multiplier != null ||
        pointsConfig.retweet_retweets_multiplier != null
      ) {
        raidPointsConfig.retweet_retweets_multiplier =
          retweetsWeightObj?.retweets_multiplier != null
            ? typeof retweetsWeightObj.retweets_multiplier === "number"
              ? retweetsWeightObj.retweets_multiplier
              : parseFloat(retweetsWeightObj.retweets_multiplier) || 0.05
            : typeof pointsConfig.retweet_retweets_multiplier === "number"
            ? pointsConfig.retweet_retweets_multiplier
            : parseFloat(pointsConfig.retweet_retweets_multiplier) || 0.05;
      }
      if (
        retweetsWeightObj?.quote_reposts_multiplier != null ||
        pointsConfig.retweet_quote_reposts_multiplier != null
      ) {
        raidPointsConfig.retweet_quote_reposts_multiplier =
          retweetsWeightObj?.quote_reposts_multiplier != null
            ? typeof retweetsWeightObj.quote_reposts_multiplier === "number"
              ? retweetsWeightObj.quote_reposts_multiplier
              : parseFloat(retweetsWeightObj.quote_reposts_multiplier) || 0
            : typeof pointsConfig.retweet_quote_reposts_multiplier === "number"
            ? pointsConfig.retweet_quote_reposts_multiplier
            : parseFloat(pointsConfig.retweet_quote_reposts_multiplier) || 0;
      }

      // Override with brand-provided engagement multipliers for quote reposts
      // Check inside quote_reposts_weight object first, then fallback to flat structure
      const quoteRepostsWeightObj =
        pointsConfig.quote_reposts_weight &&
        typeof pointsConfig.quote_reposts_weight === "object"
          ? pointsConfig.quote_reposts_weight
          : null;

      if (
        quoteRepostsWeightObj?.likes_multiplier != null ||
        pointsConfig.quote_repost_likes_multiplier != null
      ) {
        raidPointsConfig.quote_repost_likes_multiplier =
          quoteRepostsWeightObj?.likes_multiplier != null
            ? typeof quoteRepostsWeightObj.likes_multiplier === "number"
              ? quoteRepostsWeightObj.likes_multiplier
              : parseFloat(quoteRepostsWeightObj.likes_multiplier) || 0.1
            : typeof pointsConfig.quote_repost_likes_multiplier === "number"
            ? pointsConfig.quote_repost_likes_multiplier
            : parseFloat(pointsConfig.quote_repost_likes_multiplier) || 0.1;
      }
      if (
        quoteRepostsWeightObj?.replies_multiplier != null ||
        pointsConfig.quote_repost_replies_multiplier != null
      ) {
        raidPointsConfig.quote_repost_replies_multiplier =
          quoteRepostsWeightObj?.replies_multiplier != null
            ? typeof quoteRepostsWeightObj.replies_multiplier === "number"
              ? quoteRepostsWeightObj.replies_multiplier
              : parseFloat(quoteRepostsWeightObj.replies_multiplier) || 0.1
            : typeof pointsConfig.quote_repost_replies_multiplier === "number"
            ? pointsConfig.quote_repost_replies_multiplier
            : parseFloat(pointsConfig.quote_repost_replies_multiplier) || 0.1;
      }
      if (
        quoteRepostsWeightObj?.impressions_multiplier != null ||
        pointsConfig.quote_repost_impressions_multiplier != null
      ) {
        raidPointsConfig.quote_repost_impressions_multiplier =
          quoteRepostsWeightObj?.impressions_multiplier != null
            ? typeof quoteRepostsWeightObj.impressions_multiplier === "number"
              ? quoteRepostsWeightObj.impressions_multiplier
              : parseFloat(quoteRepostsWeightObj.impressions_multiplier) ||
                0.001
            : typeof pointsConfig.quote_repost_impressions_multiplier ===
              "number"
            ? pointsConfig.quote_repost_impressions_multiplier
            : parseFloat(pointsConfig.quote_repost_impressions_multiplier) ||
              0.001;
      }
      if (
        quoteRepostsWeightObj?.retweets_multiplier != null ||
        pointsConfig.quote_repost_retweets_multiplier != null
      ) {
        raidPointsConfig.quote_repost_retweets_multiplier =
          quoteRepostsWeightObj?.retweets_multiplier != null
            ? typeof quoteRepostsWeightObj.retweets_multiplier === "number"
              ? quoteRepostsWeightObj.retweets_multiplier
              : parseFloat(quoteRepostsWeightObj.retweets_multiplier) || 0.1
            : typeof pointsConfig.quote_repost_retweets_multiplier === "number"
            ? pointsConfig.quote_repost_retweets_multiplier
            : parseFloat(pointsConfig.quote_repost_retweets_multiplier) || 0.1;
      }
      if (
        quoteRepostsWeightObj?.quote_reposts_multiplier != null ||
        pointsConfig.quote_repost_quote_reposts_multiplier != null
      ) {
        raidPointsConfig.quote_repost_quote_reposts_multiplier =
          quoteRepostsWeightObj?.quote_reposts_multiplier != null
            ? typeof quoteRepostsWeightObj.quote_reposts_multiplier === "number"
              ? quoteRepostsWeightObj.quote_reposts_multiplier
              : parseFloat(quoteRepostsWeightObj.quote_reposts_multiplier) ||
                0.1
            : typeof pointsConfig.quote_repost_quote_reposts_multiplier ===
              "number"
            ? pointsConfig.quote_repost_quote_reposts_multiplier
            : parseFloat(pointsConfig.quote_repost_quote_reposts_multiplier) ||
              0.1;
      }

      console.log(
        `[fetch-raid-engagements] Using brand-assigned points config for CPM contest ${contestId}:`,
        {
          comment_base_points: raidPointsConfig.comment_base_points,
          retweet_base_points: raidPointsConfig.retweet_base_points,
          quote_repost_base_points: raidPointsConfig.quote_repost_base_points,
          source:
            "comments_weight.base_weight, retweets_weight.base_weight, quote_reposts_weight.base_weight",
        }
      );
    } else {
      // For leaderboard contests: Use hardcoded RAID_POINTS_CONFIG (no changes)
      console.log(
        `[fetch-raid-engagements] Using hardcoded RAID_POINTS_CONFIG for leaderboard contest ${contestId}`
      );
    }

    if (!raidTarget?.link || twitterCampaign?.campaign_type !== "raid") {
      return NextResponse.json(
        {
          error: "This contest is not a raid campaign or has no target tweet",
        },
        { status: 400 }
      );
    }

    // 2. Extract target tweet ID
    const targetTweetId = extractTweetId(raidTarget.link);
    if (!targetTweetId) {
      return NextResponse.json(
        { error: "Invalid target tweet URL" },
        { status: 400 }
      );
    }

    // 3. Get all participants for this contest (including join date)
    const { data: participants, error: participantsError } = await supabase
      .from("twitter_campaign_participants")
      .select("creator_id, twitter_username, joined_at")
      .eq("contest_id", contestId)
      .eq("is_active", true);

    if (participantsError || !participants || participants.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active participants",
        engagementsFound: 0,
      });
    }

    // 3a. Filter out rejected creators (same as YouTube/Instagram - don't fetch their data)
    const creatorIds = participants.map((p) => p.creator_id);
    const { data: leaderboardData } = await supabaseAdmin
      .from("twitter_campaign_leaderboard")
      .select("creator_id, moderation_status")
      .eq("contest_id", contestId)
      .in("creator_id", creatorIds);

    // Create a set of rejected creator IDs
    const rejectedCreatorIds = new Set(
      (leaderboardData || [])
        .filter((entry) => entry.moderation_status === "rejected")
        .map((entry) => entry.creator_id)
    );

    // Filter out rejected creators from participants
    const activeParticipants = participants.filter(
      (p) => !rejectedCreatorIds.has(p.creator_id)
    );

    if (activeParticipants.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active non-rejected participants",
        engagementsFound: 0,
      });
    }

    // Create map of username -> creator_id and join date for quick lookup (only for non-rejected creators)
    const participantMap = new Map<string, string>();
    const participantJoinDateMap = new Map<string, Date>(); // Map username -> join date
    activeParticipants.forEach((p) => {
      if (p.twitter_username) {
        const cleanUsername = p.twitter_username.replace("@", "").toLowerCase();
        participantMap.set(cleanUsername, p.creator_id);
        if (p.joined_at) {
          participantJoinDateMap.set(cleanUsername, new Date(p.joined_at));
        }
      }
    });

    // 4. Fetch target tweet and all replies using RapidAPI
    const rapidApiKey = process.env.TWITTER_RAPIDAPI_KEY;
    const rapidApiHost = "twitter-api45.p.rapidapi.com";

    if (!rapidApiKey) {
      return NextResponse.json(
        { error: "TWITTER_RAPIDAPI_KEY not configured" },
        { status: 500 }
      );
    }

    console.log(
      `[fetch-raid-engagements] Fetching target tweet info and engagements for tweet ${targetTweetId}`
    );

    // 4a. Fetch target tweet metrics using tweet.php (for target_current_*)
    let targetTweet: any;
    try {
      const tweetInfoOptions = {
        method: "GET",
        url: `https://${rapidApiHost}/tweet.php`,
        params: {
          id: targetTweetId,
        },
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": rapidApiHost,
        },
      };

      const tweetInfoResponse = await axios.request(tweetInfoOptions);
      const tweetInfoData = tweetInfoResponse.data;

      // Handle different response formats
      if (Array.isArray(tweetInfoData)) {
        targetTweet = tweetInfoData[0];
      } else if (tweetInfoData?.tweet) {
        targetTweet = tweetInfoData.tweet;
      } else if (tweetInfoData) {
        targetTweet = tweetInfoData;
      }

      if (!targetTweet) {
        return NextResponse.json(
          { error: "Failed to fetch target tweet info" },
          { status: 404 }
        );
      }
    } catch (tweetInfoError: any) {
      console.error(
        "[fetch-raid-engagements] Error fetching target tweet info:",
        tweetInfoError.message
      );
      return NextResponse.json(
        {
          error: "Failed to fetch target tweet info",
          details: tweetInfoError.message,
        },
        { status: 500 }
      );
    }

    // 4b. Fetch engagements (replies, retweets, quote reposts) using latest_replies.php
    // This endpoint returns ALL engagements (replies, retweets, quote reposts) on the target tweet
    // IMPORTANT: We use pagination to fetch ALL engagements up to join dates
    const allEngagementTweets: any[] = [];

    try {
      // Fetch ALL engagements using pagination
      let allEngagements: any[] = [];
      let cursor: string | null = null;
      let hasMorePages = true;
      let pageCount = 0;
      const MAX_PAGES = 50; // Safety limit

      while (hasMorePages && pageCount < MAX_PAGES) {
        const repliesOptions: any = {
          method: "GET",
          url: `https://${rapidApiHost}/latest_replies.php`,
          params: {
            id: targetTweetId, // Get all engagements on this specific tweet
          },
          headers: {
            "x-rapidapi-key": rapidApiKey,
            "x-rapidapi-host": rapidApiHost,
          },
        };

        // Add cursor for pagination (if not first page)
        if (cursor) {
          repliesOptions.params.cursor = cursor;
        }

        const repliesResponse = await axios.request(repliesOptions);
        const repliesData = repliesResponse.data;

        // The latest_replies.php endpoint returns engagements in a timeline array
        const pageEngagements = Array.isArray(repliesData?.timeline)
          ? repliesData.timeline
          : Array.isArray(repliesData)
          ? repliesData
          : [];

        // Add engagements from this page
        allEngagements.push(...pageEngagements);

        // Check for next cursor
        const nextCursor = repliesData?.next_cursor;
        if (!nextCursor || nextCursor === "0" || nextCursor === 0) {
          hasMorePages = false;
        } else {
          cursor = nextCursor;
          pageCount++;
          console.log(
            `[fetch-raid-engagements] Fetched page ${pageCount} from latest_replies.php, total engagements so far: ${allEngagements.length}, next cursor: ${cursor}`
          );
        }
      }

      console.log(
        `[fetch-raid-engagements] Found ${
          allEngagements.length
        } total engagements from latest_replies.php across ${
          pageCount + 1
        } pages`
      );

      // Process all engagements - identify replies, retweets, and quote reposts
      for (const engagement of allEngagements) {
        // Skip the target tweet itself
        const engagementId = engagement.tweet_id || engagement.id;
        if (engagementId === targetTweetId) {
          continue;
        }

        let engagementType: "comment" | "retweet" | "quote_repost" | null =
          null;

        // Check if it's a DIRECT reply (comment) to the target tweet
        if (
          engagement.in_reply_to_status_id_str === targetTweetId ||
          engagement.in_reply_to === targetTweetId ||
          engagement.in_reply_to_status_id === targetTweetId
        ) {
          engagementType = "comment";
        }
        // Check if it's a retweet of the target tweet
        else if (
          engagement.retweeted_tweet?.tweet_id === targetTweetId ||
          engagement.retweeted_tweet?.id === targetTweetId ||
          engagement.retweeted?.id === targetTweetId ||
          engagement.retweeted?.tweet_id === targetTweetId ||
          engagement.retweeted_status_id_str === targetTweetId ||
          engagement.retweeted_status_id === targetTweetId
        ) {
          engagementType = "retweet";
        }
        // Check if it's a quote repost of the target tweet
        // Quote reposts have quoted tweet AND original text (not just a retweet)
        else if (
          (engagement.quoted?.tweet_id === targetTweetId ||
            engagement.quoted?.id === targetTweetId ||
            engagement.quoted_status_id_str === targetTweetId ||
            engagement.quoted_status_id === targetTweetId) &&
          engagement.text && // Has original text (not just a retweet)
          !engagement.retweeted_tweet && // Not a retweet
          !engagement.retweeted
        ) {
          engagementType = "quote_repost";
        }

        // Only add if we identified the engagement type
        if (engagementType) {
          // Check if we already added this
          const alreadyAdded = allEngagementTweets.some(
            (e) => (e.tweet_id || e.id) === engagementId
          );

          if (!alreadyAdded) {
            allEngagementTweets.push({
              ...engagement,
              _engagement_type: engagementType, // Mark the type for later processing
            });
            console.log(
              `[fetch-raid-engagements] Found ${engagementType} engagement:`,
              engagementId
            );
          }
        } else {
          // Log engagements that couldn't be identified
          console.log(
            `[fetch-raid-engagements] Could not identify engagement type:`,
            {
              tweet_id: engagementId,
              in_reply_to: engagement.in_reply_to_status_id_str,
              has_retweeted_tweet: !!engagement.retweeted_tweet,
              has_retweeted: !!engagement.retweeted,
              has_quoted: !!engagement.quoted,
              quoted_tweet_id: engagement.quoted?.tweet_id,
              quoted_id: engagement.quoted?.id,
              quoted_status_id_str: engagement.quoted_status_id_str,
              has_text: !!engagement.text,
              keys: Object.keys(engagement).slice(0, 20),
            }
          );
        }
      }

      console.log(
        `[fetch-raid-engagements] Processed engagements from latest_replies.php:`,
        {
          total: allEngagements.length,
          identified: allEngagementTweets.length,
          byType: {
            comments: allEngagementTweets.filter(
              (e) => e._engagement_type === "comment"
            ).length,
            retweets: allEngagementTweets.filter(
              (e) => e._engagement_type === "retweet"
            ).length,
            quoteReposts: allEngagementTweets.filter(
              (e) => e._engagement_type === "quote_repost"
            ).length,
          },
        }
      );
    } catch (repliesError: any) {
      console.error(
        "[fetch-raid-engagements] Error fetching replies:",
        repliesError.message
      );
      // Continue with other engagement types
    }

    // 4c. Also fetch retweets using retweets.php as a fallback
    try {
      const retweetsOptions = {
        method: "GET",
        url: `https://${rapidApiHost}/retweets.php`,
        params: {
          id: targetTweetId,
        },
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": rapidApiHost,
        },
      };

      const retweetsResponse = await axios.request(retweetsOptions);
      const retweetsData = retweetsResponse.data;

      let retweetsFromEndpoint: any[] = [];

      if (Array.isArray(retweetsData?.retweets)) {
        retweetsFromEndpoint = retweetsData.retweets;
      } else if (Array.isArray(retweetsData?.timeline)) {
        retweetsFromEndpoint = retweetsData.timeline;
      } else if (Array.isArray(retweetsData)) {
        retweetsFromEndpoint = retweetsData;
      }

      console.log(
        `[fetch-raid-engagements] Found ${retweetsFromEndpoint.length} retweets from retweets.php`
      );
      console.log(`[fetch-raid-engagements] Retweets API response structure:`, {
        hasTimeline: !!retweetsData?.timeline,
        hasUsers: !!retweetsData?.users,
        hasRetweets: !!retweetsData?.retweets,
        isArray: Array.isArray(retweetsData),
        keys: retweetsData ? Object.keys(retweetsData) : [],
        sampleRetweet: retweetsFromEndpoint[0]
          ? {
              keys: Object.keys(retweetsFromEndpoint[0]),
              tweet_id: retweetsFromEndpoint[0].tweet_id,
              id: retweetsFromEndpoint[0].id,
              rest_id: retweetsFromEndpoint[0].rest_id,
              screen_name: retweetsFromEndpoint[0].screen_name,
            }
          : null,
      });

      for (const retweet of retweetsFromEndpoint) {
        // Get tweet ID - might be in different fields
        const tweetId =
          retweet.tweet_id ||
          retweet.id ||
          retweet.rest_id ||
          retweet.retweet_id;

        // If it's a user object (has screen_name but no tweet_id), we need to fetch their timeline
        const isUserObject = retweet.screen_name && !tweetId;

        if (isUserObject) {
          // This is a user object - we need to fetch their timeline to find the retweet
          const username = retweet.screen_name;
          console.log(
            `[fetch-raid-engagements] Retweet is user object (${username}), fetching their timeline to find retweet`
          );

          try {
            // Get join date for this participant
            const participantData = activeParticipants.find(
              (p) =>
                p.twitter_username?.replace("@", "").toLowerCase() ===
                username.toLowerCase()
            );
            const joinDate = participantData?.joined_at
              ? new Date(participantData.joined_at)
              : null;

            // Fetch ALL tweets up to join date using pagination
            let allUserTimelineTweets: any[] = [];
            let cursor: string | null = null;
            let hasMorePages = true;
            let pageCount = 0;
            const MAX_PAGES = 50; // Safety limit

            while (hasMorePages && pageCount < MAX_PAGES) {
              const userTimelineOptions: any = {
                method: "GET",
                url: `https://${rapidApiHost}/replies.php`,
                params: {
                  screenname: username,
                },
                headers: {
                  "x-rapidapi-key": rapidApiKey,
                  "x-rapidapi-host": rapidApiHost,
                },
              };

              // Add cursor for pagination (if not first page)
              if (cursor) {
                userTimelineOptions.params.cursor = cursor;
              }

              const userTimelineResponse = await axios.request(
                userTimelineOptions
              );
              const userTimelineData = userTimelineResponse.data;
              const pageTimeline = Array.isArray(userTimelineData?.timeline)
                ? userTimelineData.timeline
                : [];

              // Add tweets from this page
              allUserTimelineTweets.push(...pageTimeline);

              // Check if we've reached the join date
              if (joinDate && pageTimeline.length > 0) {
                const oldestTweet = pageTimeline[pageTimeline.length - 1];
                const oldestTweetDate = oldestTweet?.created_at
                  ? new Date(oldestTweet.created_at)
                  : null;

                // If oldest tweet in this page is before join date, we've fetched enough
                if (oldestTweetDate && oldestTweetDate < joinDate) {
                  console.log(
                    `[fetch-raid-engagements] Reached join date for ${username}. Oldest tweet: ${oldestTweetDate.toISOString()}, Join date: ${joinDate.toISOString()}`
                  );
                  hasMorePages = false;
                  break;
                }
              }

              // Check for next cursor
              const nextCursor = userTimelineData?.next_cursor;
              if (!nextCursor || nextCursor === "0" || nextCursor === 0) {
                hasMorePages = false;
              } else {
                cursor = nextCursor;
                pageCount++;
              }
            }

            const userTimeline = allUserTimelineTweets;

            // Find the retweet in their timeline
            for (const tweet of userTimeline) {
              const isRetweetOfTarget =
                tweet.retweeted_tweet?.tweet_id === targetTweetId ||
                tweet.retweeted?.id === targetTweetId ||
                tweet.retweeted?.tweet_id === targetTweetId ||
                tweet.retweeted_status_id_str === targetTweetId ||
                tweet.retweeted_status_id === targetTweetId;

              if (isRetweetOfTarget) {
                const retweetId = tweet.tweet_id || tweet.id;
                // Check if we already added this
                const alreadyAdded = allEngagementTweets.some(
                  (e) => (e.tweet_id || e.id) === retweetId
                );

                if (!alreadyAdded) {
                  allEngagementTweets.push({
                    ...tweet,
                    _engagement_type: "retweet",
                  });
                  console.log(
                    `[fetch-raid-engagements] Found retweet from ${username}:`,
                    retweetId
                  );
                  break; // Found the retweet, no need to continue
                }
              }
            }
          } catch (userTimelineError: any) {
            console.error(
              `[fetch-raid-engagements] Error fetching timeline for ${username}:`,
              userTimelineError.message
            );
          }
          continue; // Skip the user object itself
        }

        // If it's from retweets.php endpoint, it's a retweet of the target by definition
        // But we still check to be safe
        const isRetweetOfTarget =
          retweet.retweeted_tweet?.tweet_id === targetTweetId ||
          retweet.retweeted?.id === targetTweetId ||
          retweet.retweeted?.tweet_id === targetTweetId ||
          retweet.retweeted_status_id_str === targetTweetId ||
          retweet.retweeted_status_id === targetTweetId ||
          !tweetId; // If no tweet_id but it's from retweets.php, assume it's a retweet

        // If it's from retweets.php, add it as a retweet (even if we can't verify the target)
        if (tweetId || isRetweetOfTarget) {
          // Check if we already added this (from latest_replies.php)
          const alreadyAdded = allEngagementTweets.some(
            (e) => (e.tweet_id || e.id) === tweetId
          );

          if (!alreadyAdded) {
            allEngagementTweets.push({
              ...retweet,
              tweet_id: tweetId || retweet.tweet_id || retweet.id, // Ensure tweet_id is set
              _engagement_type: "retweet", // Mark as retweet
            });
            console.log(
              `[fetch-raid-engagements] Added retweet from retweets.php:`,
              tweetId || "unknown"
            );
          } else {
            console.log(
              `[fetch-raid-engagements] Retweet already added from latest_replies.php:`,
              tweetId
            );
          }
        } else {
          console.log(
            `[fetch-raid-engagements] Skipping retweet (no tweet_id and not verified):`,
            {
              hasTweetId: !!tweetId,
              isRetweetOfTarget,
              keys: Object.keys(retweet),
            }
          );
        }
      }
    } catch (retweetsError: any) {
      console.error(
        "[fetch-raid-engagements] Error fetching retweets:",
        retweetsError.message
      );
    }

    // 4d. Search participant timelines for quote reposts (if not already found in latest_replies.php)
    // Quote reposts might not be in latest_replies.php, so we'll check each participant's timeline
    // IMPORTANT: We fetch ALL tweets up to join date using pagination
    console.log(
      `[fetch-raid-engagements] Checking participant timelines for quote reposts...`
    );
    for (const participant of activeParticipants) {
      const username = participant.twitter_username?.replace("@", "");
      if (!username) continue;

      try {
        // Get join date for this participant
        const joinDate = participant.joined_at
          ? new Date(participant.joined_at)
          : null;

        // Fetch ALL tweets up to join date using pagination
        let allUserTimelineTweets: any[] = [];
        let cursor: string | null = null;
        let hasMorePages = true;
        let pageCount = 0;
        const MAX_PAGES = 50; // Safety limit

        while (hasMorePages && pageCount < MAX_PAGES) {
          const userTimelineOptions: any = {
            method: "GET",
            url: `https://${rapidApiHost}/replies.php`,
            params: {
              screenname: username,
            },
            headers: {
              "x-rapidapi-key": rapidApiKey,
              "x-rapidapi-host": rapidApiHost,
            },
          };

          // Add cursor for pagination (if not first page)
          if (cursor) {
            userTimelineOptions.params.cursor = cursor;
          }

          const userTimelineResponse = await axios.request(userTimelineOptions);
          const userTimelineData = userTimelineResponse.data;
          const pageTimeline = Array.isArray(userTimelineData?.timeline)
            ? userTimelineData.timeline
            : [];

          // Add tweets from this page
          allUserTimelineTweets.push(...pageTimeline);

          // Check if we've reached the join date
          if (joinDate && pageTimeline.length > 0) {
            const oldestTweet = pageTimeline[pageTimeline.length - 1];
            const oldestTweetDate = oldestTweet?.created_at
              ? new Date(oldestTweet.created_at)
              : null;

            // If oldest tweet in this page is before join date, we've fetched enough
            if (oldestTweetDate && oldestTweetDate < joinDate) {
              console.log(
                `[fetch-raid-engagements] Reached join date for ${username} (quote reposts). Oldest tweet: ${oldestTweetDate.toISOString()}, Join date: ${joinDate.toISOString()}`
              );
              hasMorePages = false;
              break;
            }
          }

          // Check for next cursor
          const nextCursor = userTimelineData?.next_cursor;
          if (!nextCursor || nextCursor === "0" || nextCursor === 0) {
            hasMorePages = false;
          } else {
            cursor = nextCursor;
            pageCount++;
          }
        }

        // Filter tweets to only include those created on or after join date
        const filteredTimeline = joinDate
          ? allUserTimelineTweets.filter((tweet: any) => {
              const tweetDate = tweet.created_at
                ? new Date(tweet.created_at)
                : null;
              if (!tweetDate) return false;
              return tweetDate >= joinDate;
            })
          : allUserTimelineTweets;

        console.log(
          `[fetch-raid-engagements] Fetched ${
            allUserTimelineTweets.length
          } tweets (${
            filteredTimeline.length
          } after join date filter) for ${username} across ${
            pageCount + 1
          } pages`
        );

        const userTimeline = filteredTimeline;

        // Check for quote reposts of the target tweet
        for (const tweet of userTimeline) {
          const isQuoteRepost =
            (tweet.quoted?.tweet_id === targetTweetId ||
              tweet.quoted?.id === targetTweetId ||
              tweet.quoted_status_id_str === targetTweetId ||
              tweet.quoted_status_id === targetTweetId) &&
            tweet.text && // Has original text
            !tweet.retweeted_tweet && // Not a retweet
            !tweet.retweeted && // Not a retweet
            tweet.in_reply_to_status_id_str !== targetTweetId; // Not a direct reply

          if (isQuoteRepost) {
            const quoteId = tweet.tweet_id || tweet.id;
            // Check if we already added this
            const alreadyAdded = allEngagementTweets.some(
              (e) => (e.tweet_id || e.id) === quoteId
            );

            if (!alreadyAdded) {
              allEngagementTweets.push({
                ...tweet,
                _engagement_type: "quote_repost",
              });
              console.log(
                `[fetch-raid-engagements] Found quote repost from ${username}:`,
                quoteId
              );
            }
          }
        }
      } catch (quoteError: any) {
        console.error(
          `[fetch-raid-engagements] Error checking quote reposts for ${username}:`,
          quoteError.message
        );
      }
    }

    console.log(
      `[fetch-raid-engagements] Total direct engagements found: ${allEngagementTweets.length}`
    );
    const timeline = allEngagementTweets;

    // 5. Update target tweet metrics in metrics table (target_current_*)
    // Handle different field names from API
    const targetMetrics: {
      contest_id: string;
      campaign_type: string;
      target_tweet_id?: string;
      target_tweet_url?: string;
      target_current_likes: number;
      target_current_comments: number;
      target_current_retweets: number;
      target_current_quote_reposts: number;
      target_current_views: number;
      last_updated_at: string;
      targets_reached?: boolean | null;
    } = {
      contest_id: contestId,
      campaign_type: "raid", // Required field - we know this is a raid campaign
      target_tweet_id: targetTweetId, // Include target tweet ID if row doesn't exist
      target_tweet_url: raidTarget.link, // Include target tweet URL if row doesn't exist
      target_current_likes:
        targetTweet.likes ||
        targetTweet.favorites ||
        targetTweet.favorite_count ||
        0,
      target_current_comments:
        targetTweet.replies || targetTweet.reply_count || 0,
      target_current_retweets:
        targetTweet.retweets || targetTweet.retweet_count || 0,
      target_current_quote_reposts:
        targetTweet.quotes || targetTweet.quote_count || 0,
      target_current_views: parseInt(
        targetTweet.views ||
          targetTweet.view_count ||
          targetTweet.views_count ||
          "0",
        10
      ),
      last_updated_at: new Date().toISOString(),
    };

    // Get target values from metrics table (they're synced from contests)
    // If not in metrics table OR if values are null, fall back to contest data
    let targetLikes: number | null = null;
    let targetComments: number | null = null;
    let targetRetweets: number | null = null;
    let targetQuoteReposts: number | null = null;

    const { data: existingMetrics } = await supabaseAdmin
      .from("twitter_campaign_metrics")
      .select(
        "target_likes, target_comments, target_retweets, target_quote_reposts"
      )
      .eq("contest_id", contestId)
      .maybeSingle();

    // Get targets from metrics table if they exist and are not null
    // Otherwise, fall back to contest data (source of truth)
    const raidTargetMetrics = raidTarget?.metrics || {};

    if (existingMetrics) {
      // Use metrics table values if they're not null, otherwise fall back to contest data
      targetLikes =
        existingMetrics.target_likes !== null &&
        existingMetrics.target_likes !== undefined
          ? existingMetrics.target_likes
          : typeof raidTargetMetrics.likes === "number"
          ? raidTargetMetrics.likes
          : typeof raidTargetMetrics.likes === "string"
          ? parseInt(raidTargetMetrics.likes, 10)
          : null;

      targetComments =
        existingMetrics.target_comments !== null &&
        existingMetrics.target_comments !== undefined
          ? existingMetrics.target_comments
          : typeof raidTargetMetrics.comments === "number"
          ? raidTargetMetrics.comments
          : typeof raidTargetMetrics.comments === "string"
          ? parseInt(raidTargetMetrics.comments, 10)
          : null;

      targetRetweets =
        existingMetrics.target_retweets !== null &&
        existingMetrics.target_retweets !== undefined
          ? existingMetrics.target_retweets
          : typeof raidTargetMetrics.retweets === "number"
          ? raidTargetMetrics.retweets
          : typeof raidTargetMetrics.retweets === "string"
          ? parseInt(raidTargetMetrics.retweets, 10)
          : null;

      targetQuoteReposts =
        existingMetrics.target_quote_reposts !== null &&
        existingMetrics.target_quote_reposts !== undefined
          ? existingMetrics.target_quote_reposts
          : typeof raidTargetMetrics.quote_reposts === "number"
          ? raidTargetMetrics.quote_reposts
          : typeof raidTargetMetrics.quote_reposts === "string"
          ? parseInt(raidTargetMetrics.quote_reposts, 10)
          : null;
    } else {
      // Fallback: Get targets from contest data if metrics row doesn't exist
      targetLikes =
        typeof raidTargetMetrics.likes === "number"
          ? raidTargetMetrics.likes
          : typeof raidTargetMetrics.likes === "string"
          ? parseInt(raidTargetMetrics.likes, 10)
          : null;
      targetComments =
        typeof raidTargetMetrics.comments === "number"
          ? raidTargetMetrics.comments
          : typeof raidTargetMetrics.comments === "string"
          ? parseInt(raidTargetMetrics.comments, 10)
          : null;
      targetRetweets =
        typeof raidTargetMetrics.retweets === "number"
          ? raidTargetMetrics.retweets
          : typeof raidTargetMetrics.retweets === "string"
          ? parseInt(raidTargetMetrics.retweets, 10)
          : null;
      targetQuoteReposts =
        typeof raidTargetMetrics.quote_reposts === "number"
          ? raidTargetMetrics.quote_reposts
          : typeof raidTargetMetrics.quote_reposts === "string"
          ? parseInt(raidTargetMetrics.quote_reposts, 10)
          : null;
    }

    // Also sync these values back to metrics table if they're different (to keep them in sync)
    // This ensures the metrics table has the correct values for future reads
    if (
      existingMetrics &&
      (existingMetrics.target_likes !== targetLikes ||
        existingMetrics.target_comments !== targetComments ||
        existingMetrics.target_retweets !== targetRetweets ||
        existingMetrics.target_quote_reposts !== targetQuoteReposts)
    ) {
      console.log(
        `[fetch-raid-engagements] Syncing target values from contest data to metrics table...`
      );
      await supabaseAdmin
        .from("twitter_campaign_metrics")
        .update({
          target_likes: targetLikes,
          target_comments: targetComments,
          target_retweets: targetRetweets,
          target_quote_reposts: targetQuoteReposts,
        })
        .eq("contest_id", contestId);
    }

    // Check if targets are reached
    // Only check targets that are actually set (not null and > 0)
    // If a target is not set (null or 0), it's ignored (doesn't need to be reached)
    // Example: If 3 out of 4 targets are set, we only need to check those 3
    const likesReached =
      targetLikes == null ||
      targetLikes === 0 || // Not set, so considered "reached" (ignored)
      targetMetrics.target_current_likes >= targetLikes; // Set, so check if reached

    const commentsReached =
      targetComments == null ||
      targetComments === 0 || // Not set, so considered "reached" (ignored)
      targetMetrics.target_current_comments >= targetComments; // Set, so check if reached

    const retweetsReached =
      targetRetweets == null ||
      targetRetweets === 0 || // Not set, so considered "reached" (ignored)
      targetMetrics.target_current_retweets >= targetRetweets; // Set, so check if reached

    const quoteRepostsReached =
      targetQuoteReposts == null ||
      targetQuoteReposts === 0 || // Not set, so considered "reached" (ignored)
      targetMetrics.target_current_quote_reposts >= targetQuoteReposts; // Set, so check if reached

    // All set targets must be reached for targets_reached to be true
    // If a target is not set, it's automatically "reached" (ignored)
    // Example: If only likes, comments, and quote_reposts are set (retweets is null),
    // then we only need likes, comments, and quote_reposts to be reached
    const targetsReached =
      likesReached && commentsReached && retweetsReached && quoteRepostsReached;

    targetMetrics.targets_reached = targetsReached;

    // Log for debugging
    console.log(
      `[fetch-raid-engagements] Targets check for contest ${contestId}:`,
      {
        target_likes: targetLikes,
        current_likes: targetMetrics.target_current_likes,
        likesReached,
        target_comments: targetComments,
        current_comments: targetMetrics.target_current_comments,
        commentsReached,
        target_retweets: targetRetweets,
        current_retweets: targetMetrics.target_current_retweets,
        retweetsReached,
        target_quote_reposts: targetQuoteReposts,
        current_quote_reposts: targetMetrics.target_current_quote_reposts,
        quoteRepostsReached,
        targetsReached,
        note: "Only set targets (not null/0) need to be reached. Unset targets are ignored.",
      }
    );

    // Use upsert instead of update to create row if it doesn't exist
    await supabaseAdmin.from("twitter_campaign_metrics").upsert(targetMetrics, {
      onConflict: "contest_id",
    });

    // ============================================================================
    // PRESERVE MODERATION: Fetch existing raid engagements BEFORE refresh
    // This ensures moderation_status and manual_points_adjustment are not lost
    // ============================================================================
    console.log(
      `[fetch-raid-engagements] Fetching existing raid engagements to preserve moderation data...`
    );
    const { data: existingRaidEngagements, error: existingEngagementsError } =
      await supabaseAdmin
        .from("twitter_campaign_tweets")
        .select(
          "tweet_id, moderation_status, manual_points_adjustment, manual_points_reason, is_eligible"
        )
        .eq("contest_id", contestId)
        .not("target_tweet_id", "is", null); // Only raid engagements (those with target_tweet_id)

    if (existingEngagementsError) {
      console.error(
        "[fetch-raid-engagements] Error fetching existing raid engagements:",
        existingEngagementsError
      );
    }

    // Create a map for quick lookup of moderation data
    const existingEngagementsMap = new Map(
      (existingRaidEngagements || []).map((e: any) => [
        e.tweet_id,
        {
          moderation_status: e.moderation_status || "pending",
          manual_points_adjustment: e.manual_points_adjustment || 0,
          manual_points_reason: e.manual_points_reason || null,
          was_eligible: e.is_eligible || false,
        },
      ])
    );

    console.log(
      `[fetch-raid-engagements] Found ${existingEngagementsMap.size} existing raid engagements to preserve moderation for`
    );

    // Track which tweet_ids we see in the fresh API response
    const freshEngagementIds = new Set<string>();

    // 6. Process all engagements (comments, retweets, quote reposts)
    const engagements: any[] = [];
    const campaignStartDate = contest.start_date
      ? new Date(contest.start_date)
      : null;

    console.log(
      `[fetch-raid-engagements] Processing ${timeline.length} direct engagements from APIs`
    );
    console.log(
      `[fetch-raid-engagements] Participant map:`,
      Array.from(participantMap.entries())
    );

    for (const tweet of timeline) {
      // Skip the target tweet itself (shouldn't happen, but safety check)
      if (tweet.tweet_id === targetTweetId || tweet.id === targetTweetId) {
        console.log(`[fetch-raid-engagements] Skipping target tweet itself`);
        continue;
      }

      // Get author username - check multiple possible fields
      const authorUsername = (
        tweet.author?.screen_name ||
        tweet.screen_name ||
        tweet.user?.screen_name ||
        ""
      )
        .toLowerCase()
        .replace("@", "");

      if (!authorUsername) {
        console.log(
          `[fetch-raid-engagements] Skipping tweet ${
            tweet.tweet_id || tweet.id
          }: No author username`
        );
        continue;
      }

      // Check if this tweet is from a participant
      const creatorId = participantMap.get(authorUsername);
      if (!creatorId) {
        console.log(
          `[fetch-raid-engagements] Skipping tweet ${
            tweet.tweet_id || tweet.id
          }: Author ${authorUsername} is not a participant`
        );
        continue; // Not a participant, skip
      }

      // Filter by participant's join date (only count engagements after they joined)
      const participantJoinDate = participantJoinDateMap.get(authorUsername);
      if (participantJoinDate) {
        const tweetDate = new Date(
          tweet.created_at || tweet.created_at_iso || new Date()
        );
        if (tweetDate < participantJoinDate) {
          console.log(
            `[fetch-raid-engagements] Skipping tweet ${
              tweet.tweet_id || tweet.id
            }: Created before participant join date (${tweetDate.toISOString()} < ${participantJoinDate.toISOString()})`
          );
          continue;
        }
      }

      // Also filter by campaign start date (only count engagements after campaign started)
      if (campaignStartDate) {
        const tweetDate = new Date(
          tweet.created_at || tweet.created_at_iso || new Date()
        );
        if (tweetDate < campaignStartDate) {
          console.log(
            `[fetch-raid-engagements] Skipping tweet ${
              tweet.tweet_id || tweet.id
            }: Created before campaign start date`
          );
          continue;
        }
      }

      // Use the pre-marked engagement type from our API calls
      // We marked engagements as: "comment", "retweet", or "quote_repost"
      let engagementType: "comment" | "retweet" | "quote_repost" | null = null;

      if (tweet._engagement_type) {
        engagementType = tweet._engagement_type as
          | "comment"
          | "retweet"
          | "quote_repost";
      } else {
        // Fallback: Determine type from tweet structure (shouldn't be needed, but safety)
        if (
          tweet.in_reply_to_status_id_str === targetTweetId ||
          tweet.in_reply_to === targetTweetId
        ) {
          engagementType = "comment";
        } else if (
          tweet.retweeted_tweet?.tweet_id === targetTweetId ||
          tweet.retweeted?.id === targetTweetId ||
          tweet.retweeted_status_id_str === targetTweetId
        ) {
          engagementType = "retweet";
        } else if (
          tweet.quoted?.tweet_id === targetTweetId ||
          tweet.quoted_status_id_str === targetTweetId
        ) {
          engagementType = "quote_repost";
        }
      }

      // CRITICAL: If no engagement type identified, skip this tweet
      if (!engagementType) {
        console.log(
          `[fetch-raid-engagements] Skipping tweet (could not determine engagement type):`,
          {
            tweet_id: tweet.tweet_id || tweet.id,
            author: authorUsername,
            _engagement_type: tweet._engagement_type,
          }
        );
        continue;
      }

      // Add detailed logging
      console.log(
        `[fetch-raid-engagements] ✅ Processing ${engagementType} engagement:`,
        {
          tweet_id: tweet.tweet_id || tweet.id,
          author: authorUsername,
          engagement_type: engagementType,
          target_tweet_id: targetTweetId,
        }
      );

      // Calculate points using the appropriate config:
      // - For CPM contests: Use brand-assigned base points and multipliers from points_config
      // - For leaderboard contests: Use hardcoded RAID_POINTS_CONFIG base points and multipliers
      const basePoints = calculateBasePoints(engagementType, raidPointsConfig);
      const engagementBonusPoints = calculateEngagementBonusPoints(
        tweet,
        engagementType,
        raidPointsConfig
      );

      // Handle different field names from API
      const tweetId = tweet.tweet_id || tweet.id || "";
      const screenName =
        tweet.author?.screen_name || tweet.screen_name || authorUsername;
      const tweetUrl =
        tweetId && screenName
          ? `https://x.com/${screenName}/status/${tweetId}`
          : "";

      // Track that we saw this engagement in the fresh API response
      freshEngagementIds.add(tweetId);

      // Get existing moderation data if engagement exists
      const existingModeration = existingEngagementsMap.get(tweetId);

      const engagement = {
        contest_id: contestId,
        creator_id: creatorId,
        tweet_id: tweetId,
        tweet_url: tweetUrl,
        twitter_username: screenName,
        tweet_text: tweet.text || tweet.full_text || "", // Updated text (handles edits)
        tweet_created_at: new Date(
          tweet.created_at || tweet.created_at_iso || new Date()
        ).toISOString(),
        tweet_type:
          engagementType === "comment"
            ? "reply"
            : engagementType === "quote_repost"
            ? "quote"
            : engagementType,
        target_tweet_id: targetTweetId, // Mark as raid engagement

        // Metrics - always update from fresh API data
        likes: tweet.likes || tweet.favorites || tweet.favorite_count || 0,
        replies: tweet.replies || tweet.reply_count || 0,
        retweets: tweet.retweets || tweet.retweet_count || 0,
        quote_reposts: tweet.quotes || tweet.quote_count || 0,
        impressions: parseInt(tweet.views || tweet.view_count || "0", 10),
        points: Math.round(basePoints + engagementBonusPoints), // Recalculate based on fresh metrics
        points_calculated_at: new Date().toISOString(),

        // Eligibility - re-check based on current data (passed filter, so eligible)
        is_eligible: true,
        eligibility_reason: `Raid engagement: ${engagementType} on target tweet`,
        filter_status: "eligible",

        // PRESERVE moderation fields if they exist, otherwise default
        moderation_status: existingModeration?.moderation_status || "pending",
        manual_points_adjustment:
          existingModeration?.manual_points_adjustment || 0,
        manual_points_reason: existingModeration?.manual_points_reason || null,
      };

      engagements.push(engagement);
    }

    // Add summary logging
    console.log(`[fetch-raid-engagements] Summary:`, {
      totalTimelineTweets: timeline.length,
      validEngagementsFound: engagements.length,
      engagementsByType: {
        comments: engagements.filter((e) => e.tweet_type === "reply").length,
        retweets: engagements.filter((e) => e.tweet_type === "retweet").length,
        quoteReposts: engagements.filter((e) => e.tweet_type === "quote")
          .length,
      },
    });

    // 7. UPSERT engagements to twitter_campaign_tweets table (with deduplication)
    if (engagements.length > 0) {
      // CRITICAL FIX: Deduplicate engagements before upserting to avoid "ON CONFLICT DO UPDATE cannot affect row a second time" error
      // Keep the last occurrence of each (contest_id, tweet_id) pair (most recent data)
      const engagementKeyMap = new Map<string, any>();
      for (const engagement of engagements) {
        const key = `${engagement.contest_id}:${engagement.tweet_id}`;
        engagementKeyMap.set(key, engagement);
      }
      const deduplicatedEngagements = Array.from(engagementKeyMap.values());

      console.log(
        `[fetch-raid-engagements] Deduplicated ${engagements.length} engagements to ${deduplicatedEngagements.length} unique engagements`
      );

      const { error: upsertError } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .upsert(deduplicatedEngagements, {
          onConflict: "contest_id,tweet_id",
        });

      if (upsertError) {
        console.error(
          "[fetch-raid-engagements] Error upserting engagements:",
          upsertError
        );
        return NextResponse.json(
          { error: "Failed to save engagements", details: upsertError },
          { status: 500 }
        );
      } else {
        console.log(
          `[fetch-raid-engagements] Successfully upserted ${deduplicatedEngagements.length} raid engagements`
        );
      }
    }

    // ============================================================================
    // MARK ENGAGEMENTS AS DELETED IF THEY'RE NOT IN FRESH API RESPONSE
    // Since we now fetch ALL tweets up to join date via pagination for participant timelines,
    // and latest_replies.php should return all engagements, if an engagement is not found,
    // it means it's actually deleted (or was never eligible)
    // ============================================================================
    console.log(
      `[fetch-raid-engagements] Processing deleted engagements (we fetched all tweets up to join date, so missing = deleted)`
    );

    // Find engagements that were in DB but not in fresh API response
    // Since we paginated through all tweets up to join date, missing engagements are truly deleted
    const engagementsToMarkAsDeleted = Array.from(
      existingEngagementsMap.keys()
    ).filter((tweetId) => !freshEngagementIds.has(tweetId));

    if (engagementsToMarkAsDeleted.length > 0) {
      console.log(
        `[fetch-raid-engagements] Marking ${engagementsToMarkAsDeleted.length} engagements as deleted (not found in complete paginated fetch)`
      );

      // Batch update deleted engagements (chunks of 100 for performance)
      const BATCH_SIZE = 100;
      for (let i = 0; i < engagementsToMarkAsDeleted.length; i += BATCH_SIZE) {
        const batch = engagementsToMarkAsDeleted.slice(i, i + BATCH_SIZE);

        // Mark as deleted/ineligible, but PRESERVE moderation status
        const deletionTimestamp = new Date().toISOString();
        const { error: updateError } = await supabaseAdmin
          .from("twitter_campaign_tweets")
          .update({
            is_eligible: false,
            filter_status: "deleted",
            is_deleted: true,
            deleted_at: deletionTimestamp,
            deletion_detected_at: deletionTimestamp,
            eligibility_reason:
              "Engagement not found in complete paginated fetch up to join date - likely deleted from Twitter",
            // DO NOT update moderation_status - preserve it!
            // DO NOT update manual_points_adjustment - preserve it!
            // DO NOT update manual_points_reason - preserve it!
          })
          .eq("contest_id", contestId)
          .in("tweet_id", batch);

        if (updateError) {
          console.error(
            `[fetch-raid-engagements] Error marking engagements as deleted (batch ${
              Math.floor(i / BATCH_SIZE) + 1
            }):`,
            updateError
          );
        } else {
          console.log(
            `[fetch-raid-engagements] Marked ${
              batch.length
            } engagements as deleted (batch ${Math.floor(i / BATCH_SIZE) + 1})`
          );
        }
      }
    } else {
      console.log(
        `[fetch-raid-engagements] No engagements to mark as deleted - all existing engagements found in fresh fetch`
      );
    }

    // 8. Calculate total_* metrics from all participant engagements
    // This aggregates likes/replies/retweets/quotes/impressions from participant's engagements
    const { data: allRaidEngagements } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select("likes, replies, retweets, quote_reposts, impressions, points")
      .eq("contest_id", contestId)
      .eq("is_eligible", true)
      .not("target_tweet_id", "is", null); // Only raid engagements

    let totalLikes = 0;
    let totalReplies = 0;
    let totalRetweets = 0;
    let totalQuoteReposts = 0;
    let totalImpressions = 0;
    let totalPoints = 0;

    if (allRaidEngagements) {
      allRaidEngagements.forEach((engagement: any) => {
        totalLikes += engagement.likes || 0;
        totalReplies += engagement.replies || 0;
        totalRetweets += engagement.retweets || 0;
        totalQuoteReposts += engagement.quote_reposts || 0;
        totalImpressions += engagement.impressions || 0;
        totalPoints += engagement.points || 0;
      });
    }

    // 9. Update leaderboard with raid engagement points
    await updateRaidLeaderboard(contestId, supabaseAdmin);

    // 10. Update total_* metrics and total_filtered_tweets in metrics table
    const { count: filteredTweetsCount } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select("*", { count: "exact", head: true })
      .eq("contest_id", contestId)
      .eq("is_eligible", true)
      .not("target_tweet_id", "is", null); // Only raid engagements

    // Get total participants count (excluding rejected creators)
    // First get all active participants
    const { data: allParticipants } = await supabaseAdmin
      .from("twitter_campaign_participants")
      .select("creator_id")
      .eq("contest_id", contestId)
      .eq("is_active", true);

    // Get rejected creator IDs
    const allCreatorIds = (allParticipants || []).map((p) => p.creator_id);
    const { data: allLeaderboardData } = await supabaseAdmin
      .from("twitter_campaign_leaderboard")
      .select("creator_id, moderation_status")
      .eq("contest_id", contestId)
      .in("creator_id", allCreatorIds);

    const rejectedCreatorIdsSet = new Set(
      (allLeaderboardData || [])
        .filter((entry) => entry.moderation_status === "rejected")
        .map((entry) => entry.creator_id)
    );

    // Count only non-rejected participants
    const totalParticipants = (allParticipants || []).filter(
      (p) => !rejectedCreatorIdsSet.has(p.creator_id)
    ).length;

    // Use upsert instead of update to create row if it doesn't exist
    await supabaseAdmin.from("twitter_campaign_metrics").upsert(
      {
        contest_id: contestId,
        campaign_type: "raid", // Required field - we know this is a raid campaign
        total_filtered_tweets: filteredTweetsCount || 0,
        total_participants: totalParticipants || 0,
        total_likes: totalLikes,
        total_replies: totalReplies,
        total_retweets: totalRetweets,
        total_quote_reposts: totalQuoteReposts,
        total_impressions: totalImpressions,
        total_points: totalPoints,
        last_updated_at: new Date().toISOString(),
      },
      {
        onConflict: "contest_id",
      }
    );

    // 11. Update last_metrics_updated in contests table (same logic as awareness campaigns)
    const currentTime = new Date().toISOString();
    console.log(
      `[fetch-raid-engagements] Attempting to update last_metrics_updated for contest ${contestId} to ${currentTime}`
    );

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("contests")
      .update({ last_metrics_updated: currentTime })
      .eq("id", contestId)
      .select();

    if (updateError) {
      console.error(
        `[fetch-raid-engagements] Failed to update last_metrics_updated for contest ${contestId}:`,
        updateError
      );
      // Don't fail the request, just log the error
    } else {
      console.log(
        `[fetch-raid-engagements] Successfully updated last_metrics_updated for contest ${contestId} to ${currentTime}`
      );
    }

    // 12. If targets reached, log it (you can add logic to end campaign here)
    if (targetMetrics.targets_reached) {
      console.log(
        `[fetch-raid-engagements] Targets reached for contest ${contestId}`
      );
      // Optionally update contest status or send notification
    }

    return NextResponse.json({
      success: true,
      targetMetrics,
      targetsReached: targetMetrics.targets_reached,
      engagementsFound: engagements.length,
      engagementsByType: {
        comments: engagements.filter((e) => e.tweet_type === "reply").length,
        retweets: engagements.filter((e) => e.tweet_type === "retweet").length,
        quoteReposts: engagements.filter((e) => e.tweet_type === "quote")
          .length,
      },
    });
  } catch (error: any) {
    console.error("[fetch-raid-engagements] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

// Helper function to calculate base points
function calculateBasePoints(
  engagementType: "comment" | "retweet" | "quote_repost",
  pointsConfig: typeof RAID_POINTS_CONFIG
): number {
  const config = {
    comment: pointsConfig.comment_base_points,
    retweet: pointsConfig.retweet_base_points,
    quote_repost: pointsConfig.quote_repost_base_points,
  };
  return config[engagementType] || 0;
}

// Helper function to calculate bonus points from engagement metrics
// This rewards creators for the engagement their engagement receives
function calculateEngagementBonusPoints(
  tweet: any,
  engagementType: "comment" | "retweet" | "quote_repost",
  pointsConfig: typeof RAID_POINTS_CONFIG
): number {
  // Handle different field names from API
  const likes = tweet.likes || tweet.favorites || tweet.favorite_count || 0;
  const replies = tweet.replies || tweet.reply_count || 0;
  const impressions = parseInt(tweet.views || tweet.view_count || "0", 10);
  const retweets = tweet.retweets || tweet.retweet_count || 0;
  const quotes = tweet.quotes || tweet.quote_count || 0;
  // const bookmarks = tweet.bookmarks || tweet.bookmark_count || 0; // If available in future

  if (engagementType === "comment") {
    // Comments can receive likes, replies, impressions, retweets, and quote reposts
    return (
      likes * pointsConfig.comment_likes_multiplier +
      replies * pointsConfig.comment_replies_multiplier +
      impressions * pointsConfig.comment_impressions_multiplier +
      retweets * pointsConfig.comment_retweets_multiplier +
      quotes * pointsConfig.comment_quote_reposts_multiplier
      // + bookmarks * pointsConfig.comment_bookmarks_multiplier
    );
  } else if (engagementType === "retweet") {
    // Retweets can receive likes, replies, impressions, and chain retweets
    return (
      likes * pointsConfig.retweet_likes_multiplier +
      replies * pointsConfig.retweet_replies_multiplier +
      impressions * pointsConfig.retweet_impressions_multiplier +
      retweets * pointsConfig.retweet_retweets_multiplier +
      quotes * pointsConfig.retweet_quote_reposts_multiplier
      // + bookmarks * pointsConfig.retweet_bookmarks_multiplier
    );
  } else if (engagementType === "quote_repost") {
    // Quote reposts can receive likes, replies, impressions, retweets, and quote reposts
    return (
      likes * pointsConfig.quote_repost_likes_multiplier +
      replies * pointsConfig.quote_repost_replies_multiplier +
      impressions * pointsConfig.quote_repost_impressions_multiplier +
      retweets * pointsConfig.quote_repost_retweets_multiplier +
      quotes * pointsConfig.quote_repost_quote_reposts_multiplier
      // + bookmarks * pointsConfig.quote_repost_bookmarks_multiplier
    );
  }

  return 0;
}

// Helper function to update leaderboard with raid engagement points
async function updateRaidLeaderboard(
  contestId: string,
  supabaseAdmin: any
): Promise<void> {
  // Aggregate points AND metrics from twitter_campaign_tweets where target_tweet_id is set (raid engagements)
  const { data: raidEngagements, error: raidError } = await supabaseAdmin
    .from("twitter_campaign_tweets")
    .select(
      "creator_id, points, likes, replies, retweets, quote_reposts, impressions, moderation_status, manual_points_adjustment"
    )
    .eq("contest_id", contestId)
    .eq("is_eligible", true)
    .not("target_tweet_id", "is", null);

  if (raidError) {
    console.error(
      "[updateRaidLeaderboard] Error fetching raid engagements:",
      raidError
    );
    return;
  }

  // Aggregate by creator - points AND metrics
  const raidDataByCreator = new Map<
    string,
    {
      points: number;
      likes: number;
      replies: number;
      retweets: number;
      quoteReposts: number;
      impressions: number;
      tweetCount: number;
    }
  >();

  if (raidEngagements) {
    raidEngagements.forEach((e: any) => {
      // Only count pending or approved tweets (not rejected)
      const moderationStatus = e.moderation_status || "pending";
      if (moderationStatus === "rejected") {
        return; // Skip rejected tweets
      }

      const existing = raidDataByCreator.get(e.creator_id) || {
        points: 0,
        likes: 0,
        replies: 0,
        retweets: 0,
        quoteReposts: 0,
        impressions: 0,
        tweetCount: 0,
      };

      // Calculate points: base points + manual adjustment
      const basePoints = e.points || 0;
      const manualAdjustment = e.manual_points_adjustment || 0;

      raidDataByCreator.set(e.creator_id, {
        points: existing.points + basePoints + manualAdjustment,
        likes: existing.likes + (e.likes || 0),
        replies: existing.replies + (e.replies || 0),
        retweets: existing.retweets + (e.retweets || 0),
        quoteReposts: existing.quoteReposts + (e.quote_reposts || 0),
        impressions: existing.impressions + (e.impressions || 0),
        tweetCount: existing.tweetCount + 1,
      });
    });
  }

  // Get existing leaderboard entries (to preserve manual adjustments)
  const { data: existingLeaderboard, error: leaderboardError } =
    await supabaseAdmin
      .from("twitter_campaign_leaderboard")
      .select(
        "creator_id, total_points, total_eligible_tweets, total_likes, total_replies, total_retweets, total_quote_reposts, total_impressions, manual_points_adjustment"
      )
      .eq("contest_id", contestId);

  if (leaderboardError) {
    console.error(
      "[updateRaidLeaderboard] Error fetching leaderboard:",
      leaderboardError
    );
    return;
  }

  // Get regular tweet points and metrics (non-raid tweets)
  const { data: regularTweets } = await supabaseAdmin
    .from("twitter_campaign_tweets")
    .select(
      "creator_id, points, likes, replies, retweets, quote_reposts, impressions, moderation_status, manual_points_adjustment"
    )
    .eq("contest_id", contestId)
    .eq("is_eligible", true)
    .is("target_tweet_id", null);

  const regularDataByCreator = new Map<
    string,
    {
      points: number;
      likes: number;
      replies: number;
      retweets: number;
      quoteReposts: number;
      impressions: number;
      tweetCount: number;
    }
  >();

  if (regularTweets) {
    regularTweets.forEach((t: any) => {
      // Only count pending or approved tweets (not rejected)
      const moderationStatus = t.moderation_status || "pending";
      if (moderationStatus === "rejected") {
        return; // Skip rejected tweets
      }

      const existing = regularDataByCreator.get(t.creator_id) || {
        points: 0,
        likes: 0,
        replies: 0,
        retweets: 0,
        quoteReposts: 0,
        impressions: 0,
        tweetCount: 0,
      };

      // Calculate points: base points + manual adjustment
      const basePoints = t.points || 0;
      const manualAdjustment = t.manual_points_adjustment || 0;

      regularDataByCreator.set(t.creator_id, {
        points: existing.points + basePoints + manualAdjustment,
        likes: existing.likes + (t.likes || 0),
        replies: existing.replies + (t.replies || 0),
        retweets: existing.retweets + (t.retweets || 0),
        quoteReposts: existing.quoteReposts + (t.quote_reposts || 0),
        impressions: existing.impressions + (t.impressions || 0),
        tweetCount: existing.tweetCount + 1,
      });
    });
  }

  // Combine all creator IDs
  const allCreatorIds = new Set([
    ...Array.from(raidDataByCreator.keys()),
    ...Array.from(regularDataByCreator.keys()),
    ...(existingLeaderboard?.map((e: any) => e.creator_id) || []),
  ]);

  // Update or create leaderboard entries
  const leaderboardUpdates: any[] = [];

  for (const creatorId of allCreatorIds) {
    const raidData = raidDataByCreator.get(creatorId) || {
      points: 0,
      likes: 0,
      replies: 0,
      retweets: 0,
      quoteReposts: 0,
      impressions: 0,
      tweetCount: 0,
    };

    const regularData = regularDataByCreator.get(creatorId) || {
      points: 0,
      likes: 0,
      replies: 0,
      retweets: 0,
      quoteReposts: 0,
      impressions: 0,
      tweetCount: 0,
    };

    // Combine raid and regular data
    const totalPoints = regularData.points + raidData.points;
    const totalLikes = regularData.likes + raidData.likes;
    const totalReplies = regularData.replies + raidData.replies;
    const totalRetweets = regularData.retweets + raidData.retweets;
    const totalQuoteReposts = regularData.quoteReposts + raidData.quoteReposts;
    const totalImpressions = regularData.impressions + raidData.impressions;
    const totalEligibleTweets = regularData.tweetCount + raidData.tweetCount;

    // Get existing leaderboard manual adjustment if any
    const existingEntry = existingLeaderboard?.find(
      (e: any) => e.creator_id === creatorId
    );
    const leaderboardManualAdjustment =
      existingEntry?.manual_points_adjustment || 0;

    const finalTotalPoints = totalPoints + leaderboardManualAdjustment;

    leaderboardUpdates.push({
      contest_id: contestId,
      creator_id: creatorId,
      total_points: finalTotalPoints,
      total_eligible_tweets: totalEligibleTweets,
      total_likes: totalLikes,
      total_replies: totalReplies,
      total_retweets: totalRetweets,
      total_quote_reposts: totalQuoteReposts,
      total_impressions: totalImpressions,
      manual_points_adjustment: leaderboardManualAdjustment, // Preserve manual adjustment
    });
  }

  // Sort by total_points and assign ranks
  leaderboardUpdates.sort((a, b) => b.total_points - a.total_points);
  leaderboardUpdates.forEach((entry, index) => {
    entry.current_rank = index + 1;
    entry.last_refreshed_at = new Date().toISOString();
    const cooldownMs = 5 * 60 * 1000; // 5 minutes
    entry.next_refresh_available_at = new Date(
      Date.now() + cooldownMs
    ).toISOString();
  });

  // Upsert leaderboard
  if (leaderboardUpdates.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from("twitter_campaign_leaderboard")
      .upsert(leaderboardUpdates, {
        onConflict: "contest_id,creator_id",
      });

    if (upsertError) {
      console.error(
        "[updateRaidLeaderboard] Error upserting leaderboard:",
        upsertError
      );
    } else {
      console.log(
        `[updateRaidLeaderboard] Updated leaderboard for ${leaderboardUpdates.length} creators`
      );
    }
  }
}
