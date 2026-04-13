import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contestId } = await params;

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? 1);
  const limit = Number(url.searchParams.get("limit") ?? 10);
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit =
    Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 10;
  const offset = (safePage - 1) * safeLimit;

  try {
    const supabase = await createClient();

    // 1) Fetch active participants (join list). We include participants even if they haven't earned points yet.
    // Anyone with a rejected leaderboard row is excluded from the merged "missing" list so they stay hidden.
    const { data: participants, error: participantsError } = await supabase
      .from("twitter_campaign_participants")
      .select("creator_id, twitter_username, joined_at")
      .eq("contest_id", contestId)
      .eq("is_active", true);

    if (participantsError) {
      console.error(
        "[twitter-leaderboard] Error fetching participants for contest",
        contestId,
        participantsError,
      );
      return NextResponse.json(
        { success: false, error: participantsError.message },
        { status: 500 },
      );
    }

    // 2) Fetch leaderboard rows (exclude rejected creators for opportunities leaderboard)
    // This matches YouTube/Instagram behavior - rejected entries don't show on public leaderboard.
    const { data: allLeaderboardRows, error } = await supabase
      .from("twitter_campaign_leaderboard")
      .select("*")
      .eq("contest_id", contestId)
      .neq("moderation_status", "rejected")
      .order("current_rank", { ascending: true });

    if (error) {
      console.error(
        "[twitter-leaderboard] Error fetching leaderboard for contest",
        contestId,
        error
      );
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const leaderboardRows = (allLeaderboardRows as any[]) ?? [];
    const leaderboardByCreatorId = new Map<string, any>();
    for (const row of leaderboardRows) {
      if (row?.creator_id) leaderboardByCreatorId.set(row.creator_id, row);
    }

    const { data: rejectedRows } = await supabase
      .from("twitter_campaign_leaderboard")
      .select("creator_id")
      .eq("contest_id", contestId)
      .eq("moderation_status", "rejected");
    const rejectedCreatorIds = new Set(
      (rejectedRows as any[] | null)
        ?.map((r) => r.creator_id)
        .filter(Boolean) ?? [],
    );

    // 3) Merge participants who don't have a leaderboard row yet (0 points / no tweets).
    // Omit anyone with a rejected leaderboard row so they don't reappear as a 0‑point joiner.
    const missingParticipants =
      (participants as any[] | null)?.filter(
        (p) =>
          p?.creator_id &&
          !leaderboardByCreatorId.has(p.creator_id) &&
          !rejectedCreatorIds.has(p.creator_id),
      ) ?? [];
    // Sort missing participants by join date (oldest first) for stable ordering.
    missingParticipants.sort((a, b) => {
      const aMs = a.joined_at ? new Date(a.joined_at).getTime() : 0;
      const bMs = b.joined_at ? new Date(b.joined_at).getTime() : 0;
      return aMs - bMs;
    });

    const merged = [...leaderboardRows];
    const baseRank = merged.length;
    for (let i = 0; i < missingParticipants.length; i++) {
      const p = missingParticipants[i];
      merged.push({
        id: `participant:${contestId}:${p.creator_id}`,
        contest_id: contestId,
        creator_id: p.creator_id,
        moderation_status: null,
        rejection_reason: null,
        current_rank: baseRank + i + 1,
        total_points: 0,
        manual_points_adjustment: 0,
        total_eligible_tweets: 0,
        total_likes: 0,
        total_replies: 0,
        total_retweets: 0,
        total_quote_reposts: 0,
        total_impressions: 0,
        paid_at: null,
        joined_at: p.joined_at ?? null,
        twitter_username: p.twitter_username ?? null,
        created_at: p.joined_at ?? null,
        updated_at: null,
      });
    }

    const totalEntries = merged.length;
    const totalPages = safeLimit > 0 ? Math.ceil(totalEntries / safeLimit) : 1;

    const paged = merged.slice(offset, offset + safeLimit);

    // If empty, return early
    if (paged.length === 0) {
      return NextResponse.json({
        success: true,
        contestId,
        leaderboard: [],
        currentPage: safePage,
        totalPages,
        totalEntries,
      });
    }

    // 4) Collect unique creator_ids for enrichment
    const creatorIds = Array.from(
      new Set(
        paged
          .map((row: any) => row.creator_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    // 5) Fetch usernames for these creators from users table
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("id, username, full_name, profile_picture_url")
      .in("id", creatorIds);

    if (usersError) {
      console.error(
        "[twitter-leaderboard] Error fetching users for creator_ids",
        usersError
      );
      // Not fatal: we still return leaderboard without enriched usernames
    }

    const userById = new Map<
      string,
      {
        username: string | null;
        full_name: string | null;
        profile_picture_url: string | null;
      }
    >();
    if (usersData) {
      for (const u of usersData as any[]) {
        userById.set(u.id as string, {
          username: (u.username as string) ?? null,
          full_name: (u.full_name as string) ?? null,
          profile_picture_url: (u.profile_picture_url as string) ?? null,
        });
      }
    }

    // 6) Attach app_username/app_full_name to each leaderboard row
    const enrichedLeaderboard = (paged as any[]).map((row) => {
      const info = userById.get(row.creator_id as string) || {
        username: null,
        full_name: null,
        profile_picture_url: null,
      };

      return {
        ...row,
        app_username: info.username,
        app_full_name: info.full_name,
        user_platform_pfp_url:
          row.user_platform_pfp_url ?? info.profile_picture_url ?? null,
        creator_pfp_url: row.creator_pfp_url ?? info.profile_picture_url ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      contestId,
      leaderboard: enrichedLeaderboard,
      currentPage: safePage,
      totalPages,
      totalEntries,
    });
  } catch (err: any) {
    console.error("[twitter-leaderboard] Unexpected error", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
