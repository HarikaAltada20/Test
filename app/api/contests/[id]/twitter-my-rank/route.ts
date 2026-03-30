import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contestId } = await params;

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[twitter-my-rank] Auth error", authError);
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { data: participantRow } = await supabase
      .from("twitter_campaign_participants")
      .select("creator_id, twitter_username, joined_at")
      .eq("contest_id", contestId)
      .eq("creator_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    // Fetch leaderboard entry including moderation_status and rejection_reason
    // Note: We don't filter by moderation_status here so rejected entries are still visible to the user
    const { data, error } = await supabase
      .from("twitter_campaign_leaderboard")
      .select("*")
      .eq("contest_id", contestId)
      .eq("creator_id", user.id)
      .maybeSingle();

    if (error) {
      console.error(
        "[twitter-my-rank] Error fetching rank for user",
        user.id,
        "contest",
        contestId,
        error
      );
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const joinedAt =
      (participantRow as { joined_at?: string | null } | null)?.joined_at ??
      (data as { joined_at?: string | null } | null)?.joined_at ??
      null;

    // Fetch user profile data to include username and full_name
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, username, full_name, profile_picture_url")
      .eq("id", user.id)
      .maybeSingle();

    if (userError) {
      console.error(
        "[twitter-my-rank] Error fetching user profile data",
        userError
      );
    }

    const enrich = (entry: Record<string, unknown>) => ({
      ...entry,
      joined_at: joinedAt ?? (entry as { joined_at?: string | null }).joined_at ?? null,
      app_username: userData?.username || null,
      app_full_name: userData?.full_name || null,
      user_platform_pfp_url:
        (entry as { user_platform_pfp_url?: string | null })
          .user_platform_pfp_url ??
        userData?.profile_picture_url ??
        null,
      creator_pfp_url:
        (entry as { creator_pfp_url?: string | null }).creator_pfp_url ??
        userData?.profile_picture_url ??
        null,
    });

    if (data) {
      const enrichedEntry = enrich(data as Record<string, unknown>);
      return NextResponse.json({ success: true, entry: enrichedEntry });
    }

    if (participantRow) {
      const p = participantRow as {
        creator_id: string;
        twitter_username: string | null;
        joined_at: string | null;
      };
      const synthetic = enrich({
        id: `participant:${contestId}:${p.creator_id}`,
        contest_id: contestId,
        creator_id: p.creator_id,
        moderation_status: null,
        rejection_reason: null,
        current_rank: null,
        total_points: 0,
        manual_points_adjustment: 0,
        total_eligible_tweets: 0,
        total_likes: 0,
        total_replies: 0,
        total_retweets: 0,
        total_quote_reposts: 0,
        total_impressions: 0,
        paid: false,
        paid_at: null,
        joined_at: p.joined_at ?? null,
        twitter_username: p.twitter_username ?? null,
        created_at: p.joined_at ?? null,
        updated_at: null,
        user_platform_username: p.twitter_username ?? null,
      } as Record<string, unknown>);
      return NextResponse.json({ success: true, entry: synthetic });
    }

    return NextResponse.json({ success: true, entry: null });
  } catch (err: any) {
    console.error("[twitter-my-rank] Unexpected error", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
