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

    return NextResponse.json({ success: true, entry: data });
  } catch (err: any) {
    console.error("[twitter-my-rank] Unexpected error", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
