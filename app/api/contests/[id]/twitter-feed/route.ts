import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// IMPORTANT: This endpoint ONLY reads from database - NO Twitter API calls
// Twitter API calls are ONLY made via twitter-refresh-tweets endpoint
// This saves API calls - data is only fetched when refresh buttons are clicked
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contestId } = await params;

    if (!contestId) {
      return NextResponse.json(
        { error: "Contest ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const url = new URL(req.url);
    const creatorId = url.searchParams.get("creatorId"); // Optional filter by creator
    const page = Number(url.searchParams.get("page") ?? 1);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 50;
    const offset = (safePage - 1) * safeLimit;

    // First, fetch participants to get join dates
    const { data: participants, error: participantsError } = await supabase
      .from("twitter_campaign_participants")
      .select("creator_id, joined_at")
      .eq("contest_id", contestId)
      .eq("is_active", true);

    if (participantsError) {
      console.error(
        "[twitter-feed] Error fetching participants",
        participantsError
      );
    }

    // Create a map of creator_id -> joined_at
    const joinDateMap = new Map<string, Date>();
    if (participants) {
      participants.forEach((p: any) => {
        if (p.creator_id && p.joined_at) {
          joinDateMap.set(p.creator_id, new Date(p.joined_at));
        }
      });
    }

    // Build query for eligible tweets from database only
    // Use * for main table to get all columns (including all metrics), then join creator
    let query = supabase
      .from("twitter_campaign_tweets")
      .select(
        `
        *,
        creator:users!twitter_campaign_tweets_creator_id_fkey(id, username, full_name, profile_picture_url)
      `,
        { count: "exact" }
      )
      .eq("contest_id", contestId)
      .eq("is_eligible", true)
      .is("deleted_at", null)
      .order("tweet_created_at", { ascending: false });

    // Filter by creator if specified
    if (creatorId) {
      query = query.eq("creator_id", creatorId);
    }

    const { data: tweets, error, count } = await query;

    if (error) {
      console.error("[twitter-feed] Error fetching tweets", {
        error,
        contestId,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
      });
      return NextResponse.json(
        {
          error: "Failed to fetch tweets",
          details: error.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    // Filter tweets to only include those created on or after join date
    const filteredTweets = (tweets || []).filter((tweet: any) => {
      const joinDate = joinDateMap.get(tweet.creator_id);
      if (!joinDate) {
        // If creator is not in participants (shouldn't happen), exclude
        return false;
      }

      const tweetCreatedAt = new Date(tweet.tweet_created_at);

      // Only include tweets created on or after the join date
      return tweetCreatedAt >= joinDate;
    });

    // Apply pagination after filtering
    const paginatedTweets = filteredTweets.slice(offset, offset + safeLimit);

    // Also get list of creators who have tweets for the sidebar
    // We need to apply the same join date filter here
    const { data: creatorsData, error: creatorsError } = await supabase
      .from("twitter_campaign_tweets")
      .select(
        `
        creator_id,
        tweet_created_at,
        creator:users!twitter_campaign_tweets_creator_id_fkey(id, username, full_name, profile_picture_url)
      `
      )
      .eq("contest_id", contestId)
      .eq("is_eligible", true)
      .is("deleted_at", null);

    if (creatorsError) {
      console.error("[twitter-feed] Error fetching creators", creatorsError);
    }

    // Get unique creators with tweet counts (only counting tweets after join date)
    const creatorMap = new Map();
    if (creatorsData) {
      for (const item of creatorsData as any[]) {
        const joinDate = joinDateMap.get(item.creator_id);
        if (!joinDate) {
          continue; // Skip if creator is not in participants
        }

        const tweetCreatedAt = new Date(item.tweet_created_at);

        // Only count tweets created on or after join date
        if (tweetCreatedAt < joinDate) {
          continue;
        }

        const creatorId = item.creator_id;
        const creator = item.creator;
        if (creatorId && creator) {
          if (!creatorMap.has(creatorId)) {
            creatorMap.set(creatorId, {
              id: creatorId,
              username: creator.username,
              full_name: creator.full_name,
              profile_picture_url: creator.profile_picture_url,
              tweetCount: 0,
            });
          }
          creatorMap.get(creatorId).tweetCount += 1;
        }
      }
    }

    const creators = Array.from(creatorMap.values()).sort(
      (a, b) => (b.tweetCount || 0) - (a.tweetCount || 0)
    );

    // Use filtered count for pagination
    const totalEntries = filteredTweets.length;
    const totalPages = safeLimit > 0 ? Math.ceil(totalEntries / safeLimit) : 1;

    return NextResponse.json({
      success: true,
      tweets: paginatedTweets || [],
      creators,
      currentPage: safePage,
      totalPages,
      totalEntries,
    });
  } catch (error: any) {
    console.error("[twitter-feed] Unexpected error", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
