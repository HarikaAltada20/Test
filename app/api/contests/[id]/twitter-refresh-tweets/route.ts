import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import {
  hasRapidApiKeys,
  rapidApiHost,
  rapidApiRequest,
} from "@/lib/twitter/rapidApiClient";
import {
  initBatchState,
  mergeBatchState,
  getBatchState,
  clearBatchState,
} from "@/lib/queue/metrics-refresh-queue";
import { syncTwitterLeaderboardFromTweets } from "@/lib/twitter/sync-twitter-leaderboard-from-tweets";
import { getTweetLeafPublicMetrics } from "@/lib/twitter/tweet-public-metrics";
import { revalidateLeaderboardCache } from "@/lib/leaderboard-cache";
import { refreshContestStats } from "@/lib/contest-stats";
import { persistContestBudgetSpent } from "@/lib/persist-contest-budget-spent";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 5; // Process 5 participants per queue batch (must match refresh-metrics)

// IMPORTANT: This is the ONLY endpoint that makes Twitter API calls
// This is called ONLY when:
// 1. "Refresh Feed" button is clicked (via twitter-refresh-feed)
// 2. "Refresh Metrics" button is clicked (via refresh-metrics)
// All other operations (tab switch, pagination, filtering) only read from DB
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const refreshTweetsStartMs = Date.now();
  try {
    const { id: contestId } = await params;

    // Queue (worker) requests: verify CRON_SECRET and skip user auth
    const fromQueueHeader = request.headers.get("x-from-queue") === "1";
    let bodyFromQueue = false;
    let queueBatchIndex: number | undefined;
    let queueTotalBatches: number | undefined;
    let bodyCreatorId: string | undefined;
    try {
      const bodyParsed = await request.clone().json();
      bodyFromQueue = bodyParsed?.fromQueue === true;
      queueBatchIndex =
        typeof bodyParsed?.batchIndex === "number" ? bodyParsed.batchIndex : undefined;
      queueTotalBatches =
        typeof bodyParsed?.totalBatches === "number" ? bodyParsed.totalBatches : undefined;
      if (typeof bodyParsed?.creatorId === "string" && bodyParsed.creatorId.trim()) {
        bodyCreatorId = bodyParsed.creatorId.trim();
      }
    } catch {
      // ignore
    }
    const fromQueue = fromQueueHeader && bodyFromQueue && queueBatchIndex !== undefined && queueTotalBatches !== undefined;
    // Single-creator mode: only refresh tweets for this creator (e.g. opportunities "Refresh Feed")
    // Also support creatorId when invoked by the queue worker (fromQueue=true).
    const creatorIdOnly = !!bodyCreatorId;

    const supabase = await createClient();
    if (fromQueue) {
      const cronSecret = process.env.CRON_SECRET;
      const authHeader = request.headers.get("authorization");
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized (queue)" }, { status: 401 });
      }
    } else {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Check if this is a raid campaign and fetch raid engagements first
    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: contestCheck } = await supabaseAdmin
      .from("contests")
      .select("contest_based_details, platform, post_contest_status")
      .eq("id", contestId)
      .maybeSingle();

    // Hard lock: same as refresh-metrics - no tweet fetch after review starts
    const postStatus = (contestCheck as { post_contest_status?: string } | null)
      ?.post_contest_status;
    if (
      postStatus === "in_review" ||
      postStatus === "verification_complete" ||
      postStatus === "payouts_processed"
    ) {
      return NextResponse.json(
        {
          error:
            "Metrics are locked after contest review begins. No further refresh allowed.",
        },
        { status: 400 }
      );
    }

    const platform = (contestCheck?.platform ?? "").toString().toLowerCase();
    const isTwitterPlatform = platform === "twitter" || platform === "x";
    const campaignTypeValue =
      contestCheck?.contest_based_details?.twitter_campaign?.campaign_type ?? "";
    const isRaidCampaign =
      isTwitterPlatform &&
      typeof campaignTypeValue === "string" &&
      campaignTypeValue.toLowerCase().trim() === "raid";

    if (isRaidCampaign && !fromQueue) {
      // Raid campaign (user-triggered only): run fetch-raid-engagements, NOT twitter-refresh-tweets
      // We do NOT fetch the participant's entire timeline
      try {
        // Construct URL from request headers (same approach as twitter-refresh-feed)
        const baseUrl = request.headers.get("host");
        const protocol = request.headers.get("x-forwarded-proto") || "http";
        const raidUrl = `${protocol}://${baseUrl}/api/contests/${contestId}/fetch-raid-engagements`;

        // Forward cookies from original request to maintain authentication
        const cookieHeader = request.headers.get("cookie");

        const raidResponse = await fetch(raidUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify(creatorIdOnly && bodyCreatorId ? { creatorId: bodyCreatorId } : {}),
        });

        // Check if the response is OK before parsing
        if (!raidResponse.ok) {
          const errorText = await raidResponse.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = {
              error: errorText || "Failed to fetch raid engagements",
            };
          }
          console.error(
            "[twitter-refresh-tweets] Raid engagements fetch failed:",
            errorData
          );
          return NextResponse.json({
            success: true,
            contestId,
            participantsCount: 0,
            tweetsFetched: 0,
            tweetsFiltered: 0,
            details: [],
            isRaidCampaign: true,
            raidEngagements: errorData,
          });
        }

        const raidData = await raidResponse.json();
        console.log(
          "[twitter-refresh-tweets] Raid engagements fetched:",
          raidData
        );

        // Return early - do NOT fetch regular tweets for raid campaigns
        return NextResponse.json({
          success: true,
          contestId,
          participantsCount: raidData.engagementsFound || 0,
          tweetsFetched: raidData.engagementsFound || 0,
          tweetsFiltered: raidData.engagementsFound || 0,
          details: [],
          isRaidCampaign: true,
          raidEngagements: raidData,
        });
      } catch (raidError) {
        console.error(
          "[twitter-refresh-tweets] Error fetching raid engagements:",
          raidError
        );
        // For raid campaigns, if fetch fails, return error (don't fall through to regular tweet fetching)
        return NextResponse.json({
          success: true,
          contestId,
          participantsCount: 0,
          tweetsFetched: 0,
          tweetsFiltered: 0,
          details: [],
          isRaidCampaign: true,
          raidEngagements: {
            error:
              raidError instanceof Error ? raidError.message : "Unknown error",
          },
        });
      }
    }

    // Optional payload from client: twitter_keywords, twitter_mentions; or from queue: fromQueue, batchIndex, totalBatches
    let bodyKeywords: string[] = [];
    let bodyMentions: string[] = [];
    try {
      const body = await request.json();
      bodyKeywords = Array.isArray(body?.twitter_keywords)
        ? body.twitter_keywords
        : [];
      bodyMentions = Array.isArray(body?.twitter_mentions)
        ? body.twitter_mentions
        : [];
      if (!fromQueue) {
        console.log(
          "[twitter-refresh-tweets] Received campaign keywords/mentions from client:",
          { bodyKeywords, bodyMentions }
        );
      }
    } catch {
      // No JSON body provided; ignore
    }

    if (!contestId) {
      return NextResponse.json(
        { error: "Contest ID is required" },
        { status: 400 }
      );
    }

    // Load all active participants for this contest (including join date)
    const { data: participants, error: participantsError } = await supabase
      .from("twitter_campaign_participants")
      .select("creator_id, twitter_username, joined_at")
      .eq("contest_id", contestId)
      .eq("is_active", true);

    if (participantsError) {
      console.error("[twitter-refresh-tweets] Error fetching participants", {
        contestId,
        error: participantsError,
      });
      return NextResponse.json(
        { error: "Failed to load participants" },
        { status: 500 }
      );
    }

    if (!participants || participants.length === 0) {
      console.log(
        "[twitter-refresh-tweets] No active participants for contest",
        contestId
      );
      return NextResponse.json({
        success: true,
        contestId,
        participantsCount: 0,
        tweetsFetched: 0,
        tweetsFiltered: 0,
        details: [],
      });
    }

    // Filter out rejected creators (same as YouTube/Instagram - don't fetch their data)
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
    let activeParticipants = participants.filter(
      (p) => !rejectedCreatorIds.has(p.creator_id)
    );

    if (activeParticipants.length === 0) {
      console.log(
        "[twitter-refresh-tweets] No active non-rejected participants for contest",
        contestId
      );
      return NextResponse.json({
        success: true,
        contestId,
        participantsCount: 0,
        tweetsFetched: 0,
        tweetsFiltered: 0,
        details: [],
      });
    }

    // Single-creator mode (e.g. opportunities "Refresh Feed"): only refresh this creator's tweets
    if (creatorIdOnly && bodyCreatorId) {
      activeParticipants = activeParticipants.filter(
        (p) => p.creator_id === bodyCreatorId
      );
      if (activeParticipants.length === 0) {
        console.log(
          "[twitter-refresh-tweets] creatorIdOnly: no active participant for creator",
          bodyCreatorId,
          contestId
        );
        return NextResponse.json({
          success: true,
          contestId,
          participantsCount: 0,
          tweetsFetched: 0,
          tweetsFiltered: 0,
          details: [],
          creatorIdOnly: true,
        });
      }
      console.log(
        "[twitter-refresh-tweets] creatorIdOnly: refreshing 1 participant",
        bodyCreatorId,
        contestId
      );
    }

    // Queue batch mode: process only this batch of participants
    if (fromQueue && queueBatchIndex !== undefined && queueTotalBatches !== undefined) {
      // For creator-only queued runs we already filtered to a single creator,
      // so avoid slicing that could accidentally skip extra participant rows.
      if (!creatorIdOnly) {
        const start = queueBatchIndex * BATCH_SIZE;
        const end = (queueBatchIndex + 1) * BATCH_SIZE;
        activeParticipants = activeParticipants.slice(start, end);
      }
      if (activeParticipants.length === 0) {
        const hasMore = queueBatchIndex + 1 < queueTotalBatches;
        return NextResponse.json({
          success: true,
          contestId,
          participantsCount: 0,
          tweetsFetched: 0,
          tweetsFiltered: 0,
          details: [],
          hasMore,
        });
      }
      if (queueBatchIndex === 0) {
        await initBatchState(contestId);
      }
      console.log(
        `[twitter-refresh-tweets] Queue batch ${queueBatchIndex + 1}/${queueTotalBatches} (${activeParticipants.length} participants)`
      );
    } else {
      console.log(
        "[twitter-refresh-tweets] Fetched participants",
        contestId,
        activeParticipants
      );
    }

    // Get Twitter campaign config from JSONB (single source of truth)
    let campaignKeywords: string[] = bodyKeywords.filter(Boolean);
    let requiredMentions: string[] = bodyMentions.filter(Boolean);
    let allowedTweetTypes: string[] = ["tweet", "quote", "retweet", "reply"]; // Default: allow all types
    let keywordsRequirementMode: "all" | "any" = "any"; // Default: any keyword matches
    let mentionsRequirementMode: "all" | "any" = "any"; // Default: any mention matches

    // Twitter CPM awareness points configuration (same model as raid)
    let isTwitterCpmContest = false;
    let twitterAwarenessPointsConfig: any = null;
    let rawTwitterPointsConfig: any = null; // Store raw points_config for tweet type calculations

    // Always fetch from contest data (JSONB) to get complete config including allowed_tweet_types
    const { data: contestData, error: contestError } = await supabase
      .from("contests")
      .select(
        "contest_based_details, contest_type, platform, max_submissions_per_creator"
      )
      .eq("id", contestId)
      .maybeSingle();

    if (!contestError && contestData) {
      const twitterCampaign = (contestData as any).contest_based_details
        ?.twitter_campaign;

      // Prefer JSONB data; contest_based_details.twitter_campaign is the single source of truth
      if (campaignKeywords.length === 0) {
        campaignKeywords = (twitterCampaign?.keywords || []).filter(Boolean);
      }
      if (requiredMentions.length === 0) {
        requiredMentions = (twitterCampaign?.mentions || []).filter(Boolean);
      }
      // Read allowed_tweet_types from JSONB (supports reposts/retweets)
      if (
        Array.isArray(twitterCampaign?.allowed_tweet_types) &&
        twitterCampaign.allowed_tweet_types.length > 0
      ) {
        allowedTweetTypes = twitterCampaign.allowed_tweet_types;
      }
      // Read requirement modes from JSONB
      if (
        twitterCampaign?.keywords_requirement_mode === "all" ||
        twitterCampaign?.keywords_requirement_mode === "any"
      ) {
        keywordsRequirementMode = twitterCampaign.keywords_requirement_mode;
      }
      if (
        twitterCampaign?.mentions_requirement_mode === "all" ||
        twitterCampaign?.mentions_requirement_mode === "any"
      ) {
        mentionsRequirementMode = twitterCampaign.mentions_requirement_mode;
      }

      // Detect Twitter CPM contests
      const contestType = (contestData as any).contest_type;
      const platform = (contestData as any).platform;
      const isTwitterPlatform =
        typeof platform === "string" &&
        (platform.toLowerCase() === "twitter" ||
          platform.toLowerCase() === "x");

      isTwitterCpmContest =
        contestType === "cpm" &&
        isTwitterPlatform &&
        twitterCampaign?.campaign_type === "awareness";

      // Store raw points_config for tweet type calculations (if available)
      if (isTwitterCpmContest && twitterCampaign?.points_config) {
        rawTwitterPointsConfig = twitterCampaign.points_config || {};
      }

      // Build points configuration for Twitter CPM awareness campaigns
      if (isTwitterCpmContest && twitterCampaign?.points_config) {
        const pointsConfig = twitterCampaign.points_config || {};

        // Base config - mirror RAID_POINTS_CONFIG defaults
        const baseConfig = {
          // BASE POINTS
          comment_base_points: 1,
          retweet_base_points: 5,
          quote_repost_base_points: 10,

          // COMMENT MULTIPLIERS
          comment_likes_multiplier: 0.1,
          comment_replies_multiplier: 1,
          comment_impressions_multiplier: 0.001,
          comment_retweets_multiplier: 0,
          comment_quote_reposts_multiplier: 0,

          // RETWEET MULTIPLIERS
          retweet_likes_multiplier: 0.05,
          retweet_replies_multiplier: 0.05,
          retweet_impressions_multiplier: 0.001,
          retweet_retweets_multiplier: 0.05,
          retweet_quote_reposts_multiplier: 0,

          // QUOTE REPOST MULTIPLIERS
          quote_repost_likes_multiplier: 0.1,
          quote_repost_replies_multiplier: 0.1,
          quote_repost_impressions_multiplier: 0.001,
          quote_repost_retweets_multiplier: 0.1,
          quote_repost_quote_reposts_multiplier: 0.1,
        };

        const cfg: any = { ...baseConfig };

        // =============================
        // Base points from points_config
        // =============================
        if (
          pointsConfig.comments_weight != null &&
          typeof pointsConfig.comments_weight === "object" &&
          pointsConfig.comments_weight.base_weight != null
        ) {
          cfg.comment_base_points =
            typeof pointsConfig.comments_weight.base_weight === "number"
              ? pointsConfig.comments_weight.base_weight
              : parseFloat(pointsConfig.comments_weight.base_weight) || 1;
        } else if (pointsConfig.comment_base_points != null) {
          cfg.comment_base_points =
            typeof pointsConfig.comment_base_points === "number"
              ? pointsConfig.comment_base_points
              : parseFloat(pointsConfig.comment_base_points) || 1;
        } else if (typeof pointsConfig.comments_weight === "number") {
          cfg.comment_base_points = pointsConfig.comments_weight;
        }

        if (
          pointsConfig.retweets_weight != null &&
          typeof pointsConfig.retweets_weight === "object" &&
          pointsConfig.retweets_weight.base_weight != null
        ) {
          cfg.retweet_base_points =
            typeof pointsConfig.retweets_weight.base_weight === "number"
              ? pointsConfig.retweets_weight.base_weight
              : parseFloat(pointsConfig.retweets_weight.base_weight) || 5;
        } else if (pointsConfig.retweet_base_points != null) {
          cfg.retweet_base_points =
            typeof pointsConfig.retweet_base_points === "number"
              ? pointsConfig.retweet_base_points
              : parseFloat(pointsConfig.retweet_base_points) || 5;
        } else if (typeof pointsConfig.retweets_weight === "number") {
          cfg.retweet_base_points = pointsConfig.retweets_weight;
        }

        if (
          pointsConfig.quote_reposts_weight != null &&
          typeof pointsConfig.quote_reposts_weight === "object" &&
          pointsConfig.quote_reposts_weight.base_weight != null
        ) {
          cfg.quote_repost_base_points =
            typeof pointsConfig.quote_reposts_weight.base_weight === "number"
              ? pointsConfig.quote_reposts_weight.base_weight
              : parseFloat(pointsConfig.quote_reposts_weight.base_weight) || 10;
        } else if (pointsConfig.quote_repost_base_points != null) {
          cfg.quote_repost_base_points =
            typeof pointsConfig.quote_repost_base_points === "number"
              ? pointsConfig.quote_repost_base_points
              : parseFloat(pointsConfig.quote_repost_base_points) || 10;
        } else if (typeof pointsConfig.quote_reposts_weight === "number") {
          cfg.quote_repost_base_points = pointsConfig.quote_reposts_weight;
        }

        // =============================
        // Comment multipliers
        // =============================
        const commentsWeightObj =
          pointsConfig.comments_weight &&
          typeof pointsConfig.comments_weight === "object"
            ? pointsConfig.comments_weight
            : null;

        if (
          commentsWeightObj?.likes_multiplier != null ||
          pointsConfig.comment_likes_multiplier != null
        ) {
          cfg.comment_likes_multiplier =
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
          cfg.comment_replies_multiplier =
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
          cfg.comment_impressions_multiplier =
            commentsWeightObj?.impressions_multiplier != null
              ? typeof commentsWeightObj.impressions_multiplier === "number"
                ? commentsWeightObj.impressions_multiplier
                : parseFloat(commentsWeightObj.impressions_multiplier) || 0.001
              : typeof pointsConfig.comment_impressions_multiplier === "number"
              ? pointsConfig.comment_impressions_multiplier
              : parseFloat(pointsConfig.comment_impressions_multiplier) ||
                0.001;
        }
        if (
          commentsWeightObj?.retweets_multiplier != null ||
          pointsConfig.comment_retweets_multiplier != null
        ) {
          cfg.comment_retweets_multiplier =
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
          cfg.comment_quote_reposts_multiplier =
            commentsWeightObj?.quote_reposts_multiplier != null
              ? typeof commentsWeightObj.quote_reposts_multiplier === "number"
                ? commentsWeightObj.quote_reposts_multiplier
                : parseFloat(commentsWeightObj.quote_reposts_multiplier) || 0
              : typeof pointsConfig.comment_quote_reposts_multiplier ===
                "number"
              ? pointsConfig.comment_quote_reposts_multiplier
              : parseFloat(pointsConfig.comment_quote_reposts_multiplier) || 0;
        }

        // =============================
        // Retweet multipliers
        // =============================
        const retweetsWeightObj =
          pointsConfig.retweets_weight &&
          typeof pointsConfig.retweets_weight === "object"
            ? pointsConfig.retweets_weight
            : null;

        if (
          retweetsWeightObj?.likes_multiplier != null ||
          pointsConfig.retweet_likes_multiplier != null
        ) {
          cfg.retweet_likes_multiplier =
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
          cfg.retweet_replies_multiplier =
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
          cfg.retweet_impressions_multiplier =
            retweetsWeightObj?.impressions_multiplier != null
              ? typeof retweetsWeightObj.impressions_multiplier === "number"
                ? retweetsWeightObj.impressions_multiplier
                : parseFloat(retweetsWeightObj.impressions_multiplier) || 0.001
              : typeof pointsConfig.retweet_impressions_multiplier === "number"
              ? pointsConfig.retweet_impressions_multiplier
              : parseFloat(pointsConfig.retweet_impressions_multiplier) ||
                0.001;
        }
        if (
          retweetsWeightObj?.retweets_multiplier != null ||
          pointsConfig.retweet_retweets_multiplier != null
        ) {
          cfg.retweet_retweets_multiplier =
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
          cfg.retweet_quote_reposts_multiplier =
            retweetsWeightObj?.quote_reposts_multiplier != null
              ? typeof retweetsWeightObj.quote_reposts_multiplier === "number"
                ? retweetsWeightObj.quote_reposts_multiplier
                : parseFloat(retweetsWeightObj.quote_reposts_multiplier) || 0
              : typeof pointsConfig.retweet_quote_reposts_multiplier ===
                "number"
              ? pointsConfig.retweet_quote_reposts_multiplier
              : parseFloat(pointsConfig.retweet_quote_reposts_multiplier) || 0;
        }

        // =============================
        // Quote repost multipliers
        // =============================
        const quoteRepostsWeightObj =
          pointsConfig.quote_reposts_weight &&
          typeof pointsConfig.quote_reposts_weight === "object"
            ? pointsConfig.quote_reposts_weight
            : null;

        if (
          quoteRepostsWeightObj?.likes_multiplier != null ||
          pointsConfig.quote_repost_likes_multiplier != null
        ) {
          cfg.quote_repost_likes_multiplier =
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
          cfg.quote_repost_replies_multiplier =
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
          cfg.quote_repost_impressions_multiplier =
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
          cfg.quote_repost_retweets_multiplier =
            quoteRepostsWeightObj?.retweets_multiplier != null
              ? typeof quoteRepostsWeightObj.retweets_multiplier === "number"
                ? quoteRepostsWeightObj.retweets_multiplier
                : parseFloat(quoteRepostsWeightObj.retweets_multiplier) || 0.1
              : typeof pointsConfig.quote_repost_retweets_multiplier ===
                "number"
              ? pointsConfig.quote_repost_retweets_multiplier
              : parseFloat(pointsConfig.quote_repost_retweets_multiplier) ||
                0.1;
        }
        if (
          quoteRepostsWeightObj?.quote_reposts_multiplier != null ||
          pointsConfig.quote_repost_quote_reposts_multiplier != null
        ) {
          cfg.quote_repost_quote_reposts_multiplier =
            quoteRepostsWeightObj?.quote_reposts_multiplier != null
              ? typeof quoteRepostsWeightObj.quote_reposts_multiplier ===
                "number"
                ? quoteRepostsWeightObj.quote_reposts_multiplier
                : parseFloat(quoteRepostsWeightObj.quote_reposts_multiplier) ||
                  0.1
              : typeof pointsConfig.quote_repost_quote_reposts_multiplier ===
                "number"
              ? pointsConfig.quote_repost_quote_reposts_multiplier
              : parseFloat(
                  pointsConfig.quote_repost_quote_reposts_multiplier
                ) || 0.1;
        }

        twitterAwarenessPointsConfig = cfg;
      }
    }

    const campaignHashtags: string[] = []; // no separate hashtags array from client for now
    const maxSubmissionsPerCreator =
      typeof contestData?.max_submissions_per_creator === "number" &&
      contestData.max_submissions_per_creator > 0
        ? contestData.max_submissions_per_creator
        : Number.POSITIVE_INFINITY;
    const hasSubmissionLimit = Number.isFinite(maxSubmissionsPerCreator);
    const isSingleSubmissionContest =
      hasSubmissionLimit && maxSubmissionsPerCreator === 1;

    console.log(
      "[twitter-refresh-tweets] Campaign details (from contest JSONB)",
      {
        contestId,
        bodyKeywords,
        bodyMentions,
        campaignKeywords,
        campaignHashtags,
        requiredMentions,
        allowedTweetTypes, // Includes retweet and quote for reposts/retweets support
        keywordsRequirementMode,
        mentionsRequirementMode,
      }
    );

    // ============================================================================
    // PRESERVE MODERATION: Fetch existing tweets BEFORE refresh to preserve moderation status
    // This ensures moderation_status and manual_points_adjustment are not lost
    // ============================================================================
    console.log(
      `[twitter-refresh-tweets] Fetching existing tweets to preserve moderation data...`
    );
    const { data: existingTweets, error: existingTweetsError } =
      await supabaseAdmin
        .from("twitter_campaign_tweets")
        .select(
          "tweet_id, creator_id, moderation_status, manual_points_adjustment, manual_points_reason, is_eligible, deleted_at"
        )
        .eq("contest_id", contestId)
        .is("target_tweet_id", null); // Only awareness tweets (raid tweets have target_tweet_id set)

    if (existingTweetsError) {
      console.error(
        "[twitter-refresh-tweets] Error fetching existing tweets:",
        existingTweetsError
      );
    }

    // Create a map for quick lookup of moderation data
    const existingTweetsMap = new Map(
      (existingTweets || []).map((t: any) => [
        t.tweet_id,
        {
          moderation_status: t.moderation_status || "pending",
          manual_points_adjustment: t.manual_points_adjustment || 0,
          manual_points_reason: t.manual_points_reason || null,
          was_eligible: t.is_eligible || false,
        },
      ])
    );
    const existingTweetCreatorMap = new Map(
      (existingTweets || []).map((t: any) => [t.tweet_id, t.creator_id || null])
    );

    const existingTweetCountsByCreator = new Map<string, number>();
    if (existingTweets) {
      existingTweets.forEach((tweet: any) => {
        if (!tweet.creator_id || !tweet.is_eligible || tweet.deleted_at) {
          return;
        }
        const currentCount =
          existingTweetCountsByCreator.get(tweet.creator_id) || 0;
        existingTweetCountsByCreator.set(tweet.creator_id, currentCount + 1);
      });
    }

    console.log(
      `[twitter-refresh-tweets] Found ${existingTweetsMap.size} existing tweets to preserve moderation for`
    );

    // Track which tweet_ids we see in the fresh API response
    const freshTweetIds = new Set<string>();
    const fetchedCreatorIds = new Set<string>();

    const allDetails: any[] = [];
    let totalFetched = 0;
    let totalFiltered = 0;

    if (!hasRapidApiKeys) {
      console.error(
        "[twitter-refresh-tweets] RapidAPI keys are not configured"
      );
      return NextResponse.json(
        { error: "Twitter RapidAPI keys are not configured" },
        { status: 500 }
      );
    }

    // ============================================================================
    // SCALABILITY OPTIMIZATION: Fetch timelines in parallel batches
    // For 100+ participants with 100 tweets each, optimized for speed and API rate limits
    // - Increased batch size from 10 to 20 for better parallelization
    // - Tweets are collected and batch upserted instead of individual upserts
    // ============================================================================
    const TWEET_UPSERT_CHUNK_SIZE = 500; // Batch upsert tweets in chunks of 500
    const participantBatches: (typeof activeParticipants)[] = [];

    for (let i = 0; i < activeParticipants.length; i += BATCH_SIZE) {
      participantBatches.push(activeParticipants.slice(i, i + BATCH_SIZE));
    }

    console.log(
      `[twitter-refresh-tweets] Processing ${activeParticipants.length} participants in ${participantBatches.length} batches of ${BATCH_SIZE}`
    );

    // Collect all tweets for batch upserting (much faster than individual upserts)
    const allTweetsToUpsert: any[] = [];

    // Process each batch in parallel
    for (
      let batchIndex = 0;
      batchIndex < participantBatches.length;
      batchIndex++
    ) {
      const batch = participantBatches[batchIndex];
      console.log(
        `[twitter-refresh-tweets] Processing batch ${batchIndex + 1}/${
          participantBatches.length
        } (${batch.length} participants)`
      );

      // Fetch all timelines in this batch in parallel
      const batchPromises = batch.map(async (participant) => {
        const username = participant.twitter_username;

        if (!username) {
          console.warn(
            "[twitter-refresh-tweets] Participant has no twitter_username",
            participant
          );
          return {
            username: null,
            participant,
            rawCount: 0,
            normalizedCount: 0,
            filteredCount: 0,
            filteredTweets: [],
            error: "Missing twitter_username on participant",
            totalFetched: 0,
            totalFiltered: 0,
          };
        }

        // Remove @ if present to get a clean screen name
        const cleanUsername = username.replace("@", "");
        const creatorId = participant.creator_id;
        const creatorExistingCount = creatorId
          ? existingTweetCountsByCreator.get(creatorId) || 0
          : 0;
        const shouldEnforceSubmissionLimit =
          hasSubmissionLimit && !!creatorId && !isSingleSubmissionContest;
        const availableSlots = shouldEnforceSubmissionLimit
          ? Math.max(maxSubmissionsPerCreator - creatorExistingCount, 0)
          : Number.POSITIVE_INFINITY;
        const maxTweetsAllowedForCreator = isSingleSubmissionContest
          ? 1
          : shouldEnforceSubmissionLimit
          ? availableSlots > 0
            ? availableSlots
            : maxSubmissionsPerCreator
          : Number.POSITIVE_INFINITY;

        if (shouldEnforceSubmissionLimit && availableSlots <= 0) {
          console.log(
            `[twitter-refresh-tweets] Creator ${cleanUsername} (${creatorId}) has already reached the submission limit (${maxSubmissionsPerCreator}). Still fetching to replace older submissions if newer ones exist.`
          );
        }

        // Get join date for this participant
        const joinDate = participant.joined_at
          ? new Date(participant.joined_at)
          : null;
        console.log(
          `[twitter-refresh-tweets] Fetching tweets via RapidAPI replies.php for user ${cleanUsername}${
            joinDate ? ` (joined: ${joinDate.toISOString()})` : ""
          }`
        );

        // Fetch ALL tweets up to join date using pagination
        let allTimelineTweets: any[] = [];
        let cursor: string | null = null;
        let hasMorePages = true;
        let pageCount = 0;
        const MAX_PAGES = 50; // Safety limit to prevent infinite loops

        while (hasMorePages && pageCount < MAX_PAGES) {
          try {
            const options: any = {
              method: "GET",
              url: `https://${rapidApiHost}/replies.php`,
              params: {
                screenname: cleanUsername,
              },
            };

            // Add cursor for pagination (if not first page)
            if (cursor) {
              options.params.cursor = cursor;
            }

            const res = await rapidApiRequest(options);
            const pageData = res.data;

            const pageTimeline: any[] = Array.isArray(pageData?.timeline)
              ? pageData.timeline
              : [];

            // Add tweets from this page
            allTimelineTweets.push(...pageTimeline);

            // Check if we've reached the join date
            if (joinDate && pageTimeline.length > 0) {
              const oldestTweet = pageTimeline[pageTimeline.length - 1];
              const oldestTweetDate = oldestTweet?.created_at
                ? new Date(oldestTweet.created_at)
                : null;

              // If oldest tweet in this page is before join date, we've fetched enough
              if (oldestTweetDate && oldestTweetDate < joinDate) {
                console.log(
                  `[twitter-refresh-tweets] Reached join date for ${cleanUsername}. Oldest tweet: ${oldestTweetDate.toISOString()}, Join date: ${joinDate.toISOString()}`
                );
                hasMorePages = false;
                break;
              }
            }

            // Check for next cursor
            const nextCursor = pageData?.next_cursor;
            if (!nextCursor || nextCursor === "0" || nextCursor === 0) {
              hasMorePages = false;
            } else {
              cursor = nextCursor;
              pageCount++;
              console.log(
                `[twitter-refresh-tweets] Fetched page ${pageCount} for ${cleanUsername}, total tweets so far: ${allTimelineTweets.length}, next cursor: ${cursor}`
              );
            }
          } catch (err) {
            console.error(
              `[twitter-refresh-tweets] Error calling RapidAPI replies.php for ${cleanUsername} (page ${
                pageCount + 1
              }):`,
              err
            );
            // If first page fails, return error. If later page fails, use what we have
            if (pageCount === 0) {
              return {
                username: cleanUsername,
                participant,
                rawCount: 0,
                normalizedCount: 0,
                filteredCount: 0,
                filteredTweets: [],
                error:
                  "Error calling RapidAPI replies.php. Check server logs for details.",
                totalFetched: 0,
                totalFiltered: 0,
              };
            } else {
              // Use what we've fetched so far
              console.log(
                `[twitter-refresh-tweets] Error on page ${
                  pageCount + 1
                } for ${cleanUsername}, using ${
                  allTimelineTweets.length
                } tweets fetched so far`
              );
              hasMorePages = false;
            }
          }
        }

        if (pageCount >= MAX_PAGES) {
          console.warn(
            `[twitter-refresh-tweets] Reached MAX_PAGES limit (${MAX_PAGES}) for ${cleanUsername}, stopping pagination`
          );
        }

        console.log(
          `[twitter-refresh-tweets] Completed pagination for ${cleanUsername}: ${
            allTimelineTweets.length
          } total tweets across ${pageCount + 1} pages`
        );

        const timeline = allTimelineTweets;
        if (participant.creator_id) {
          fetchedCreatorIds.add(participant.creator_id);
        }

        for (const rawTweet of timeline) {
          const rawTweetId =
            rawTweet?.tweet_id || rawTweet?.id_str || rawTweet?.id;
          if (rawTweetId) {
            freshTweetIds.add(rawTweetId);
          }
        }

        // Filter tweets to only include those created on or after join date
        const filteredTimeline = joinDate
          ? timeline.filter((tweet: any) => {
              const tweetDate = tweet.created_at
                ? new Date(tweet.created_at)
                : null;
              if (!tweetDate) return false;
              return tweetDate >= joinDate;
            })
          : timeline;

        console.log(
          `[twitter-refresh-tweets] Filtered ${timeline.length} tweets to ${filteredTimeline.length} tweets on/after join date for ${cleanUsername}`
        );

        const mappedTweets = filteredTimeline.map((tweet: any) => {
          const inferredType = tweet.retweeted_tweet
            ? "retweet"
            : tweet.quoted || tweet.quoted_tweet || tweet.quoted_status
            ? "quote"
            : "tweet";

          const leaf = getTweetLeafPublicMetrics(tweet);

          return {
            tweet_id: tweet.tweet_id || tweet.id_str || tweet.id || "",
            type: inferredType,
            text: tweet.text || tweet.full_text || "",
            created_at: tweet.created_at || "",
            // Use leaf metrics so retweet/quote shells don't inherit parent/target counts.
            quotes: leaf.quotes,
            favorites: leaf.likes,
            replies: leaf.replies,
            retweets: leaf.retweets,
            views:
              leaf.impressions > 0
                ? String(leaf.impressions)
                : tweet.views ?? tweet.view_count ?? "0",
            entities: {
              hashtags: tweet.entities?.hashtags || [],
              symbols: tweet.entities?.symbols || [],
              urls: tweet.entities?.urls || [],
              user_mentions: tweet.entities?.user_mentions || [],
            },
          };
        });

        console.log(
          "[twitter-refresh-tweets] Mapped tweets for user",
          cleanUsername,
          mappedTweets
        );

        // Basic validity filter: non-empty id and text
        const validTweets = mappedTweets.filter(
          (t: any) => t.tweet_id && t.text
        );

        console.log(
          `[twitter-refresh-tweets] Valid tweets before campaign filtering for ${cleanUsername}:`,
          validTweets.map((t: any) => ({
            tweet_id: t.tweet_id,
            text: t.text?.substring(0, 50),
            type: t.type,
            user_mentions: t.entities?.user_mentions,
          }))
        );

        // Campaign-level filter: match required mentions, keywords/hashtags, and allowed tweet types from contest config
        const campaignFilteredTweets = validTweets.filter((t: any) => {
          // Filter by allowed tweet types (supports reposts/retweets)
          const tweetType = t.type || "tweet";
          if (!allowedTweetTypes.includes(tweetType)) {
            console.log(
              `[twitter-refresh-tweets] Tweet ${t.tweet_id} filtered out: type ${tweetType} not in allowed types`,
              allowedTweetTypes
            );
            return false;
          }

          const textLower = (t.text || "").toLowerCase();

          // Check keywords based on requirement mode
          let hasKeyword = true; // Default to true if no keywords required
          if (campaignKeywords.length > 0 || campaignHashtags.length > 0) {
            if (keywordsRequirementMode === "all") {
              // ALL keywords/hashtags must be present
              const allKeywords = [...campaignKeywords, ...campaignHashtags];
              hasKeyword = allKeywords.every((k) =>
                textLower.includes((k || "").toLowerCase())
              );
            } else {
              // ANY keyword/hashtag must be present (default)
              hasKeyword =
                campaignKeywords.some((k) =>
                  textLower.includes((k || "").toLowerCase())
                ) ||
                campaignHashtags.some((h) =>
                  textLower.includes((h || "").toLowerCase())
                );
            }
          }

          // Check mentions based on requirement mode
          const mentions = t.entities?.user_mentions || [];
          const mentionHandles = mentions.map((m: any) =>
            ("@" + (m.screen_name || m.username || "")).toLowerCase()
          );

          let hasRequiredMention = true; // Default to true if no mentions required
          if (requiredMentions.length > 0) {
            // Normalize required mentions: add @ if not present
            const normalizedRequiredMentions = requiredMentions.map((req) => {
              const reqStr = (req || "").toLowerCase();
              return reqStr.startsWith("@") ? reqStr : "@" + reqStr;
            });

            if (mentionsRequirementMode === "all") {
              // ALL mentions must be present
              hasRequiredMention = normalizedRequiredMentions.every((req) =>
                mentionHandles.includes(req)
              );
            } else {
              // ANY mention must be present (default)
              hasRequiredMention = normalizedRequiredMentions.some((req) =>
                mentionHandles.includes(req)
              );
            }
          }

          const matches = hasKeyword && hasRequiredMention;

          if (!matches) {
            console.log(
              `[twitter-refresh-tweets] Tweet ${t.tweet_id} filtered out:`,
              {
                text: t.text?.substring(0, 50),
                hasKeyword,
                hasRequiredMention,
                keywordsRequirementMode,
                mentionsRequirementMode,
                campaignKeywords,
                requiredMentions,
                mentionHandles,
              }
            );
          }

          return matches;
        });

        console.log(
          "[twitter-refresh-tweets] Valid tweets for user (before campaign filters)",
          cleanUsername,
          validTweets
        );

        const sortedFilteredTweets = [...campaignFilteredTweets].sort(
          (a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
          }
        );
        for (const tweet of sortedFilteredTweets) {
          if (tweet.tweet_id) {
            freshTweetIds.add(tweet.tweet_id);
          }
        }
        sortedFilteredTweets.forEach((tweet: any) => {
          if (tweet.tweet_id) {
            freshTweetIds.add(tweet.tweet_id);
          }
        });
        const tweetsToProcess = Number.isFinite(maxTweetsAllowedForCreator)
          ? sortedFilteredTweets.slice(0, maxTweetsAllowedForCreator)
          : sortedFilteredTweets;

        if (
          Number.isFinite(maxTweetsAllowedForCreator) &&
          tweetsToProcess.length < sortedFilteredTweets.length
        ) {
          console.log(
            `[twitter-refresh-tweets] Limited ${cleanUsername} to ${tweetsToProcess.length} tweets due to submission cap (${maxSubmissionsPerCreator}).`
          );
        }

        if (
          shouldEnforceSubmissionLimit &&
          creatorId &&
          tweetsToProcess.length > 0
        ) {
          existingTweetCountsByCreator.set(
            creatorId,
            creatorExistingCount + tweetsToProcess.length
          );
        }

        console.log(
          "[twitter-refresh-tweets] Campaign-matching tweets for user",
          cleanUsername,
          tweetsToProcess
        );

        // OPTIMIZATION: Collect tweets for batch upserting instead of individual upserts
        // This is 60-80% faster for large datasets (100+ participants with 100+ tweets)
        for (const t of tweetsToProcess) {
          try {
            const tweetUrl = `https://x.com/${cleanUsername}/status/${t.tweet_id}`;

            // Track that we saw this tweet in the fresh API response
            freshTweetIds.add(t.tweet_id);

            const likes = t.favorites || 0;
            const replies = t.replies || 0;
            const retweets = t.retweets || 0;
            const quoteReposts = t.quotes || 0; // Use quotes from API response for quote reposts
            const impressions = Number(t.views) || 0;

            let points: number;

            // For Twitter CPM awareness campaigns, calculate points using points_config
            if (isTwitterCpmContest) {
              const rawType = (t.type || "tweet").toLowerCase();
              let engagementType:
                | "comment"
                | "retweet"
                | "quote_repost"
                | null = null;

              if (rawType === "reply") {
                engagementType = "comment";
              } else if (rawType === "retweet") {
                engagementType = "retweet";
              } else if (rawType === "quote") {
                engagementType = "quote_repost";
              }

              // For reply/retweet/quote types, use multiplier-based calculation
              if (engagementType && twitterAwarenessPointsConfig) {
                const tweetForPoints: any = {
                  likes,
                  replies,
                  retweets,
                  quotes: quoteReposts,
                  views: impressions,
                };

                const basePoints = calculateAwarenessBasePoints(
                  engagementType,
                  twitterAwarenessPointsConfig
                );
                const bonusPoints = calculateAwarenessEngagementBonusPoints(
                  tweetForPoints,
                  engagementType,
                  twitterAwarenessPointsConfig
                );

                points = Math.round(basePoints + bonusPoints);
              } else if (rawType === "tweet" && rawTwitterPointsConfig) {
                // For tweet_type = tweet, use brand-defined base points formula
                // Total Points = (Likes × Likes Base Points) + (Replies × Replies Base Points) +
                //                (Retweets × Retweets Base Points) + (Quote Reposts × Quote Reposts Base Points) +
                //                (Impressions × Impressions Base Points)
                // Extract base points from points_config
                const likesBasePoints =
                  rawTwitterPointsConfig.likes_weight || 0;

                // Replies base points from comments_weight (can be object with base_weight or number)
                let repliesBasePoints = 0;
                if (rawTwitterPointsConfig.comments_weight != null) {
                  if (
                    typeof rawTwitterPointsConfig.comments_weight ===
                      "object" &&
                    rawTwitterPointsConfig.comments_weight.base_weight != null
                  ) {
                    repliesBasePoints =
                      typeof rawTwitterPointsConfig.comments_weight
                        .base_weight === "number"
                        ? rawTwitterPointsConfig.comments_weight.base_weight
                        : parseFloat(
                            rawTwitterPointsConfig.comments_weight.base_weight
                          ) || 0;
                  } else if (
                    typeof rawTwitterPointsConfig.comments_weight === "number"
                  ) {
                    repliesBasePoints = rawTwitterPointsConfig.comments_weight;
                  }
                }

                // Retweets base points from retweets_weight (can be object with base_weight or number)
                let retweetsBasePoints = 0;
                if (rawTwitterPointsConfig.retweets_weight != null) {
                  if (
                    typeof rawTwitterPointsConfig.retweets_weight ===
                      "object" &&
                    rawTwitterPointsConfig.retweets_weight.base_weight != null
                  ) {
                    retweetsBasePoints =
                      typeof rawTwitterPointsConfig.retweets_weight
                        .base_weight === "number"
                        ? rawTwitterPointsConfig.retweets_weight.base_weight
                        : parseFloat(
                            rawTwitterPointsConfig.retweets_weight.base_weight
                          ) || 0;
                  } else if (
                    typeof rawTwitterPointsConfig.retweets_weight === "number"
                  ) {
                    retweetsBasePoints = rawTwitterPointsConfig.retweets_weight;
                  }
                }

                // Quote reposts base points from quote_reposts_weight (can be object with base_weight or number)
                let quoteRepostsBasePoints = 0;
                if (rawTwitterPointsConfig.quote_reposts_weight != null) {
                  if (
                    typeof rawTwitterPointsConfig.quote_reposts_weight ===
                      "object" &&
                    rawTwitterPointsConfig.quote_reposts_weight.base_weight !=
                      null
                  ) {
                    quoteRepostsBasePoints =
                      typeof rawTwitterPointsConfig.quote_reposts_weight
                        .base_weight === "number"
                        ? rawTwitterPointsConfig.quote_reposts_weight
                            .base_weight
                        : parseFloat(
                            rawTwitterPointsConfig.quote_reposts_weight
                              .base_weight
                          ) || 0;
                  } else if (
                    typeof rawTwitterPointsConfig.quote_reposts_weight ===
                    "number"
                  ) {
                    quoteRepostsBasePoints =
                      rawTwitterPointsConfig.quote_reposts_weight;
                  }
                }

                const impressionsBasePoints =
                  rawTwitterPointsConfig.impressions_weight || 0;

                // Calculate total points using brand-defined base points
                points = Math.round(
                  likes * likesBasePoints +
                    replies * repliesBasePoints +
                    retweets * retweetsBasePoints +
                    quoteReposts * quoteRepostsBasePoints +
                    impressions * impressionsBasePoints
                );
              } else {
                // Fallback if points_config is not available or tweet type is not handled
                points =
                  likes + replies + retweets + quoteReposts + impressions;
              }
            } else {
              // Non-CPM or non-Twitter campaigns: keep existing simple scoring
              points = likes + replies + retweets + quoteReposts + impressions;
            }

            // Get existing moderation data if tweet exists
            const existingModeration = existingTweetsMap.get(t.tweet_id);

            // Add to batch upsert array instead of upserting immediately
            allTweetsToUpsert.push({
              contest_id: contestId,
              creator_id: participant.creator_id,
              tweet_id: t.tweet_id,
              tweet_url: tweetUrl,
              twitter_username: cleanUsername,
              tweet_text: t.text, // Updated text (handles edits)
              tweet_created_at: t.created_at
                ? new Date(t.created_at).toISOString()
                : new Date().toISOString(),
              tweet_type: t.type || "tweet",
              target_tweet_id: null, // Explicitly set to NULL for awareness campaigns

              // Metrics - always update from fresh API data
              likes,
              replies,
              retweets,
              quote_reposts: quoteReposts,
              impressions,
              points, // Recalculate based on fresh metrics
              points_calculated_at: new Date().toISOString(),

              // Eligibility - re-check based on current text (passed filter, so eligible)
              is_eligible: true,
              eligibility_reason:
                "Matches campaign keywords and mentions from contest_based_details.twitter_campaign",
              deleted_at: null,
              excluded_by_submission_cap: false,

              // PRESERVE moderation fields if they exist, otherwise default
              moderation_status:
                existingModeration?.moderation_status || "pending",
              manual_points_adjustment:
                existingModeration?.manual_points_adjustment || 0,
              manual_points_reason:
                existingModeration?.manual_points_reason || null,
            });
          } catch (err) {
            console.error(
              "[twitter-refresh-tweets] Unexpected error while preparing tweet for upsert",
              {
                contestId,
                creatorId: participant.creator_id,
                tweetId: t.tweet_id,
                error: err,
              }
            );
          }
        }

        allDetails.push({
          username: cleanUsername,
          participant,
          rawCount: timeline.length, // raw items returned by RapidAPI
          normalizedCount: mappedTweets.length, // mapped/normalized tweets
          filteredCount: tweetsToProcess.length, // tweets matching campaign rules
          allTweets: validTweets, // all valid tweets before campaign filters
          filteredTweets: tweetsToProcess, // tweets after keyword/mention filters
        });

        return {
          username: cleanUsername,
          participant,
          rawCount: allTimelineTweets.length, // total raw items from all pages
          normalizedCount: mappedTweets.length, // mapped/normalized tweets (after join date filter)
          filteredCount: tweetsToProcess.length, // tweets matching campaign rules
          allTweets: validTweets, // all valid tweets before campaign filters
          filteredTweets: tweetsToProcess, // tweets after keyword/mention filters
          totalFetched: allTimelineTweets.length, // total fetched from all pages
          totalFiltered: tweetsToProcess.length, // total after all filters
        };
      });

      // Wait for all participants in this batch to complete
      const batchResults = await Promise.all(batchPromises);

      // Collect results from this batch
      for (const result of batchResults) {
        if (result) {
          allDetails.push({
            username: result.username,
            participant: result.participant,
            rawCount: result.rawCount,
            normalizedCount: result.normalizedCount,
            filteredCount: result.filteredCount,
            allTweets: result.allTweets,
            filteredTweets: result.filteredTweets,
          });
          totalFetched += result.totalFetched;
          totalFiltered += result.totalFiltered;
        }
      }

      console.log(
        `[twitter-refresh-tweets] Completed batch ${batchIndex + 1}/${
          participantBatches.length
        }`
      );
    }

    // ============================================================================
    // BATCH UPSERT ALL COLLECTED TWEETS (OPTIMIZATION: 60-80% faster than individual upserts)
    // ============================================================================
    console.log(
      `[twitter-refresh-tweets] Batch upserting ${allTweetsToUpsert.length} tweets in chunks of ${TWEET_UPSERT_CHUNK_SIZE}...`
    );

    if (allTweetsToUpsert.length > 0) {
      // CRITICAL FIX: Deduplicate tweets before upserting to avoid "ON CONFLICT DO UPDATE cannot affect row a second time" error
      // Keep the last occurrence of each (contest_id, tweet_id) pair (most recent data)
      const tweetKeyMap = new Map<string, any>();
      for (const tweet of allTweetsToUpsert) {
        const key = `${tweet.contest_id}:${tweet.tweet_id}`;
        tweetKeyMap.set(key, tweet);
      }
      const deduplicatedTweets = Array.from(tweetKeyMap.values());

      console.log(
        `[twitter-refresh-tweets] Deduplicated ${allTweetsToUpsert.length} tweets to ${deduplicatedTweets.length} unique tweets`
      );

      // Upsert in chunks to avoid overwhelming the database
      for (
        let i = 0;
        i < deduplicatedTweets.length;
        i += TWEET_UPSERT_CHUNK_SIZE
      ) {
        const chunk = deduplicatedTweets.slice(i, i + TWEET_UPSERT_CHUNK_SIZE);

        const { error: upsertError } = await supabaseAdmin
          .from("twitter_campaign_tweets")
          .upsert(chunk, {
            onConflict: "contest_id,tweet_id",
          });

        if (upsertError) {
          console.error(
            `[twitter-refresh-tweets] Error batch upserting tweets (chunk ${
              Math.floor(i / TWEET_UPSERT_CHUNK_SIZE) + 1
            }):`,
            {
              chunkSize: chunk.length,
              error: upsertError,
            }
          );
          // Continue processing other chunks even if one fails
        } else {
          console.log(
            `[twitter-refresh-tweets] Successfully batch upserted ${
              chunk.length
            } tweets (chunk ${
              Math.floor(i / TWEET_UPSERT_CHUNK_SIZE) + 1
            } of ${Math.ceil(
              deduplicatedTweets.length / TWEET_UPSERT_CHUNK_SIZE
            )})`
          );
        }
      }

      console.log(
        `[twitter-refresh-tweets] Completed batch upsert of ${deduplicatedTweets.length} tweets`
      );
    } else {
      console.log(`[twitter-refresh-tweets] No tweets to upsert`);
    }

    // Queue batch mode: merge this batch's freshTweetIds/fetchedCreatorIds into Redis
    const isLastQueueBatch =
      fromQueue &&
      queueBatchIndex !== undefined &&
      queueTotalBatches !== undefined &&
      queueBatchIndex === queueTotalBatches - 1;
    if (fromQueue && queueBatchIndex !== undefined && queueTotalBatches !== undefined) {
      await mergeBatchState(
        contestId,
        Array.from(freshTweetIds),
        Array.from(fetchedCreatorIds)
      );
      if (!isLastQueueBatch) {
        return NextResponse.json({
          success: true,
          contestId,
          participantsCount: activeParticipants.length,
          tweetsFetched: totalFetched,
          tweetsFiltered: totalFiltered,
          details: allDetails,
          hasMore: true,
        });
      }
      // Last batch: load merged state from Redis for "delete vanished" and final steps
      const mergedState = await getBatchState(contestId);
      if (mergedState) {
        freshTweetIds.clear();
        mergedState.freshTweetIds.forEach((id) => freshTweetIds.add(id));
        fetchedCreatorIds.clear();
        mergedState.fetchedCreatorIds.forEach((id) => fetchedCreatorIds.add(id));
      }
    }

    const enforceSubmissionLimit = async () => {
      if (!hasSubmissionLimit) {
        return;
      }

      console.log(
        `[twitter-refresh-tweets] Enforcing submission cap (${maxSubmissionsPerCreator}) per creator`
      );

      const { data: eligibleTweets, error: eligibleTweetsError } =
        await supabaseAdmin
          .from("twitter_campaign_tweets")
          .select("creator_id, tweet_id, tweet_created_at")
          .eq("contest_id", contestId)
          .eq("is_eligible", true)
          .is("deleted_at", null)
          .is("target_tweet_id", null)
          .order("creator_id", { ascending: true })
          .order("tweet_created_at", { ascending: false });

      if (eligibleTweetsError) {
        console.error(
          "[twitter-refresh-tweets] Failed to load eligible tweets for submission cap enforcement",
          {
            contestId,
            error: eligibleTweetsError,
          }
        );
        return;
      }

      const tweetsToDemote: string[] = [];
      const countsByCreator = new Map<string, number>();

      (eligibleTweets || []).forEach((row: any) => {
        const creatorId = row.creator_id as string | null;
        const tweetId = row.tweet_id as string | null;

        if (!creatorId || !tweetId) return;

        const currentCount = countsByCreator.get(creatorId) || 0;
        if (currentCount >= maxSubmissionsPerCreator) {
          tweetsToDemote.push(tweetId);
        } else {
          countsByCreator.set(creatorId, currentCount + 1);
        }
      });

      if (tweetsToDemote.length === 0) {
        console.log(
          `[twitter-refresh-tweets] No tweets needed demotion for submission cap (${maxSubmissionsPerCreator})`
        );
        return;
      }

      const CHUNK_SIZE = 400;
      for (let i = 0; i < tweetsToDemote.length; i += CHUNK_SIZE) {
        const chunk = tweetsToDemote.slice(i, i + CHUNK_SIZE);
        try {
          const { error: demoteError } = await supabaseAdmin
            .from("twitter_campaign_tweets")
            .update({
              is_eligible: false,
              excluded_by_submission_cap: true,
              eligibility_reason:
                "Replaced by newer submissions due to submission cap",
            })
            .eq("contest_id", contestId)
            .in("tweet_id", chunk)
            .is("target_tweet_id", null)
            .eq("is_eligible", true);

          if (demoteError) {
            console.error(
              "[twitter-refresh-tweets] Failed to demote tweets for submission cap",
              {
                contestId,
                chunkSize: chunk.length,
                error: demoteError,
              }
            );
          } else {
            console.log(
              `[twitter-refresh-tweets] Demoted ${chunk.length} tweets to comply with submission cap`
            );
          }
        } catch (demoteException) {
          console.error(
            "[twitter-refresh-tweets] Unexpected error while demoting tweets for submission cap",
            {
              contestId,
              chunk: chunk,
              error: demoteException,
            }
          );
        }
      }
    };

    await enforceSubmissionLimit();

    // ============================================================================
    // NOTE: We only delete tweets that were present but no longer returned by the fresh fetch.
    // This ensures timeline hiccups (rate limits/pagination) do not remove valid tweets, while
    // still keeping the database clean when tweets actually disappear from Twitter.
    // ============================================================================
    console.log(
      `[twitter-refresh-tweets] Checking for tweets that vanished from Twitter`
    );

    // Log tweets that weren't found for debugging, but don't mark as deleted
    const tweetsNotInFreshResponse = Array.from(existingTweetsMap.keys()).filter(
      (tweetId) => {
        const creatorId = existingTweetCreatorMap.get(tweetId);
        if (!creatorId) {
          return false;
        }
        if (!fetchedCreatorIds.has(creatorId)) {
          return false;
        }
        return !freshTweetIds.has(tweetId);
      }
    );

    if (tweetsNotInFreshResponse.length > 0) {
      console.log(
        `[twitter-refresh-tweets] Removing ${tweetsNotInFreshResponse.length} tweets that no longer appear in the API response`
      );
      const CHUNK_SIZE = 400;
      for (let i = 0; i < tweetsNotInFreshResponse.length; i += CHUNK_SIZE) {
        const chunk = tweetsNotInFreshResponse.slice(i, i + CHUNK_SIZE);
        const creatorsToRefresh = new Set<string>();
        const deletedCountByCreator = new Map<string, number>();

        const { data: tweetsToDelete, error: metadataError } =
          await supabaseAdmin
            .from("twitter_campaign_tweets")
            .select("tweet_id, creator_id")
            .eq("contest_id", contestId)
            .in("tweet_id", chunk)
            .is("target_tweet_id", null);

        if (metadataError) {
          console.error(
            "[twitter-refresh-tweets] Failed to load metadata for removed tweets",
            {
              contestId,
              chunkSize: chunk.length,
              error: metadataError,
            }
          );
        } else if (Array.isArray(tweetsToDelete)) {
          tweetsToDelete.forEach((row: any) => {
            if (row.creator_id) {
              creatorsToRefresh.add(row.creator_id);
              const prev = deletedCountByCreator.get(row.creator_id) || 0;
              deletedCountByCreator.set(row.creator_id, prev + 1);
            }
          });
        }

        try {
          const nowIso = new Date().toISOString();
          const { error: deleteError } = await supabaseAdmin
            .from("twitter_campaign_tweets")
            .update({
              deleted_at: nowIso,
              is_eligible: false,
              excluded_by_submission_cap: false,
              eligibility_reason: "Tweet no longer exists on Twitter",
            })
            .eq("contest_id", contestId)
            .in("tweet_id", chunk)
            .is("target_tweet_id", null);

          if (deleteError) {
            console.error(
              "[twitter-refresh-tweets] Failed to delete removed tweets",
              {
                contestId,
                chunkSize: chunk.length,
                error: deleteError,
              }
            );
          } else {
            console.log(
              `[twitter-refresh-tweets] Deleted ${chunk.length} tweets that were removed from Twitter`
            );
          }
        } catch (deleteException) {
          console.error(
            "[twitter-refresh-tweets] Unexpected error while deleting removed tweets",
            {
              contestId,
              chunkSize: chunk.length,
              error: deleteException,
            }
          );
        }

        if (hasSubmissionLimit && creatorsToRefresh.size > 0) {
          const { data: fallbackTweets, error: fallbackError } =
            await supabaseAdmin
              .from("twitter_campaign_tweets")
              .select("creator_id, tweet_id, tweet_created_at")
              .eq("contest_id", contestId)
              .is("target_tweet_id", null)
              .eq("excluded_by_submission_cap", true)
              .in("creator_id", Array.from(creatorsToRefresh))
              .order("creator_id", { ascending: true })
              .order("tweet_created_at", { ascending: false });

          if (fallbackError) {
            console.error(
              "[twitter-refresh-tweets] Failed to load fallback filtered tweets",
              {
                contestId,
                error: fallbackError,
              }
            );
          } else if (fallbackTweets) {
            const promotionCount = new Map<string, number>();
            const toPromote: Array<{ creatorId: string; tweetId: string }> = [];
            for (const row of fallbackTweets as any[]) {
              const creatorId = row.creator_id as string | null;
              const tweetId = row.tweet_id as string | null;
              if (!creatorId || !tweetId) continue;
              const deletedSlots = deletedCountByCreator.get(creatorId) || 0;
              const promotedSoFar = promotionCount.get(creatorId) || 0;
              if (promotedSoFar >= deletedSlots) continue;
              promotionCount.set(creatorId, promotedSoFar + 1);
              toPromote.push({ creatorId, tweetId });
            }

            for (const { creatorId, tweetId } of toPromote) {
              try {
                const { error: promoteError } = await supabaseAdmin
                  .from("twitter_campaign_tweets")
                  .update({
                    is_eligible: true,
                    excluded_by_submission_cap: false,
                    deleted_at: null,
                    eligibility_reason:
                      "Promoted after newer tweet was removed from Twitter",
                  })
                  .eq("contest_id", contestId)
                  .eq("creator_id", creatorId)
                  .eq("tweet_id", tweetId)
                  .is("target_tweet_id", null);

                if (promoteError) {
                  console.error(
                    "[twitter-refresh-tweets] Failed to promote fallback tweet to eligible",
                    {
                      contestId,
                      creatorId,
                      tweetId,
                      error: promoteError,
                    }
                  );
                } else {
                  console.log(
                    `[twitter-refresh-tweets] Promoted ${tweetId} for creator ${creatorId} after deleting a newer tweet`
                  );
                }
              } catch (promoteException) {
                console.error(
                  "[twitter-refresh-tweets] Unexpected error while promoting fallback tweet",
                  {
                    contestId,
                    creatorId,
                    tweetId,
                    error: promoteException,
                  }
                );
              }
            }
          }
        }
      }
    }

    await enforceSubmissionLimit();

    // NOTE: We also skip marking tweets as "filtered_out" if they're not in fresh response
    // because the same reasons apply - not found doesn't mean they don't match rules
    // They might just not be in the current API response due to pagination/limits
    console.log(
      `[twitter-refresh-tweets] Skipping filtered_out marking - tweets not in response may still be valid`
    );

    console.log(
      "[twitter-refresh-tweets] Aggregating leaderboard from twitter_campaign_tweets for contest",
      contestId
    );
    await syncTwitterLeaderboardFromTweets(contestId, supabaseAdmin, {
      creatorIdFilter:
        creatorIdOnly && bodyCreatorId ? bodyCreatorId : undefined,
      preserveRefreshMetadata: false,
    });

    const currentTime = new Date().toISOString();
    console.log(
      `[twitter-refresh-tweets] Preparing contest-level updates for contest ${contestId} at ${currentTime} (creatorIdOnly=${creatorIdOnly})`
    );

    // Refresh contest_stats + persisted budget_spent once after impressions land.
    await refreshContestStats(contestId);
    await persistContestBudgetSpent(contestId);

    if (!creatorIdOnly) {
      // Update last_metrics_updated in contests table (same logic as Instagram and YouTube)
      console.log(
        `[twitter-refresh-tweets] Attempting to update last_metrics_updated for contest ${contestId} to ${currentTime}`
      );

      const { error: updateError } = await supabaseAdmin
        .from("contests")
        .update({ last_metrics_updated: currentTime })
        .eq("id", contestId);

      if (updateError) {
        console.error(
          `[twitter-refresh-tweets] Failed to update last_metrics_updated for contest ${contestId}:`,
          updateError
        );
        // Don't fail the request, just log the error
      } else {
        console.log(
          `[twitter-refresh-tweets] Successfully updated last_metrics_updated for contest ${contestId} to ${currentTime}`
        );
      }

      // Update twitter_campaign_metrics table with aggregated data
      const { count: totalFilteredTweets } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .select("*", { count: "exact", head: true })
        .eq("contest_id", contestId)
        .eq("is_eligible", true)
        .is("deleted_at", null);

      // Get total participants count (excluding rejected creators)
      const { data: allParticipants } = await supabaseAdmin
        .from("twitter_campaign_participants")
        .select("creator_id")
        .eq("contest_id", contestId)
        .eq("is_active", true);

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

      const totalParticipants = (allParticipants || []).filter(
        (p) => !rejectedCreatorIdsSet.has(p.creator_id)
      ).length;

      // Aggregate total metrics from eligible tweets
      const { data: allTweets } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .select("likes, replies, retweets, quote_reposts, impressions, points")
        .eq("contest_id", contestId)
        .eq("is_eligible", true)
        .is("deleted_at", null);

      const totalLikes =
        allTweets?.reduce((sum, t) => sum + (t.likes || 0), 0) || 0;
      const totalReplies =
        allTweets?.reduce((sum, t) => sum + (t.replies || 0), 0) || 0;
      const totalRetweets =
        allTweets?.reduce((sum, t) => sum + (t.retweets || 0), 0) || 0;
      const totalQuoteReposts =
        allTweets?.reduce((sum, t) => sum + (t.quote_reposts || 0), 0) || 0;
      const totalImpressions =
        allTweets?.reduce((sum, t) => sum + (Number(t.impressions) || 0), 0) || 0;
      const totalPoints =
        allTweets?.reduce((sum, t) => sum + (t.points || 0), 0) || 0;

      const campaignType =
        contestData?.contest_based_details?.twitter_campaign?.campaign_type ||
        "awareness";

      await supabaseAdmin.from("twitter_campaign_metrics").upsert(
        {
          contest_id: contestId,
          campaign_type: campaignType,
          total_filtered_tweets: totalFilteredTweets || 0,
          total_participants: totalParticipants || 0,
          total_likes: totalLikes,
          total_replies: totalReplies,
          total_retweets: totalRetweets,
          total_quote_reposts: totalQuoteReposts,
          total_impressions: totalImpressions,
          total_points: totalPoints,
          last_updated_at: currentTime,
        },
        { onConflict: "contest_id" }
      );
    }

    if (fromQueue && isLastQueueBatch) {
      await clearBatchState(contestId);
    }

    const elapsedMs = Date.now() - refreshTweetsStartMs;
    console.log(
      `[twitter-refresh-tweets] contestId=${contestId} refresh completed in ${elapsedMs}ms participants=${activeParticipants.length} tweetsFetched=${totalFetched} fromQueue=${fromQueue}`
    );
    revalidateLeaderboardCache(contestId);
    return NextResponse.json({
      success: true,
      contestId,
      participantsCount: activeParticipants.length,
      tweetsFetched: totalFetched,
      tweetsFiltered: totalFiltered,
      details: allDetails,
      participantsRaw: activeParticipants,
      lastMetricsUpdated: currentTime,
      ...(fromQueue ? { hasMore: false } : {}),
    });
  } catch (error: any) {
    const errorElapsedMs = Date.now() - refreshTweetsStartMs;
    console.error(
      `[twitter-refresh-tweets] Unexpected error after ${errorElapsedMs}ms:`,
      error
    );
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

// Helper function to calculate base points for awareness tweets
function calculateAwarenessBasePoints(
  engagementType: "comment" | "retweet" | "quote_repost",
  pointsConfig: any
): number {
  const config = {
    comment: pointsConfig.comment_base_points,
    retweet: pointsConfig.retweet_base_points,
    quote_repost: pointsConfig.quote_repost_base_points,
  };
  return config[engagementType] || 0;
}

// Helper function to calculate bonus points from engagement metrics
function calculateAwarenessEngagementBonusPoints(
  tweet: any,
  engagementType: "comment" | "retweet" | "quote_repost",
  pointsConfig: any
): number {
  const leaf = getTweetLeafPublicMetrics(tweet);
  const likes = leaf.likes;
  const replies = leaf.replies;
  const impressions = leaf.impressions;
  const retweets = leaf.retweets;
  const quotes = leaf.quotes;

  if (engagementType === "comment") {
    return (
      likes * pointsConfig.comment_likes_multiplier +
      replies * pointsConfig.comment_replies_multiplier +
      impressions * pointsConfig.comment_impressions_multiplier +
      retweets * pointsConfig.comment_retweets_multiplier +
      0 * pointsConfig.comment_quote_reposts_multiplier
    );
  } else if (engagementType === "retweet") {
    return (
      likes * pointsConfig.retweet_likes_multiplier +
      replies * pointsConfig.retweet_replies_multiplier +
      impressions * pointsConfig.retweet_impressions_multiplier +
      retweets * pointsConfig.retweet_retweets_multiplier +
      quotes * pointsConfig.retweet_quote_reposts_multiplier
    );
  } else if (engagementType === "quote_repost") {
    return (
      likes * pointsConfig.quote_repost_likes_multiplier +
      replies * pointsConfig.quote_repost_replies_multiplier +
      impressions * pointsConfig.quote_repost_impressions_multiplier +
      retweets * pointsConfig.quote_repost_retweets_multiplier +
      quotes * pointsConfig.quote_repost_quote_reposts_multiplier
    );
  }

  return 0;
}
