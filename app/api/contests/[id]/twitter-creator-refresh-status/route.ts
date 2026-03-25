import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { verifyAdminAccess } from "@/utils/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const creatorIdParam = url.searchParams.get("creatorId");
    const creatorId = creatorIdParam && creatorIdParam.trim() ? creatorIdParam.trim() : user.id;

    const { id: contestId } = await params;
    if (!contestId) {
      return NextResponse.json({ error: "Contest ID is required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { isAdmin } = await verifyAdminAccess();

    const { data: contest } = await supabaseAdmin
      .from("contests")
      .select("id, advertiser_id")
      .eq("id", contestId)
      .maybeSingle();

    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const isOwner = contest.advertiser_id === user.id;

    // Only allow looking at another creator's cooldown if the user is contest owner or admin.
    if (!isAdmin && !isOwner && creatorId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: leaderboardRow } = await supabaseAdmin
      .from("twitter_campaign_leaderboard")
      .select("last_refreshed_at, next_refresh_available_at")
      .eq("contest_id", contestId)
      .eq("creator_id", creatorId)
      .maybeSingle();

    const now = Date.now();
    const nextTs = leaderboardRow?.next_refresh_available_at
      ? new Date(leaderboardRow.next_refresh_available_at).getTime()
      : null;

    const canRefresh = nextTs === null ? true : now >= nextTs;
    const remainingMs = nextTs === null ? 0 : Math.max(0, nextTs - now);

    return NextResponse.json({
      contestId,
      creatorId,
      last_refreshed_at: leaderboardRow?.last_refreshed_at ?? null,
      next_refresh_available_at: leaderboardRow?.next_refresh_available_at ?? null,
      canRefresh,
      remainingMs,
    });
  } catch (error: any) {
    console.error("[twitter-creator-refresh-status] Unexpected error:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

