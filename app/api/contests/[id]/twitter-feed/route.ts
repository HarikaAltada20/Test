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
    const safeLimit = Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 50;
    const offset = (safePage - 1) * safeLimit;

    // Build query for eligible tweets from database only
    let query = supabase
      .from("twitter_campaign_tweets")
      .select(`
        *,
        creator:users!twitter_campaign_tweets_creator_id_fkey(id, username, full_name, profile_picture_url)
      `, { count: "exact" })
      .eq("contest_id", contestId)
      .eq("is_eligible", true)
      .order("tweet_created_at", { ascending: false })
      .range(offset, offset + safeLimit - 1);

    // Filter by creator if specified
    if (creatorId) {
      query = query.eq("creator_id", creatorId);
    }

    const { data: tweets, error, count } = await query;

    if (error) {
      console.error("[twitter-feed] Error fetching tweets", error);
      return NextResponse.json(
        { error: "Failed to fetch tweets" },
        { status: 500 }
      );
    }

    // Also get list of creators who have tweets for the sidebar
    const { data: creatorsData, error: creatorsError } = await supabase
      .from("twitter_campaign_tweets")
      .select(`
        creator_id,
        creator:users!twitter_campaign_tweets_creator_id_fkey(id, username, full_name, profile_picture_url)
      `)
      .eq("contest_id", contestId)
      .eq("is_eligible", true);

    if (creatorsError) {
      console.error("[twitter-feed] Error fetching creators", creatorsError);
    }

    // Get unique creators with tweet counts
    const creatorMap = new Map();
    if (creatorsData) {
      for (const item of creatorsData as any[]) {
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

    const creators = Array.from(creatorMap.values()).sort((a, b) => 
      (b.tweetCount || 0) - (a.tweetCount || 0)
    );

    const totalEntries = count ?? 0;
    const totalPages = safeLimit > 0 ? Math.ceil(totalEntries / safeLimit) : 1;

    return NextResponse.json({
      success: true,
      tweets: tweets || [],
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
