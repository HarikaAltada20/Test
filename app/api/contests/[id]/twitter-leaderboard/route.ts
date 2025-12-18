import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const contestId = params.id;

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? 1);
  const limit = Number(url.searchParams.get("limit") ?? 10);
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit =
    Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 10;
  const offset = (safePage - 1) * safeLimit;

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // 1) Fetch raw leaderboard rows
    const { data: leaderboardRows, error, count } = await supabase
      .from("twitter_campaign_leaderboard")
      .select("*", { count: "exact" })
      .eq("contest_id", contestId)
      .order("current_rank", { ascending: true })
      .range(offset, offset + safeLimit - 1);

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

    const totalEntries = count ?? 0;
    const totalPages = safeLimit > 0 ? Math.ceil(totalEntries / safeLimit) : 1;

    // If no rows, return early
    if (!leaderboardRows || leaderboardRows.length === 0) {
      return NextResponse.json({
        success: true,
        contestId,
        leaderboard: [],
        currentPage: safePage,
        totalPages,
        totalEntries,
      });
    }

    // 2) Collect unique creator_ids
    const creatorIds = Array.from(
      new Set(
        leaderboardRows
          .map((row: any) => row.creator_id as string | null)
          .filter((id): id is string => Boolean(id))
      )
    );

    // 3) Fetch usernames for these creators from users table
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("id, username, full_name")
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
      { username: string | null; full_name: string | null }
    >();
    if (usersData) {
      for (const u of usersData as any[]) {
        userById.set(u.id as string, {
          username: (u.username as string) ?? null,
          full_name: (u.full_name as string) ?? null,
        });
      }
    }

    // 4) Attach app_username/app_full_name to each leaderboard row
    const enrichedLeaderboard = (leaderboardRows as any[]).map((row) => {
      const info = userById.get(row.creator_id as string) || {
        username: null,
        full_name: null,
      };

      return {
        ...row,
        app_username: info.username,
        app_full_name: info.full_name,
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
