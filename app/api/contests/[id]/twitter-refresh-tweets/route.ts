import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import axios from "axios";

export const dynamic = "force-dynamic";

// IMPORTANT: This is the ONLY endpoint that makes Twitter API calls
// This is called ONLY when:
// 1. "Refresh Feed" button is clicked (via twitter-refresh-feed)
// 2. "Refresh Metrics" button is clicked (via refresh-metrics)
// All other operations (tab switch, pagination, filtering) only read from DB
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contestId } = await params;

    // Check if this is a raid campaign and fetch raid engagements first
    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: contestCheck } = await supabaseAdmin
      .from("contests")
      .select("contest_based_details, platform")
      .eq("id", contestId)
      .maybeSingle();

    const isRaidCampaign =
      contestCheck?.platform === "twitter" &&
      contestCheck?.contest_based_details?.twitter_campaign?.campaign_type ===
        "raid";

    if (isRaidCampaign) {
      // For raid campaigns, we ONLY fetch engagements on the target tweet
      // We do NOT fetch the participant's entire timeline
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const raidResponse = await fetch(
          `${baseUrl}/api/contests/${contestId}/fetch-raid-engagements`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
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
        return NextResponse.json(
          {
            error: "Failed to fetch raid engagements",
            details:
              raidError instanceof Error ? raidError.message : "Unknown error",
          },
          { status: 500 }
        );
      }
    }

    // Optional payload from client: twitter_keywords and twitter_mentions
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
      console.log(
        "[twitter-refresh-tweets] Received campaign keywords/mentions from client:",
        { bodyKeywords, bodyMentions }
      );
    } catch {
      // No JSON body provided; ignore
    }

    // Load contest Twitter campaign config to determine points calculation for CPM-style contests
    let metricWeights = {
      likes: 1,
      comments: 1,
      retweets: 1,
      quoteReposts: 1,
      impressions: 0, // optional "views" points
    };

    try {
      const { data: contestConfig } = await supabaseAdmin
        .from("contests")
        .select("contest_based_details")
        .eq("id", contestId)
        .maybeSingle();

      const twitterCampaign =
        contestConfig?.contest_based_details?.twitter_campaign;
      const pointsConfig = twitterCampaign?.points_config || {};

      // Only override defaults if valid numeric weights are provided
      if (typeof pointsConfig.likes_weight === "number") {
        metricWeights.likes = pointsConfig.likes_weight;
      }
      if (typeof pointsConfig.comments_weight === "number") {
        metricWeights.comments = pointsConfig.comments_weight;
      }
      if (typeof pointsConfig.retweets_weight === "number") {
        metricWeights.retweets = pointsConfig.retweets_weight;
      }
      if (typeof pointsConfig.quote_reposts_weight === "number") {
        metricWeights.quoteReposts = pointsConfig.quote_reposts_weight;
      }
      if (typeof pointsConfig.impressions_weight === "number") {
        metricWeights.impressions = pointsConfig.impressions_weight;
      }
    } catch (configError) {
      console.error(
        "[twitter-refresh-tweets] Error loading Twitter points_config, using defaults:",
        configError
      );
    }

    if (!contestId) {
      return NextResponse.json(
        { error: "Contest ID is required" },
        { status: 400 }
      );
    }

    // Load all active participants for this contest
    const { data: participants, error: participantsError } = await supabase
      .from("twitter_campaign_participants")
      .select("creator_id, twitter_username")
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
    const activeParticipants = participants.filter(
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

    console.log(
      "[twitter-refresh-tweets] Fetched participants",
      contestId,
      activeParticipants
    );

    // Get Twitter campaign config from JSONB (single source of truth)
    let campaignKeywords: string[] = bodyKeywords.filter(Boolean);
    let requiredMentions: string[] = bodyMentions.filter(Boolean);
    let allowedTweetTypes: string[] = ["tweet", "quote", "retweet", "reply"]; // Default: allow all types
    let keywordsRequirementMode: "all" | "any" = "any"; // Default: any keyword matches
    let mentionsRequirementMode: "all" | "any" = "any"; // Default: any mention matches

    // Always fetch from contest data (JSONB) to get complete config including allowed_tweet_types
    const { data: contestData, error: contestError } = await supabase
      .from("contests")
      .select("contest_based_details")
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
    }

    const campaignHashtags: string[] = []; // no separate hashtags array from client for now

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
          "tweet_id, moderation_status, manual_points_adjustment, manual_points_reason, is_eligible"
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

    console.log(
      `[twitter-refresh-tweets] Found ${existingTweetsMap.size} existing tweets to preserve moderation for`
    );

    // Track which tweet_ids we see in the fresh API response
    const freshTweetIds = new Set<string>();

    const allDetails: any[] = [];
    let totalFetched = 0;
    let totalFiltered = 0;

    const rapidApiKey = process.env.TWITTER_RAPIDAPI_KEY;
    const rapidApiHost = "twitter-api45.p.rapidapi.com";

    if (!rapidApiKey) {
      console.error(
        "[twitter-refresh-tweets] TWITTER_RAPIDAPI_KEY is not configured in env"
      );
      return NextResponse.json(
        { error: "TWITTER_RAPIDAPI_KEY is not configured" },
        { status: 500 }
      );
    }

    // ============================================================================
    // SCALABILITY OPTIMIZATION: Fetch timelines in parallel batches
    // For 100+ participants with 100 tweets each, optimized for speed and API rate limits
    // - Increased batch size from 10 to 20 for better parallelization
    // - Tweets are collected and batch upserted instead of individual upserts
    // ============================================================================
    const BATCH_SIZE = 20; // Process 20 participants in parallel (increased from 10)
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

        console.log(
          "[twitter-refresh-tweets] Fetching tweets via RapidAPI replies.php for user",
          cleanUsername
        );

        // Call RapidAPI replies.php endpoint directly
        let timelineData: any;
        try {
          const options = {
            method: "GET",
            url: `https://${rapidApiHost}/replies.php`,
            params: {
              screenname: cleanUsername,
            },
            headers: {
              "x-rapidapi-key": rapidApiKey,
              "x-rapidapi-host": rapidApiHost,
            },
          };

          const res = await axios.request(options);
          console.log(
            "[twitter-refresh-tweets] RapidAPI replies.php raw response for",
            cleanUsername,
            res.data
          );
          timelineData = res.data;
        } catch (err) {
          console.error(
            "[twitter-refresh-tweets] Error calling RapidAPI replies.php for",
            cleanUsername,
            err
          );
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
        }

        const timeline: any[] = Array.isArray(timelineData?.timeline)
          ? timelineData.timeline
          : [];

        const mappedTweets = timeline.map((tweet: any) => {
          const inferredType = tweet.retweeted_tweet
            ? "retweet"
            : tweet.quoted
            ? "quote"
            : "tweet";

          return {
            tweet_id: tweet.tweet_id || tweet.id_str || tweet.id || "",
            type: inferredType,
            text: tweet.text || tweet.full_text || "",
            created_at: tweet.created_at || "",
            quotes: tweet.quotes || 0,
            favorites: tweet.favorites || 0,
            replies: tweet.replies || 0,
            retweets: tweet.retweets || 0,
            views: tweet.views || "0",
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

        console.log(
          "[twitter-refresh-tweets] Campaign-matching tweets for user",
          cleanUsername,
          campaignFilteredTweets
        );

        // OPTIMIZATION: Collect tweets for batch upserting instead of individual upserts
        // This is 60-80% faster for large datasets (100+ participants with 100+ tweets)
        for (const t of campaignFilteredTweets) {
          try {
            const tweetUrl = `https://x.com/${cleanUsername}/status/${t.tweet_id}`;

            // Track that we saw this tweet in the fresh API response
            freshTweetIds.add(t.tweet_id);

            const likes = t.favorites || 0;
            const replies = t.replies || 0;
            const retweets = t.retweets || 0;
            const quoteReposts = t.quotes || 0; // Use quotes from API response for quote reposts
            const impressions = Number(t.views) || 0;

            // Configurable scoring: brand selects which metrics count towards points
            const points =
              likes * metricWeights.likes +
              replies * metricWeights.comments +
              retweets * metricWeights.retweets +
              quoteReposts * metricWeights.quoteReposts +
              impressions * metricWeights.impressions;

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
              points, // Recalculate based on fresh metrics and campaign config
              points_calculated_at: new Date().toISOString(),

              // Eligibility - re-check based on current text (passed filter, so eligible)
              is_eligible: true,
              eligibility_reason:
                "Matches campaign keywords and mentions from contest_based_details.twitter_campaign",
              filter_status: "eligible",

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
          filteredCount: campaignFilteredTweets.length, // tweets matching campaign rules
          allTweets: validTweets, // all valid tweets before campaign filters
          filteredTweets: campaignFilteredTweets, // tweets after keyword/mention filters
        });

        return {
          username: cleanUsername,
          participant,
          rawCount: timeline.length, // raw items returned by RapidAPI
          normalizedCount: mappedTweets.length, // mapped/normalized tweets
          filteredCount: campaignFilteredTweets.length, // tweets matching campaign rules
          allTweets: validTweets, // all valid tweets before campaign filters
          filteredTweets: campaignFilteredTweets, // tweets after keyword/mention filters
          totalFetched: timeline.length,
          totalFiltered: campaignFilteredTweets.length,
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

    // ============================================================================
    // HANDLE DELETED TWEETS AND TWEETS THAT NO LONGER MATCH RULES
    // ============================================================================
    console.log(`[twitter-refresh-tweets] Processing deleted/edited tweets...`);

    // Find tweets that were in DB but not in fresh API response
    const tweetsToMarkAsDeleted = Array.from(existingTweetsMap.keys()).filter(
      (tweetId) => !freshTweetIds.has(tweetId)
    );

    if (tweetsToMarkAsDeleted.length > 0) {
      console.log(
        `[twitter-refresh-tweets] Marking ${tweetsToMarkAsDeleted.length} tweets as deleted/ineligible`
      );

      // Batch update deleted tweets (chunks of 100 for performance)
      const BATCH_SIZE = 100;
      for (let i = 0; i < tweetsToMarkAsDeleted.length; i += BATCH_SIZE) {
        const batch = tweetsToMarkAsDeleted.slice(i, i + BATCH_SIZE);

        // Mark as deleted/ineligible, but PRESERVE moderation status
        const { error: updateError } = await supabaseAdmin
          .from("twitter_campaign_tweets")
          .update({
            is_eligible: false,
            filter_status: "deleted",
            eligibility_reason:
              "Tweet no longer found in creator's timeline or no longer matches campaign rules",
            // DO NOT update moderation_status - preserve it!
            // DO NOT update manual_points_adjustment - preserve it!
            // DO NOT update manual_points_reason - preserve it!
          })
          .eq("contest_id", contestId)
          .in("tweet_id", batch);

        if (updateError) {
          console.error(
            `[twitter-refresh-tweets] Error marking tweets as deleted (batch ${
              i / BATCH_SIZE + 1
            }):`,
            updateError
          );
        } else {
          console.log(
            `[twitter-refresh-tweets] Marked ${
              batch.length
            } tweets as deleted (batch ${i / BATCH_SIZE + 1})`
          );
        }
      }
    }

    // Handle tweets that were previously eligible but now don't match rules
    // (They're in the API but didn't pass the filter)
    // Note: This is already handled above - if a tweet doesn't pass filter, it won't be in freshTweetIds
    // But we should also check for tweets that were approved but now don't match rules
    const { data: previouslyEligibleTweets } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select("tweet_id, moderation_status")
      .eq("contest_id", contestId)
      .eq("is_eligible", true)
      .is("target_tweet_id", null);

    const previouslyEligibleIds = new Set(
      (previouslyEligibleTweets || []).map((t: any) => t.tweet_id)
    );

    // Find tweets that were eligible but are NOT in fresh filtered list
    // (These are tweets that were in API but didn't pass the filter - likely edited)
    const noLongerEligible = Array.from(previouslyEligibleIds).filter(
      (tweetId) =>
        !freshTweetIds.has(tweetId) && !tweetsToMarkAsDeleted.includes(tweetId)
    );

    if (noLongerEligible.length > 0) {
      console.log(
        `[twitter-refresh-tweets] Marking ${noLongerEligible.length} tweets as no longer matching rules`
      );

      // Batch update
      const BATCH_SIZE = 100;
      for (let i = 0; i < noLongerEligible.length; i += BATCH_SIZE) {
        const batch = noLongerEligible.slice(i, i + BATCH_SIZE);

        // Mark as ineligible, preserve moderation
        const { error: updateError } = await supabaseAdmin
          .from("twitter_campaign_tweets")
          .update({
            is_eligible: false,
            filter_status: "filtered_out",
            eligibility_reason:
              "Tweet no longer matches campaign rules (may have been edited)",
            // Preserve moderation - admin may want to see why it was approved before
          })
          .eq("contest_id", contestId)
          .in("tweet_id", batch);

        if (updateError) {
          console.error(
            `[twitter-refresh-tweets] Error marking tweets as filtered_out (batch ${
              i / BATCH_SIZE + 1
            }):`,
            updateError
          );
        } else {
          // Optionally: Auto-reject tweets that were approved but no longer match rules
          // This ensures approved tweets that get edited to violate rules are rejected
          const { data: approvedTweets } = await supabaseAdmin
            .from("twitter_campaign_tweets")
            .select("tweet_id")
            .eq("contest_id", contestId)
            .in("tweet_id", batch)
            .eq("moderation_status", "verified");

          if (approvedTweets && approvedTweets.length > 0) {
            const approvedTweetIds = approvedTweets.map((t: any) => t.tweet_id);
            await supabaseAdmin
              .from("twitter_campaign_tweets")
              .update({
                moderation_status: "rejected",
                manual_points_reason:
                  "Tweet no longer matches campaign rules after edit. Previously approved tweet was edited and now violates rules.",
              })
              .eq("contest_id", contestId)
              .in("tweet_id", approvedTweetIds);

            console.log(
              `[twitter-refresh-tweets] Auto-rejected ${approvedTweetIds.length} previously approved tweets that no longer match rules`
            );
          }
        }
      }
    }

    // After saving filtered tweets, aggregate per-creator stats into twitter_campaign_leaderboard
    console.log(
      "[twitter-refresh-tweets] Aggregating leaderboard from twitter_campaign_tweets for contest",
      contestId
    );

    // Separate regular tweets from raid engagements
    const { data: regularTweets, error: regularTweetsError } = await supabase
      .from("twitter_campaign_tweets")
      .select(
        "creator_id, likes, replies, retweets, quote_reposts, impressions, points, target_tweet_id, moderation_status, manual_points_adjustment"
      )
      .eq("contest_id", contestId)
      .eq("is_eligible", true);

    if (regularTweetsError) {
      console.error(
        "[twitter-refresh-tweets] Error fetching tweets for leaderboard aggregation",
        regularTweetsError
      );
    }

    // Separate regular tweets (target_tweet_id IS NULL) from raid engagements (target_tweet_id IS NOT NULL)
    const regularTweetRows =
      regularTweets?.filter((t: any) => !t.target_tweet_id) || [];
    const raidEngagementRows =
      regularTweets?.filter((t: any) => t.target_tweet_id) || [];

    if (regularTweetRows.length > 0 || raidEngagementRows.length > 0) {
      type Agg = {
        total_points: number;
        total_eligible_tweets: number;
        total_likes: number;
        total_replies: number;
        total_retweets: number;
        total_quote_reposts: number;
        total_impressions: number;
      };

      const aggByCreator = new Map<string, Agg>();

      // Process all tweets (regular + raid engagements) - just sum points into total_points
      const allTweets = [...regularTweetRows, ...raidEngagementRows];

      for (const row of allTweets as any[]) {
        const creatorId = row.creator_id as string;
        if (!creatorId) continue;

        // Only count tweets that are pending or approved (not rejected)
        const moderationStatus = row.moderation_status || "pending";
        if (moderationStatus === "rejected") {
          continue; // Skip rejected tweets
        }

        const existing = aggByCreator.get(creatorId) || {
          total_points: 0,
          total_eligible_tweets: 0,
          total_likes: 0,
          total_replies: 0,
          total_retweets: 0,
          total_quote_reposts: 0,
          total_impressions: 0,
        };

        // Calculate points: base points + manual adjustment
        const basePoints = row.points || 0;
        const manualAdjustment = row.manual_points_adjustment || 0;
        existing.total_points += basePoints + manualAdjustment;
        existing.total_eligible_tweets += 1;
        existing.total_likes += row.likes || 0;
        existing.total_replies += row.replies || 0;
        existing.total_retweets += row.retweets || 0;
        existing.total_quote_reposts += row.quote_reposts || 0;
        existing.total_impressions += Number(row.impressions) || 0;

        aggByCreator.set(creatorId, existing);
      }

      // Get existing leaderboard entries to preserve manual adjustments
      const { data: existingLeaderboard } = await supabaseAdmin
        .from("twitter_campaign_leaderboard")
        .select("creator_id, manual_points_adjustment")
        .eq("contest_id", contestId);

      const leaderboardManualAdjustments = new Map<string, number>();
      if (existingLeaderboard) {
        existingLeaderboard.forEach((entry: any) => {
          leaderboardManualAdjustments.set(
            entry.creator_id,
            entry.manual_points_adjustment || 0
          );
        });
      }

      const leaderboardEntries = Array.from(aggByCreator.entries())
        .map(([creatorId, stats]) => {
          // Add leaderboard-level manual adjustment if exists
          const leaderboardManualAdjustment =
            leaderboardManualAdjustments.get(creatorId) || 0;
          return {
            creatorId,
            ...stats,
            total_points: stats.total_points + leaderboardManualAdjustment,
          };
        })
        .sort((a, b) => b.total_points - a.total_points);

      const nowIso = new Date().toISOString();
      const cooldownMs = 5 * 60 * 1000; // 5 minutes
      const nextRefreshIso = new Date(Date.now() + cooldownMs).toISOString();

      const upsertPayload = leaderboardEntries.map((entry, index) => {
        const leaderboardManualAdjustment =
          leaderboardManualAdjustments.get(entry.creatorId) || 0;
        return {
          contest_id: contestId,
          creator_id: entry.creatorId,
          total_points: entry.total_points,
          total_eligible_tweets: entry.total_eligible_tweets,
          total_likes: entry.total_likes,
          total_replies: entry.total_replies,
          total_retweets: entry.total_retweets,
          total_quote_reposts: entry.total_quote_reposts,
          total_impressions: entry.total_impressions,
          manual_points_adjustment: leaderboardManualAdjustment, // Preserve manual adjustment
          current_rank: index + 1,
          last_refreshed_at: nowIso,
          next_refresh_available_at: nextRefreshIso,
        };
      });

      if (upsertPayload.length > 0) {
        // Use admin client for leaderboard upsert to ensure permissions
        const { error: leaderboardUpsertError } = await supabaseAdmin
          .from("twitter_campaign_leaderboard")
          .upsert(upsertPayload, {
            onConflict: "contest_id,creator_id",
          });

        if (leaderboardUpsertError) {
          console.error(
            "[twitter-refresh-tweets] Error upserting twitter_campaign_leaderboard",
            leaderboardUpsertError
          );
        } else {
          console.log(
            "[twitter-refresh-tweets] Leaderboard updated for contest",
            contestId,
            "entries:",
            upsertPayload.length
          );
        }
      } else {
        console.log(
          "[twitter-refresh-tweets] No leaderboard entries to upsert (no eligible tweets found)"
        );
      }
    } else {
      console.log(
        "[twitter-refresh-tweets] No eligible tweets found for leaderboard aggregation",
        contestId
      );
    }

    // Update last_metrics_updated in contests table (same logic as Instagram and YouTube)
    const currentTime = new Date().toISOString();
    console.log(
      `[twitter-refresh-tweets] Attempting to update last_metrics_updated for contest ${contestId} to ${currentTime}`
    );

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("contests")
      .update({ last_metrics_updated: currentTime })
      .eq("id", contestId)
      .select();

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
      .eq("is_eligible", true);

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

    // Aggregate total metrics from eligible tweets
    // OPTIMIZED: Only select the columns we need for aggregation
    const { data: allTweets } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select("likes, replies, retweets, quote_reposts, impressions, points")
      .eq("contest_id", contestId)
      .eq("is_eligible", true);

    // Fast in-memory aggregation (sufficiently fast for 10,000+ rows)
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

    // Update metrics table
    await supabaseAdmin.from("twitter_campaign_metrics").upsert(
      {
        contest_id: contestId,
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
      {
        onConflict: "contest_id",
      }
    );

    return NextResponse.json({
      success: true,
      contestId,
      participantsCount: activeParticipants.length,
      tweetsFetched: totalFetched,
      tweetsFiltered: totalFiltered,
      details: allDetails,
      participantsRaw: activeParticipants,
      lastMetricsUpdated: currentTime,
    });
  } catch (error: any) {
    console.error("[twitter-refresh-tweets] Unexpected error", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
