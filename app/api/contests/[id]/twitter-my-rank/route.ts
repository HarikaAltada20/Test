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

    if (!data) {
      return NextResponse.json({ success: true, entry: null });
    }

    // Fetch user profile data to include username and full_name
    // This ensures rejected entries still show user details
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, username, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (userError) {
      console.error(
        "[twitter-my-rank] Error fetching user profile data",
        userError
      );
      // Not fatal: return entry without enriched username
    }

    // Enrich the entry with user profile data
    const enrichedEntry = {
      ...data,
      app_username: userData?.username || null,
      app_full_name: userData?.full_name || null,
    };

    return NextResponse.json({ success: true, entry: enrichedEntry });
  } catch (err: any) {
    console.error("[twitter-my-rank] Unexpected error", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
