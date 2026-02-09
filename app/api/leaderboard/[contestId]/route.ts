import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // Force dynamic rendering

// Revalidate data every 60 seconds
export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const pathSegments = url.pathname.split("/");
  const contestId = pathSegments[pathSegments.length - 1];

  // Pagination parameters
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "25", 10); // Default limit to 25
  const from = (page - 1) * limit;
  const to = page * limit - 1;

  // console.log(`(Using Anon Client) Extracted contestId: ${contestId}, Page: ${page}, Limit: ${limit}, From: ${from}, To: ${to}`);

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

    // 3. Fetch ALL submissions (including rejected) ordered by views to compute rank.
    // Rank = position in full list so it matches brand side (rejected is rank 1, first non-rejected is rank 2, etc.)
    const { data: allOrdered, error: allOrderedError } = await supabase
      .from("submissions")
      .select("id")
      .eq("contest_id", contestId)
      .order("views", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (allOrderedError) {
      console.error("Error fetching ordered submissions:", allOrderedError);
      throw new Error(
        `Failed to fetch ordered submissions: ${allOrderedError.message}`
      );
    }

    const idToRank = new Map<string, number>();
    (allOrdered || []).forEach((row, index) => {
      idToRank.set(row.id, index + 1);
    });

    // 4. Fetch paginated non-rejected submissions for display
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
    // Rank = position in full list (including rejected) so Winning Zone matches brand side (e.g. first non-rejected gets 2nd prize if rank 1 is rejected)
    const leaderboardData = submissions.map((submission) => {
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

      const rank = idToRank.get(submission.id) ?? 0;

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
