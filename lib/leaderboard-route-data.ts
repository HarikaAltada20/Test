import { createAdminClient } from "@/utils/supabase/admin";
import { getSortedCreatorAggregates } from "@/lib/leaderboard-creator-wise";
import type { SupabaseClient } from "@supabase/supabase-js";

function buildCreatorDisplay(
  creatorProfile: any,
  userProfile: any,
  platform: string | null,
) {
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
            igAccount?.display_name) ??
          null;
        creator_username = igAccount?.username ?? null;
        creator_pfp_url = igAccount?.profile_picture_url ?? null;
      } else if (platform === "tiktok") {
        const ttAccount =
          typeof creatorProfile.tiktok_account === "string"
            ? JSON.parse(creatorProfile.tiktok_account)
            : creatorProfile.tiktok_account;
        creator_display_name = ttAccount?.display_name ?? null;
        creator_username = ttAccount?.username ?? null;
        creator_pfp_url = ttAccount?.avatar_url ?? null;
      }
    } catch (_) {}
  }
  if (!creator_display_name)
    creator_display_name =
      userProfile?.full_name || userProfile?.username || "Unknown Creator";
  if (!creator_username) creator_username = userProfile?.username || "N/A";
  if (!creator_pfp_url)
    creator_pfp_url = userProfile?.profile_picture_url ?? null;
  return { creator_pfp_url, creator_display_name, creator_username };
}

async function getLeaderboardGroupedByCreator(
  supabase: SupabaseClient,
  contestId: string,
  page: number,
  limit: number,
) {
  const from = (page - 1) * limit;
  const sortedCreators = await getSortedCreatorAggregates(supabase, contestId);
  const totalEntries = sortedCreators.length;
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

  if (usersError)
    console.error("Error fetching users for creator-wise:", usersError);

  const { data: creatorProfilesData, error: profilesError } = await supabase
    .from("creator_profiles")
    .select("id, youtube_account, instagram_account, tiktok_account")
    .in("id", creatorIds);

  if (profilesError)
    console.error("Error fetching creator profiles:", profilesError);

  const usersMap = new Map(usersData?.map((u) => [u.id, u]) || []);
  const profilesMap = new Map(creatorProfilesData?.map((p) => [p.id, p]) || []);
  const creatorBonusPaidTotalMap = new Map<string, number>();
  const { data: creatorBonusRows, error: creatorBonusError } = await supabase
    .from("submissions")
    .select("creator_id, bonus_paid, bonus_paid_at, bonus_amount")
    .eq("contest_id", contestId)
    .in("creator_id", creatorIds);

  if (creatorBonusError) {
    console.error(
      "Error fetching creator bonus paid totals for creator-wise:",
      creatorBonusError,
    );
  } else {
    for (const row of creatorBonusRows || []) {
      const explicitBonusAmount = (row as any)?.bonus_amount;
      const hasBonusPaid =
        (row as any)?.bonus_paid === true ||
        Boolean((row as any)?.bonus_paid_at) ||
        (explicitBonusAmount != null && Number(explicitBonusAmount) > 0);
      if (!hasBonusPaid) continue;
      const current = creatorBonusPaidTotalMap.get((row as any).creator_id) || 0;
      const amount =
        explicitBonusAmount != null && Number(explicitBonusAmount) > 0
          ? Number(explicitBonusAmount)
          : 0;
      creatorBonusPaidTotalMap.set((row as any).creator_id, current + amount);
    }
  }

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
      creator_bonus_paid_total:
        creatorBonusPaidTotalMap.get(agg.creator_id) ?? 0,
      submissions: [],
    };
  });

  return {
    leaderboard,
    currentPage: page,
    totalPages,
    totalEntries,
  };
}

export type LeaderboardFetchParams = {
  contestId: string;
  page: number;
  limit: number;
  groupBy: string;
};

/**
 * Builds the JSON payload for GET /api/leaderboard/[contestId] (used with unstable_cache).
 * Uses the service-role client (no cookies) because Next.js forbids `cookies()` inside `unstable_cache`.
 */
export async function fetchLeaderboardPayload(
  params: LeaderboardFetchParams,
): Promise<Record<string, unknown>> {
  const { contestId, page, limit, groupBy } = params;
  const from = (page - 1) * limit;
  const to = page * limit - 1;

  const supabase = createAdminClient();

  const { data: contestData, error: contestError } = await supabase
    .from("contests")
    .select("id, contest_type, contest_based_details, moderation_status")
    .eq("id", contestId)
    .single();

  if (contestError) {
    console.error("Error fetching contest details:", contestError);
    throw new Error(`Failed to fetch contest details: ${contestError.message}`);
  }

  if (!contestData) {
    throw new Error("Contest not found");
  }

  if (
    (contestData as { moderation_status?: string }).moderation_status !==
    "published"
  ) {
    throw new Error("Contest not found");
  }

  if (groupBy === "creator") {
    const creatorWiseResult = await getLeaderboardGroupedByCreator(
      supabase,
      contestId,
      page,
      limit,
    );
    return {
      ...creatorWiseResult,
      lastUpdated: new Date().toISOString(),
      contestType: contestData.contest_type,
      groupBy: "creator",
    };
  }

  let countQuery = supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", contestId);

  countQuery = countQuery.neq("status", "rejected");

  const { count: totalEntries, error: countError } = await countQuery;

  if (countError) {
    console.error("Error fetching submission count:", countError);
    throw new Error(`Failed to fetch submission count: ${countError.message}`);
  }

  const totalPages = totalEntries ? Math.ceil(totalEntries / limit) : 0;

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
      `,
    )
    .eq("contest_id", contestId);

  submissionsQuery = submissionsQuery.neq("status", "rejected");

  const { data: submissions, error: submissionsError } = await submissionsQuery
    .order("views", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .range(from, to);

  if (submissionsError) {
    console.error("Error fetching submissions:", submissionsError);
    throw new Error(`Failed to fetch submissions: ${submissionsError.message}`);
  }

  if (!submissions || submissions.length === 0) {
    return {
      leaderboard: [],
      lastUpdated: new Date().toISOString(),
      currentPage: page,
      totalPages: totalPages,
      totalEntries: totalEntries || 0,
      contestType: contestData.contest_type,
    };
  }

  const creatorIds = [...new Set(submissions.map((sub) => sub.creator_id))];

  const { data: usersData, error: usersError } = await supabase
    .from("users")
    .select("id, username, profile_picture_url, full_name")
    .in("id", creatorIds);

  if (usersError) {
    console.error("Error fetching users data:", usersError);
  }

  const { data: creatorProfilesData, error: creatorProfilesError } =
    await supabase
      .from("creator_profiles")
      .select("id, youtube_account, instagram_account, tiktok_account")
      .in("id", creatorIds);

  if (creatorProfilesError) {
    console.error(
      "Error fetching creator profiles data:",
      creatorProfilesError,
    );
  }

  const usersMap = new Map(usersData?.map((user) => [user.id, user]) || []);
  const creatorProfilesMap = new Map(
    creatorProfilesData?.map((profile) => [profile.id, profile]) || [],
  );

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
        } else if (submission.platform === "tiktok") {
          const ttAccount =
            typeof creatorProfile.tiktok_account === "string"
              ? JSON.parse(creatorProfile.tiktok_account)
              : creatorProfile.tiktok_account;
          creator_display_name = ttAccount?.display_name;
          creator_username = ttAccount?.username;
          creator_pfp_url = ttAccount?.avatar_url || null;
        }
      } catch (e) {
        console.error("Error parsing social account JSON:", e);
      }
    }

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

  return {
    leaderboard: leaderboardData,
    lastUpdated: new Date().toISOString(),
    currentPage: page,
    totalPages: totalPages,
    totalEntries: totalEntries || 0,
    contestType: contestData.contest_type,
  };
}
