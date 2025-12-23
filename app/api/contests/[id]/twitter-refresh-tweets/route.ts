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

    console.log(
      "[twitter-refresh-tweets] Fetched participants",
      contestId,
      participants
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
      const twitterCampaign = (contestData as any).contest_based_details?.twitter_campaign;
      
      // Prefer JSONB data; contest_based_details.twitter_campaign is the single source of truth
      if (campaignKeywords.length === 0) {
        campaignKeywords = (twitterCampaign?.keywords || []).filter(Boolean);
      }
      if (requiredMentions.length === 0) {
        requiredMentions = (twitterCampaign?.mentions || []).filter(Boolean);
      }
      // Read allowed_tweet_types from JSONB (supports reposts/retweets)
      if (Array.isArray(twitterCampaign?.allowed_tweet_types) && twitterCampaign.allowed_tweet_types.length > 0) {
        allowedTweetTypes = twitterCampaign.allowed_tweet_types;
      }
      // Read requirement modes from JSONB
      if (twitterCampaign?.keywords_requirement_mode === "all" || twitterCampaign?.keywords_requirement_mode === "any") {
        keywordsRequirementMode = twitterCampaign.keywords_requirement_mode;
      }
      if (twitterCampaign?.mentions_requirement_mode === "all" || twitterCampaign?.mentions_requirement_mode === "any") {
        mentionsRequirementMode = twitterCampaign.mentions_requirement_mode;
      }
    }
    
    const campaignHashtags: string[] = []; // no separate hashtags array from client for now

    console.log("[twitter-refresh-tweets] Campaign details (from contest JSONB)", {
      contestId,
      bodyKeywords,
      bodyMentions,
      campaignKeywords,
      campaignHashtags,
      requiredMentions,
      allowedTweetTypes, // Includes retweet and quote for reposts/retweets support
      keywordsRequirementMode,
      mentionsRequirementMode,
    });

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

    for (const participant of participants) {
      const username = participant.twitter_username;

      if (!username) {
        console.warn(
          "[twitter-refresh-tweets] Participant has no twitter_username",
          participant
        );
        allDetails.push({
          username: null,
          participant,
          rawCount: 0,
          normalizedCount: 0,
          filteredCount: 0,
          filteredTweets: [],
          error: "Missing twitter_username on participant",
        });
        continue;
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
        allDetails.push({
          username: cleanUsername,
          participant,
          rawCount: 0,
          normalizedCount: 0,
          filteredCount: 0,
          filteredTweets: [],
          error:
            "Error calling RapidAPI replies.php. Check server logs for details.",
        });
        continue;
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

      // Upsert filtered (campaign-matching) tweets into twitter_campaign_tweets
      for (const t of campaignFilteredTweets) {
        try {
          const tweetUrl = `https://x.com/${cleanUsername}/status/${t.tweet_id}`;

          const likes = t.favorites || 0;
          const replies = t.replies || 0;
          const retweets = t.retweets || 0;
          const quoteReposts = t.quotes || 0; // Use quotes from API response for quote reposts
          const impressions = Number(t.views) || 0;

          // Simple scoring: likes + replies + retweets + quote reposts + views
          const points = likes + replies + retweets + quoteReposts + impressions;

          const { error: upsertError } = await supabase
            .from("twitter_campaign_tweets")
            .upsert(
              {
                contest_id: contestId,
                creator_id: participant.creator_id,
                tweet_id: t.tweet_id,
                tweet_url: tweetUrl,
                twitter_username: cleanUsername,
                tweet_text: t.text,
                tweet_created_at: t.created_at
                  ? new Date(t.created_at).toISOString()
                  : new Date().toISOString(),
                tweet_type: t.type || "tweet",
                is_eligible: true,
                eligibility_reason:
                  "Matches campaign keywords and mentions from contest_based_details.twitter_campaign",
                filter_status: "eligible",
                likes,
                replies,
                retweets,
                quote_reposts: quoteReposts,
                impressions,
                points,
                points_calculated_at: new Date().toISOString(),
              },
              {
                onConflict: "contest_id,tweet_id",
              }
            );

          if (upsertError) {
            console.error(
              "[twitter-refresh-tweets] Error upserting twitter_campaign_tweets",
              {
                contestId,
                creatorId: participant.creator_id,
                tweetId: t.tweet_id,
                error: upsertError,
              }
            );
          }
        } catch (err) {
          console.error(
            "[twitter-refresh-tweets] Unexpected error while upserting tweet",
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

      totalFetched += timeline.length;
      totalFiltered += campaignFilteredTweets.length;
    }

    // After saving filtered tweets, aggregate per-creator stats into twitter_campaign_leaderboard
    console.log(
      "[twitter-refresh-tweets] Aggregating leaderboard from twitter_campaign_tweets for contest",
      contestId
    );

    const { data: tweetRows, error: leaderboardSourceError } = await supabase
      .from("twitter_campaign_tweets")
      .select(
        "creator_id, likes, replies, retweets, quote_reposts, impressions, points"
      )
      .eq("contest_id", contestId)
      .eq("is_eligible", true);

    if (leaderboardSourceError) {
      console.error(
        "[twitter-refresh-tweets] Error fetching tweets for leaderboard aggregation",
        leaderboardSourceError
      );
    } else if (tweetRows && tweetRows.length > 0) {
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

      for (const row of tweetRows as any[]) {
        const creatorId = row.creator_id as string;
        if (!creatorId) continue;

        const existing = aggByCreator.get(creatorId) || {
          total_points: 0,
          total_eligible_tweets: 0,
          total_likes: 0,
          total_replies: 0,
          total_retweets: 0,
          total_quote_reposts: 0,
          total_impressions: 0,
        };

        existing.total_points += row.points || 0;
        existing.total_eligible_tweets += 1;
        existing.total_likes += row.likes || 0;
        existing.total_replies += row.replies || 0;
        existing.total_retweets += row.retweets || 0;
        existing.total_quote_reposts += row.quote_reposts || 0;
        existing.total_impressions += Number(row.impressions) || 0;

        aggByCreator.set(creatorId, existing);
      }

      const leaderboardEntries = Array.from(aggByCreator.entries())
        .map(([creatorId, stats]) => ({ creatorId, ...stats }))
        .sort((a, b) => b.total_points - a.total_points);

      const nowIso = new Date().toISOString();
      const cooldownMs = 5 * 60 * 1000; // 5 minutes
      const nextRefreshIso = new Date(Date.now() + cooldownMs).toISOString();

      const upsertPayload = leaderboardEntries.map((entry, index) => ({
        contest_id: contestId,
        creator_id: entry.creatorId,
        total_points: entry.total_points,
        total_eligible_tweets: entry.total_eligible_tweets,
        total_likes: entry.total_likes,
        total_replies: entry.total_replies,
        total_retweets: entry.total_retweets,
        total_quote_reposts: entry.total_quote_reposts,
        total_impressions: entry.total_impressions,
        current_rank: index + 1,
        last_refreshed_at: nowIso,
        next_refresh_available_at: nextRefreshIso,
      }));

      if (upsertPayload.length > 0) {
        const { error: leaderboardUpsertError } = await supabase
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
      }
    } else {
      console.log(
        "[twitter-refresh-tweets] No eligible tweets found for leaderboard aggregation",
        contestId
      );
    }

    // Update last_metrics_updated in contests table (same logic as Instagram and YouTube)
    const currentTime = new Date().toISOString();
    console.log(`[twitter-refresh-tweets] Attempting to update last_metrics_updated for contest ${contestId} to ${currentTime}`);
    
    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('contests')
      .update({ last_metrics_updated: currentTime })
      .eq('id', contestId)
      .select();

    if (updateError) {
      console.error(`[twitter-refresh-tweets] Failed to update last_metrics_updated for contest ${contestId}:`, updateError);
      // Don't fail the request, just log the error
    } else {
      console.log(`[twitter-refresh-tweets] Successfully updated last_metrics_updated for contest ${contestId} to ${currentTime}`);
    }

    return NextResponse.json({
      success: true,
      contestId,
      participantsCount: participants.length,
      tweetsFetched: totalFetched,
      tweetsFiltered: totalFiltered,
      details: allDetails,
      participantsRaw: participants,
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
