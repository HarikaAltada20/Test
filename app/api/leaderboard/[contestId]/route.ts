import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic"; // Force dynamic rendering

/** Build creator display fields from user + creator_profile (shared logic) */
function buildCreatorDisplay(creatorProfile: any, userProfile: any, platform: string | null) {
  let creator_pfp_url: string | null = null;
  let creator_display_name: string | null = null;
  let creator_username: string | null = null;
  if (creatorProfile && platform) {
    try {
      if (platform === "youtube") {
        const ytAccount =
          typeof creatorProfile.youtube_account === "string"
            ? JSON.parse(creatorProfile.youtube_account)
            : creatorProfile.youtube_account;
        creator_display_name = ytAccount?.channel_title ?? null;
        creator_username =
          (ytAccount?.channel_custom_url || ytAccount?.channel_id) ?? null;
        creator_pfp_url = ytAccount?.channel_thumbnail ?? null;
      } else if (platform === "instagram") {
        const igAccount =
          typeof creatorProfile.instagram_account === "string"
            ? JSON.parse(creatorProfile.instagram_account)
            : creatorProfile.instagram_account;
        creator_display_name =
          (igAccount?.name_of_account ||
            igAccount?.full_name ||
            igAccount?.display_name) ?? null;
        creator_username = igAccount?.username ?? null;
        creator_pfp_url = igAccount?.profile_picture_url ?? null;
      }
    } catch (_) {}
  }
  if (!creator_display_name)
    creator_display_name =
      userProfile?.full_name || userProfile?.username || "Unknown Creator";
  if (!creator_username) creator_username = userProfile?.username || "N/A";
  if (!creator_pfp_url) creator_pfp_url = userProfile?.profile_picture_url ?? null;
  return { creator_pfp_url, creator_display_name, creator_username };
}

const CREATOR_WISE_CHUNK_SIZE = 200; // submissions per chunk to bound memory
const CREATOR_ID_BATCH_SIZE = 500;   // for counting distinct creators

type CreatorAgg = {
  creator_id: string;
  total_views: number;
  total_earnings: number;
  submission_count: number;
  submission_ranks: number[];
  best_rank: number;
  has_paid_submission: boolean;
  platform: string | null;
};

/**
 * Get total distinct creator count for contest (scalable: fetches only creator_id in chunks).
 */
async function getTotalCreatorCount(
  supabase: SupabaseClient,
  contestId: string
): Promise<number> {
  const creatorIds: string[] = [];
  let offset = 0;
  while (true) {
    const { data: batch, error } = await supabase
      .from("submissions")
      .select("creator_id")
      .eq("contest_id", contestId)
      .neq("status", "rejected")
      .order("id", { ascending: true })
      .range(offset, offset + CREATOR_ID_BATCH_SIZE - 1);

    if (error) throw new Error(`Failed to fetch creator count: ${error.message}`);
    if (!batch?.length) break;
    creatorIds.push(...batch.map((r) => r.creator_id));
    if (batch.length < CREATOR_ID_BATCH_SIZE) break;
    offset += CREATOR_ID_BATCH_SIZE;
  }
  return new Set(creatorIds).size;
}

/**
 * Fetch leaderboard aggregated by creator. Fetches all submissions in chunks,
 * aggregates by creator (total_views, etc.), then sorts by total_views descending
 * (highest to lowest) so the opportunities/creator-wise view shows ranking by views.
 * Submissions per creator are not embedded; client uses expand API to load them.
 */
async function getLeaderboardGroupedByCreator(
  supabase: SupabaseClient,
  contestId: string,
  page: number,
  limit: number
) {
  const from = (page - 1) * limit;
  const byCreator = new Map<string, CreatorAgg>();
  let globalOffset = 0;
  const baseQuery = supabase
    .from("submissions")
    .select("id, creator_id, views, earnings, status, created_at, platform")
    .eq("contest_id", contestId)
    .neq("status", "rejected")
    .order("views", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true });

  // Fetch all submission chunks so we have correct total_views per creator, then sort by total_views
  while (true) {
    const { data: chunk, error: subError } = await baseQuery.range(
      globalOffset,
      globalOffset + CREATOR_WISE_CHUNK_SIZE - 1
    );

    if (subError) {
      console.error("Error fetching submissions for creator-wise:", subError);
      throw new Error(`Failed to fetch submissions: ${subError.message}`);
    }
    if (!chunk?.length) break;

    chunk.forEach((sub, i) => {
      const rank = globalOffset + i + 1;
      const existing = byCreator.get(sub.creator_id);
      if (existing) {
        existing.total_views += sub.views ?? 0;
        existing.total_earnings += sub.earnings ?? 0;
        existing.submission_count += 1;
        existing.submission_ranks.push(rank);
        existing.best_rank = Math.min(existing.best_rank, rank);
        if (sub.status === "paid") existing.has_paid_submission = true;
      } else {
        byCreator.set(sub.creator_id, {
          creator_id: sub.creator_id,
          total_views: sub.views ?? 0,
          total_earnings: sub.earnings ?? 0,
          submission_count: 1,
          submission_ranks: [rank],
          best_rank: rank,
          has_paid_submission: sub.status === "paid",
          platform: sub.platform ?? null,
        });
      }
    });

    if (chunk.length < CREATOR_WISE_CHUNK_SIZE) break;
    globalOffset += chunk.length;
  }

  // Rank creators by total views (highest to lowest); tiebreak by best_rank (best single submission)
  const sortedCreators = Array.from(byCreator.values()).sort((a, b) => {
    if (b.total_views !== a.total_views) return b.total_views - a.total_views;
    return a.best_rank - b.best_rank;
  });
  const totalEntries = await getTotalCreatorCount(supabase, contestId);
  const totalPages = totalEntries ? Math.ceil(totalEntries / limit) : 0;
  const pageCreators = sortedCreators.slice(from, from + limit);
  const creatorIds = pageCreators.map((c) => c.creator_id);

  if (creatorIds.length === 0) {
    return {
      leaderboard: [],
      currentPage: page,
      totalPages,
      totalEntries,
    };
  }

  const { data: usersData, error: usersError } = await supabase
    .from("users")
    .select("id, username, profile_picture_url, full_name")
    .in("id", creatorIds);

  if (usersError) console.error("Error fetching users for creator-wise:", usersError);

  const { data: creatorProfilesData, error: profilesError } = await supabase
    .from("creator_profiles")
    .select("id, youtube_account, instagram_account")
    .in("id", creatorIds);

  if (profilesError) console.error("Error fetching creator profiles:", profilesError);

  const usersMap = new Map(usersData?.map((u) => [u.id, u]) || []);
  const profilesMap = new Map(
    creatorProfilesData?.map((p) => [p.id, p]) || []
  );

  const leaderboard = pageCreators.map((agg, index) => {
    const userProfile = usersMap.get(agg.creator_id) || null;
    const creatorProfile = profilesMap.get(agg.creator_id) || null;
    const { creator_pfp_url, creator_display_name, creator_username } =
      buildCreatorDisplay(creatorProfile, userProfile, agg.platform);
    const best_rank = from + index + 1;
    return {
      creator_id: agg.creator_id,
      creator_username: creator_username ?? "N/A",
      creator_full_name: creator_display_name ?? "Unknown Creator",
      creator_pfp_url,
      user_platform_pfp_url: userProfile?.profile_picture_url ?? null,
      user_platform_username: userProfile?.username ?? "N/A",
      user_full_name: userProfile?.full_name ?? "Anonymous User",
      total_views: agg.total_views,
      total_earnings: agg.total_earnings,
      submission_count: agg.submission_count,
      best_rank,
      submission_ranks: agg.submission_ranks,
      has_paid_submission: agg.has_paid_submission,
      submissions: [], // client fetches via /api/leaderboard/.../creators/[creatorId]/submissions when expanding
    };
  });

  return {
    leaderboard,
    currentPage: page,
    totalPages,
    totalEntries,
  };
}

// Revalidate data every 60 seconds
export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const pathSegments = url.pathname.split("/");
  const contestId = pathSegments[pathSegments.length - 1];

  // Pagination parameters
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "25", 10); // Default limit to 25
  const groupBy = url.searchParams.get("groupBy") || ""; // "creator" = aggregate by creator (combined views across all submissions)
  const from = (page - 1) * limit;
  const to = page * limit - 1;

  if (!contestId) {
    return NextResponse.json(
      { error: "Contest ID is required" },
      { status: 400 }
    );
  }

  try {
    // 1. First fetch contest details to determine contest type and verification rules
    const { data: contestData, error: contestError } = await supabase
      .from("contests")
      .select("id, contest_type, contest_based_details")
      .eq("id", contestId)
      .single();

    if (contestError) {
      console.error("Error fetching contest details:", contestError);
      throw new Error(
        `Failed to fetch contest details: ${contestError.message}`
      );
    }

    if (!contestData) {
      throw new Error("Contest not found");
    }

    // --- Creator-wise: aggregate by creator (combined views across ALL submissions), paginate by creator ---
    if (groupBy === "creator") {
      const creatorWiseResult = await getLeaderboardGroupedByCreator(
        supabase,
        contestId,
        page,
        limit
      );
      return NextResponse.json({
        ...creatorWiseResult,
        lastUpdated: new Date().toISOString(),
        contestType: contestData.contest_type,
        groupBy: "creator",
      });
    }

    // 2. Fetch total count of submissions for the contest
    // Exclude rejected submissions from public leaderboard counts for all contest types
    let countQuery = supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("contest_id", contestId);

    // Exclude rejected for both leaderboard and CPM contests
    countQuery = countQuery.neq("status", "rejected");

    const { count: totalEntries, error: countError } = await countQuery;

    if (countError) {
      console.error("Error fetching submission count:", countError);
      throw new Error(
        `Failed to fetch submission count: ${countError.message}`
      );
    }

    const totalPages = totalEntries ? Math.ceil(totalEntries / limit) : 0;

    // 3. Fetch paginated submissions for the contest
    let submissionsQuery = supabase
      .from("submissions")
      .select(
        `
        id,
        creator_id,
        video_title,
        video_thumbnail_url,
        views,
        earnings,
        status,
        created_at,
        content_link,
        platform
      `
      )
      .eq("contest_id", contestId);

    // Exclude rejected submissions for all contest types on public leaderboard
    submissionsQuery = submissionsQuery.neq("status", "rejected");

    const { data: submissions, error: submissionsError } =
      await submissionsQuery
        .order("views", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: true })
        .range(from, to);

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError);
      throw new Error(
        `Failed to fetch submissions: ${submissionsError.message}`
      );
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({
        leaderboard: [],
        lastUpdated: new Date().toISOString(),
        currentPage: page,
        totalPages: totalPages,
        totalEntries: totalEntries || 0,
        contestType: contestData.contest_type, // Include contest type for frontend
      });
    }

    // 4. Extract unique creator IDs from the current page of submissions
    const creatorIds = [...new Set(submissions.map((sub) => sub.creator_id))];

    // 5. Fetch corresponding user profiles from the 'users' table
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("id, username, profile_picture_url, full_name")
      .in("id", creatorIds);

    if (usersError) {
      console.error("Error fetching users data:", usersError);
    }

    // 6. Fetch corresponding creator profiles from 'creator_profiles'
    const { data: creatorProfilesData, error: creatorProfilesError } =
      await supabase
        .from("creator_profiles")
        .select("id, youtube_account, instagram_account")
        .in("id", creatorIds);

    if (creatorProfilesError) {
      console.error(
        "Error fetching creator profiles data:",
        creatorProfilesError
      );
    }

    // 7. Create lookup maps
    const usersMap = new Map(usersData?.map((user) => [user.id, user]) || []);
    const creatorProfilesMap = new Map(
      creatorProfilesData?.map((profile) => [profile.id, profile]) || []
    );

    // 8. Combine submissions with user and creator profile data
    // Rank = global position (1-based) among non-rejected, same as contest/brand side for correct Winning Zone
    const leaderboardData = submissions.map((submission, index) => {
      const userProfile = usersMap.get(submission.creator_id) || null;
      const creatorProfile =
        creatorProfilesMap.get(submission.creator_id) || null;
      let creator_pfp_url = null;
      let creator_display_name = null;
      let creator_username = null;

      if (creatorProfile && submission.platform) {
        try {
          if (submission.platform === "youtube") {
            const ytAccount =
              typeof creatorProfile.youtube_account === "string"
                ? JSON.parse(creatorProfile.youtube_account)
                : creatorProfile.youtube_account;
            creator_display_name = ytAccount?.channel_title;
            creator_username =
              ytAccount?.channel_custom_url || ytAccount?.channel_id;
            creator_pfp_url = ytAccount?.channel_thumbnail || null;
          } else if (submission.platform === "instagram") {
            const igAccount =
              typeof creatorProfile.instagram_account === "string"
                ? JSON.parse(creatorProfile.instagram_account)
                : creatorProfile.instagram_account;
            creator_display_name =
              igAccount?.name_of_account ||
              igAccount?.full_name ||
              igAccount?.display_name;
            creator_username = igAccount?.username;
            creator_pfp_url = igAccount?.profile_picture_url || null;
          }
        } catch (e) {
          console.error("Error parsing social account JSON:", e);
        }
      }

      // Fallbacks
      if (!creator_display_name)
        creator_display_name =
          userProfile?.full_name || userProfile?.username || "Unknown Creator";
      if (!creator_username) creator_username = userProfile?.username || "N/A";
      if (!creator_pfp_url)
        creator_pfp_url = userProfile?.profile_picture_url || null;

      const rank = from + index + 1;

      return {
        ...submission,
        rank,
        creator_display_name,
        creator_username,
        creator_avatar_url: creator_pfp_url,
        user_platform_username: userProfile?.username || "N/A",
        user_full_name: userProfile?.full_name || "Anonymous User",
        creator_pfp_url: creator_pfp_url,
        user_platform_pfp_url: userProfile?.profile_picture_url || null,
      };
    });

    // 9. Return the combined data with pagination info
    return NextResponse.json({
      leaderboard: leaderboardData,
      lastUpdated: new Date().toISOString(),
      currentPage: page,
      totalPages: totalPages,
      totalEntries: totalEntries || 0,
      contestType: contestData.contest_type, // Include contest type for frontend
    });
  } catch (error: any) {
    console.error("Error in leaderboard endpoint:", error);
    return NextResponse.json(
      {
        error: `Failed to fetch leaderboard: ${
          error.message || "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
