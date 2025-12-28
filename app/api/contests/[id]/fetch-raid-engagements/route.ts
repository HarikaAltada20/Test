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
  comment_base_points: 1,           // Points for commenting on target tweet
  retweet_base_points: 5,           // Points for retweeting target tweet
  quote_repost_base_points: 10,     // Points for quote reposting target tweet
  
  // ============================================
  // COMMENT ENGAGEMENT MULTIPLIERS
  // (Reward for engagement on their comment)
  // ============================================
  comment_likes_multiplier: 0.1,           // Points per like on their comment
  comment_replies_multiplier: 1,           // Points per reply to their comment
  comment_impressions_multiplier: 0.001,   // Points per impression on their comment
  comment_retweets_multiplier: 0,          // (Comments can't be retweeted, but if they could)
  comment_quote_reposts_multiplier: 0,     // (Comments can't be quote reposted)
  
  // ============================================
  // RETWEET ENGAGEMENT MULTIPLIERS
  // (Reward for engagement on their retweet)
  // ============================================
  retweet_likes_multiplier: 0.05,          // Points per like on their retweet
  retweet_replies_multiplier: 0.05,        // Points per reply to their retweet
  retweet_impressions_multiplier: 0.001,   // Points per impression on their retweet
  retweet_retweets_multiplier: 0.05,       // Points per retweet of their retweet (chain retweets)
  retweet_quote_reposts_multiplier: 0,     // (Retweets can't be quote reposted)
  
  // ============================================
  // QUOTE REPOST ENGAGEMENT MULTIPLIERS
  // (Reward for engagement on their quote repost)
  // ============================================
  quote_repost_likes_multiplier: 0.1,      // Points per like on their quote repost
  quote_repost_replies_multiplier: 0.1,    // Points per reply to their quote repost
  quote_repost_impressions_multiplier: 0.001, // Points per impression on their quote repost
  quote_repost_retweets_multiplier: 0.1,   // Points per retweet of their quote repost
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
      .select("id, contest_based_details, start_date")
      .eq("id", contestId)
      .maybeSingle();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: "Contest not found" },
        { status: 404 }
      );
    }

    const twitterCampaign = contest.contest_based_details?.twitter_campaign;
    const raidTarget = twitterCampaign?.raid_target;

    if (
      !raidTarget?.link ||
      twitterCampaign?.campaign_type !== "raid"
    ) {
      return NextResponse.json(
        {
          error:
            "This contest is not a raid campaign or has no target tweet",
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

    // 3. Get all participants for this contest
    const { data: participants, error: participantsError } = await supabase
      .from("twitter_campaign_participants")
      .select("creator_id, twitter_username")
      .eq("contest_id", contestId)
      .eq("is_active", true);

    if (participantsError || !participants || participants.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active participants",
        engagementsFound: 0,
      });
    }

    // Create map of username -> creator_id for quick lookup
    const participantMap = new Map<string, string>();
    participants.forEach((p) => {
      if (p.twitter_username) {
        const cleanUsername = p.twitter_username.replace("@", "").toLowerCase();
        participantMap.set(cleanUsername, p.creator_id);
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
        { error: "Failed to fetch target tweet info", details: tweetInfoError.message },
        { status: 500 }
      );
    }

    // 4b. Fetch engagements (replies, retweets, quote reposts) using latest_replies.php
    // This endpoint returns ALL engagements (replies, retweets, quote reposts) on the target tweet
    const allEngagementTweets: any[] = [];
    
    try {
      const repliesOptions = {
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

      const repliesResponse = await axios.request(repliesOptions);
      const repliesData = repliesResponse.data;
      
      // The latest_replies.php endpoint returns engagements in a timeline array
      const allEngagements = Array.isArray(repliesData?.timeline) ? repliesData.timeline : 
                            Array.isArray(repliesData) ? repliesData : [];
      
      console.log(`[fetch-raid-engagements] Found ${allEngagements.length} total engagements from latest_replies.php`);
      
      // Process all engagements - identify replies, retweets, and quote reposts
      for (const engagement of allEngagements) {
        // Skip the target tweet itself
        const engagementId = engagement.tweet_id || engagement.id;
        if (engagementId === targetTweetId) {
          continue;
        }
        
        let engagementType: "comment" | "retweet" | "quote_repost" | null = null;
        
        // Check if it's a DIRECT reply (comment) to the target tweet
        if (engagement.in_reply_to_status_id_str === targetTweetId || 
            engagement.in_reply_to === targetTweetId ||
            engagement.in_reply_to_status_id === targetTweetId) {
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
          const alreadyAdded = allEngagementTweets.some(e => 
            (e.tweet_id || e.id) === engagementId
          );
          
          if (!alreadyAdded) {
            allEngagementTweets.push({
              ...engagement,
              _engagement_type: engagementType, // Mark the type for later processing
            });
            console.log(`[fetch-raid-engagements] Found ${engagementType} engagement:`, engagementId);
          }
        } else {
          // Log engagements that couldn't be identified
          console.log(`[fetch-raid-engagements] Could not identify engagement type:`, {
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
          });
        }
      }
      
      console.log(`[fetch-raid-engagements] Processed engagements from latest_replies.php:`, {
        total: allEngagements.length,
        identified: allEngagementTweets.length,
        byType: {
          comments: allEngagementTweets.filter(e => e._engagement_type === "comment").length,
          retweets: allEngagementTweets.filter(e => e._engagement_type === "retweet").length,
          quoteReposts: allEngagementTweets.filter(e => e._engagement_type === "quote_repost").length,
        },
      });
    } catch (repliesError: any) {
      console.error("[fetch-raid-engagements] Error fetching replies:", repliesError.message);
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
      
      console.log(`[fetch-raid-engagements] Found ${retweetsFromEndpoint.length} retweets from retweets.php`);
      console.log(`[fetch-raid-engagements] Retweets API response structure:`, {
        hasTimeline: !!retweetsData?.timeline,
        hasUsers: !!retweetsData?.users,
        hasRetweets: !!retweetsData?.retweets,
        isArray: Array.isArray(retweetsData),
        keys: retweetsData ? Object.keys(retweetsData) : [],
        sampleRetweet: retweetsFromEndpoint[0] ? {
          keys: Object.keys(retweetsFromEndpoint[0]),
          tweet_id: retweetsFromEndpoint[0].tweet_id,
          id: retweetsFromEndpoint[0].id,
          rest_id: retweetsFromEndpoint[0].rest_id,
          screen_name: retweetsFromEndpoint[0].screen_name,
        } : null,
      });
      
      for (const retweet of retweetsFromEndpoint) {
        // Get tweet ID - might be in different fields
        const tweetId = retweet.tweet_id || retweet.id || retweet.rest_id || retweet.retweet_id;
        
        // If it's a user object (has screen_name but no tweet_id), we need to fetch their timeline
        const isUserObject = retweet.screen_name && !tweetId;
        
        if (isUserObject) {
          // This is a user object - we need to fetch their timeline to find the retweet
          const username = retweet.screen_name;
          console.log(`[fetch-raid-engagements] Retweet is user object (${username}), fetching their timeline to find retweet`);
          
          try {
            // Fetch user's timeline to find their retweet of the target tweet
            const userTimelineOptions = {
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
            
            const userTimelineResponse = await axios.request(userTimelineOptions);
            const userTimelineData = userTimelineResponse.data;
            const userTimeline = Array.isArray(userTimelineData?.timeline) ? userTimelineData.timeline : [];
            
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
                const alreadyAdded = allEngagementTweets.some(e => 
                  (e.tweet_id || e.id) === retweetId
                );
                
                if (!alreadyAdded) {
                  allEngagementTweets.push({
                    ...tweet,
                    _engagement_type: "retweet",
                  });
                  console.log(`[fetch-raid-engagements] Found retweet from ${username}:`, retweetId);
                  break; // Found the retweet, no need to continue
                }
              }
            }
          } catch (userTimelineError: any) {
            console.error(`[fetch-raid-engagements] Error fetching timeline for ${username}:`, userTimelineError.message);
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
          const alreadyAdded = allEngagementTweets.some(e => 
            (e.tweet_id || e.id) === tweetId
          );
          
          if (!alreadyAdded) {
            allEngagementTweets.push({
              ...retweet,
              tweet_id: tweetId || retweet.tweet_id || retweet.id, // Ensure tweet_id is set
              _engagement_type: "retweet", // Mark as retweet
            });
            console.log(`[fetch-raid-engagements] Added retweet from retweets.php:`, tweetId || "unknown");
          } else {
            console.log(`[fetch-raid-engagements] Retweet already added from latest_replies.php:`, tweetId);
          }
        } else {
          console.log(`[fetch-raid-engagements] Skipping retweet (no tweet_id and not verified):`, {
            hasTweetId: !!tweetId,
            isRetweetOfTarget,
            keys: Object.keys(retweet),
          });
        }
      }
    } catch (retweetsError: any) {
      console.error("[fetch-raid-engagements] Error fetching retweets:", retweetsError.message);
    }
    
    // 4d. Search participant timelines for quote reposts (if not already found in latest_replies.php)
    // Quote reposts might not be in latest_replies.php, so we'll check each participant's timeline
    console.log(`[fetch-raid-engagements] Checking participant timelines for quote reposts...`);
    for (const participant of participants) {
      const username = participant.twitter_username?.replace("@", "");
      if (!username) continue;
      
      try {
        // Fetch participant's timeline
        const userTimelineOptions = {
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
        
        const userTimelineResponse = await axios.request(userTimelineOptions);
        const userTimelineData = userTimelineResponse.data;
        const userTimeline = Array.isArray(userTimelineData?.timeline) ? userTimelineData.timeline : [];
        
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
            const alreadyAdded = allEngagementTweets.some(e => 
              (e.tweet_id || e.id) === quoteId
            );
            
            if (!alreadyAdded) {
              allEngagementTweets.push({
                ...tweet,
                _engagement_type: "quote_repost",
              });
              console.log(`[fetch-raid-engagements] Found quote repost from ${username}:`, quoteId);
            }
          }
        }
      } catch (quoteError: any) {
        console.error(`[fetch-raid-engagements] Error checking quote reposts for ${username}:`, quoteError.message);
      }
    }
    
    console.log(`[fetch-raid-engagements] Total direct engagements found: ${allEngagementTweets.length}`);
    const timeline = allEngagementTweets;

    // 5. Update target tweet metrics in metrics table (target_current_*)
    // Handle different field names from API
    const targetMetrics: {
      target_current_likes: number;
      target_current_comments: number;
      target_current_retweets: number;
      target_current_quote_reposts: number;
      target_current_views: number;
      last_updated_at: string;
      targets_reached?: boolean | null;
    } = {
      target_current_likes: targetTweet.likes || targetTweet.favorites || targetTweet.favorite_count || 0,
      target_current_comments: targetTweet.replies || targetTweet.reply_count || 0,
      target_current_retweets: targetTweet.retweets || targetTweet.retweet_count || 0,
      target_current_quote_reposts: targetTweet.quotes || targetTweet.quote_count || 0,
      target_current_views: parseInt(
        targetTweet.views || targetTweet.view_count || targetTweet.views_count || "0",
        10
      ),
      last_updated_at: new Date().toISOString(),
    };

    // Get target values from metrics table (they're synced from contests)
    const { data: existingMetrics } = await supabaseAdmin
      .from("twitter_campaign_metrics")
      .select("target_likes, target_comments, target_retweets, target_quote_reposts")
      .eq("contest_id", contestId)
      .maybeSingle();

    if (existingMetrics) {
      // Check if targets are reached
      const targetsReached =
        (existingMetrics.target_likes === null ||
          existingMetrics.target_likes === 0 ||
          targetMetrics.target_current_likes >= existingMetrics.target_likes) &&
        (existingMetrics.target_comments === null ||
          existingMetrics.target_comments === 0 ||
          targetMetrics.target_current_comments >=
            existingMetrics.target_comments) &&
        (existingMetrics.target_retweets === null ||
          existingMetrics.target_retweets === 0 ||
          targetMetrics.target_current_retweets >=
            existingMetrics.target_retweets) &&
        (existingMetrics.target_quote_reposts === null ||
          existingMetrics.target_quote_reposts === 0 ||
          targetMetrics.target_current_quote_reposts >=
            existingMetrics.target_quote_reposts);

      targetMetrics.targets_reached = targetsReached;
    }

    await supabaseAdmin
      .from("twitter_campaign_metrics")
      .update(targetMetrics)
      .eq("contest_id", contestId);

    // 6. DELETE ALL EXISTING RAID ENGAGEMENTS FOR FRESH REFRESH
    // This ensures deleted tweets are removed and we start from scratch
    // Also reset leaderboard points for raid engagements
    console.log(`[fetch-raid-engagements] Deleting all existing raid engagements for fresh refresh...`);
    
    // Delete all raid engagements (tweets with target_tweet_id)
    const { error: deleteError } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .delete()
      .eq("contest_id", contestId)
      .not("target_tweet_id", "is", null); // Only delete raid engagements (those with target_tweet_id)

    if (deleteError) {
      console.error("[fetch-raid-engagements] Error deleting existing raid engagements:", deleteError);
      // Continue anyway - we'll upsert which will update existing ones
    } else {
      console.log(`[fetch-raid-engagements] Successfully deleted all existing raid engagements`);
    }

    // Note: Leaderboard will be recalculated from scratch by updateRaidLeaderboard()
    // which aggregates points from twitter_campaign_tweets table

    // 7. Process all engagements (comments, retweets, quote reposts)
    const engagements: any[] = [];
    const campaignStartDate = contest.start_date
      ? new Date(contest.start_date)
      : null;

    console.log(`[fetch-raid-engagements] Processing ${timeline.length} direct engagements from APIs`);
    console.log(`[fetch-raid-engagements] Participant map:`, Array.from(participantMap.entries()));

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
      ).toLowerCase().replace("@", "");
      
      if (!authorUsername) {
        console.log(`[fetch-raid-engagements] Skipping tweet ${tweet.tweet_id || tweet.id}: No author username`);
        continue;
      }

      // Check if this tweet is from a participant
      const creatorId = participantMap.get(authorUsername);
      if (!creatorId) {
        console.log(`[fetch-raid-engagements] Skipping tweet ${tweet.tweet_id || tweet.id}: Author ${authorUsername} is not a participant`);
        continue; // Not a participant, skip
      }

      // Filter by campaign start date (only count engagements after campaign started)
      if (campaignStartDate) {
        const tweetDate = new Date(tweet.created_at || tweet.created_at_iso || new Date());
        if (tweetDate < campaignStartDate) {
          console.log(`[fetch-raid-engagements] Skipping tweet ${tweet.tweet_id || tweet.id}: Created before campaign start date`);
          continue;
        }
      }

      // Use the pre-marked engagement type from our API calls
      // We marked engagements as: "comment", "retweet", or "quote_repost"
      let engagementType: "comment" | "retweet" | "quote_repost" | null = null;
      
      if (tweet._engagement_type) {
        engagementType = tweet._engagement_type as "comment" | "retweet" | "quote_repost";
      } else {
        // Fallback: Determine type from tweet structure (shouldn't be needed, but safety)
        if (tweet.in_reply_to_status_id_str === targetTweetId || tweet.in_reply_to === targetTweetId) {
          engagementType = "comment";
        } else if (tweet.retweeted_tweet?.tweet_id === targetTweetId || 
                   tweet.retweeted?.id === targetTweetId ||
                   tweet.retweeted_status_id_str === targetTweetId) {
          engagementType = "retweet";
        } else if (tweet.quoted?.tweet_id === targetTweetId || 
                   tweet.quoted_status_id_str === targetTweetId) {
          engagementType = "quote_repost";
        }
      }

      // CRITICAL: If no engagement type identified, skip this tweet
      if (!engagementType) {
        console.log(`[fetch-raid-engagements] Skipping tweet (could not determine engagement type):`, {
          tweet_id: tweet.tweet_id || tweet.id,
          author: authorUsername,
          _engagement_type: tweet._engagement_type,
        });
        continue;
      }

      // Add detailed logging
      console.log(`[fetch-raid-engagements] ✅ Processing ${engagementType} engagement:`, {
        tweet_id: tweet.tweet_id || tweet.id,
        author: authorUsername,
        engagement_type: engagementType,
        target_tweet_id: targetTweetId,
      });

      // Calculate points
      const basePoints = calculateBasePoints(engagementType);
      const engagementBonusPoints = calculateEngagementBonusPoints(
        tweet,
        engagementType
      );

      // Handle different field names from API
      const tweetId = tweet.tweet_id || tweet.id || "";
      const screenName = tweet.author?.screen_name || tweet.screen_name || authorUsername;
      const tweetUrl = tweetId && screenName 
        ? `https://x.com/${screenName}/status/${tweetId}`
        : "";

      const engagement = {
        contest_id: contestId,
        creator_id: creatorId,
        tweet_id: tweetId,
        tweet_url: tweetUrl,
        twitter_username: screenName,
        tweet_text: tweet.text || tweet.full_text || "",
        tweet_created_at: new Date(tweet.created_at || tweet.created_at_iso || new Date()).toISOString(),
        tweet_type: engagementType === "comment" ? "reply" : engagementType === "quote_repost" ? "quote" : engagementType,
        target_tweet_id: targetTweetId, // Mark as raid engagement
        is_eligible: true,
        eligibility_reason: `Raid engagement: ${engagementType} on target tweet`,
        filter_status: "eligible",
        likes: tweet.likes || tweet.favorites || tweet.favorite_count || 0,
        replies: tweet.replies || tweet.reply_count || 0,
        retweets: tweet.retweets || tweet.retweet_count || 0,
        quote_reposts: tweet.quotes || tweet.quote_count || 0,
        impressions: parseInt(tweet.views || tweet.view_count || "0", 10),
        points: Math.round(basePoints + engagementBonusPoints), // Round to integer
        points_calculated_at: new Date().toISOString(),
      };

      engagements.push(engagement);
    }

    // Add summary logging
    console.log(`[fetch-raid-engagements] Summary:`, {
      totalTimelineTweets: timeline.length,
      validEngagementsFound: engagements.length,
      engagementsByType: {
        comments: engagements.filter(e => e.tweet_type === "reply").length,
        retweets: engagements.filter(e => e.tweet_type === "retweet").length,
        quoteReposts: engagements.filter(e => e.tweet_type === "quote").length,
      },
    });

    // 8. Upsert engagements to twitter_campaign_tweets table
    if (engagements.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from("twitter_campaign_tweets")
        .upsert(engagements, {
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
      }
    }

    // 9. Calculate total_* metrics from all participant engagements
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

    // 10. Update leaderboard with raid engagement points
    await updateRaidLeaderboard(contestId, supabaseAdmin);

    // 11. Update total_* metrics and total_filtered_tweets in metrics table
    const { count: filteredTweetsCount } = await supabaseAdmin
      .from("twitter_campaign_tweets")
      .select("*", { count: "exact", head: true })
      .eq("contest_id", contestId)
      .eq("is_eligible", true)
      .not("target_tweet_id", "is", null); // Only raid engagements

    await supabaseAdmin
      .from("twitter_campaign_metrics")
      .update({
        total_filtered_tweets: filteredTweetsCount || 0,
        total_likes: totalLikes,
        total_replies: totalReplies,
        total_retweets: totalRetweets,
        total_quote_reposts: totalQuoteReposts,
        total_impressions: totalImpressions,
        total_points: totalPoints,
        last_updated_at: new Date().toISOString(),
      })
      .eq("contest_id", contestId);

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
  engagementType: "comment" | "retweet" | "quote_repost"
): number {
  const pointsConfig = {
    comment: RAID_POINTS_CONFIG.comment_base_points,
    retweet: RAID_POINTS_CONFIG.retweet_base_points,
    quote_repost: RAID_POINTS_CONFIG.quote_repost_base_points,
  };
  return pointsConfig[engagementType] || 0;
}

// Helper function to calculate bonus points from engagement metrics
// This rewards creators for the engagement their engagement receives
function calculateEngagementBonusPoints(
  tweet: any,
  engagementType: "comment" | "retweet" | "quote_repost"
): number {
  // Handle different field names from API
  const likes = tweet.likes || tweet.favorites || tweet.favorite_count || 0;
  const replies = tweet.replies || tweet.reply_count || 0;
  const impressions = parseInt(tweet.views || tweet.view_count || "0", 10);
  const retweets = tweet.retweets || tweet.retweet_count || 0;
  const quotes = tweet.quotes || tweet.quote_count || 0;
  // const bookmarks = tweet.bookmarks || tweet.bookmark_count || 0; // If available in future

  if (engagementType === "comment") {
    // Comments can receive likes, replies, and impressions
    return (
      likes * RAID_POINTS_CONFIG.comment_likes_multiplier +
      replies * RAID_POINTS_CONFIG.comment_replies_multiplier +
      impressions * RAID_POINTS_CONFIG.comment_impressions_multiplier
      // + bookmarks * RAID_POINTS_CONFIG.comment_bookmarks_multiplier
    );
  } else if (engagementType === "retweet") {
    // Retweets can receive likes, replies, impressions, and chain retweets
    return (
      likes * RAID_POINTS_CONFIG.retweet_likes_multiplier +
      replies * RAID_POINTS_CONFIG.retweet_replies_multiplier +
      impressions * RAID_POINTS_CONFIG.retweet_impressions_multiplier +
      retweets * RAID_POINTS_CONFIG.retweet_retweets_multiplier
      // + bookmarks * RAID_POINTS_CONFIG.retweet_bookmarks_multiplier
    );
  } else if (engagementType === "quote_repost") {
    // Quote reposts can receive likes, replies, impressions, retweets, and quote reposts
    return (
      likes * RAID_POINTS_CONFIG.quote_repost_likes_multiplier +
      replies * RAID_POINTS_CONFIG.quote_repost_replies_multiplier +
      impressions * RAID_POINTS_CONFIG.quote_repost_impressions_multiplier +
      retweets * RAID_POINTS_CONFIG.quote_repost_retweets_multiplier +
      quotes * RAID_POINTS_CONFIG.quote_repost_quote_reposts_multiplier
      // + bookmarks * RAID_POINTS_CONFIG.quote_repost_bookmarks_multiplier
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
    .select("creator_id, points, likes, replies, retweets, quote_reposts, impressions, moderation_status, manual_points_adjustment")
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
  const raidDataByCreator = new Map<string, {
    points: number;
    likes: number;
    replies: number;
    retweets: number;
    quoteReposts: number;
    impressions: number;
    tweetCount: number;
  }>();

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
      .select("creator_id, total_points, total_eligible_tweets, total_likes, total_replies, total_retweets, total_quote_reposts, total_impressions, manual_points_adjustment")
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
    .select("creator_id, points, likes, replies, retweets, quote_reposts, impressions, moderation_status, manual_points_adjustment")
    .eq("contest_id", contestId)
    .eq("is_eligible", true)
    .is("target_tweet_id", null);

  const regularDataByCreator = new Map<string, {
    points: number;
    likes: number;
    replies: number;
    retweets: number;
    quoteReposts: number;
    impressions: number;
    tweetCount: number;
  }>();

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
    const existingEntry = existingLeaderboard?.find((e: any) => e.creator_id === creatorId);
    const leaderboardManualAdjustment = existingEntry?.manual_points_adjustment || 0;

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

