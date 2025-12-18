import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contestId = searchParams.get("contestId");

    if (!contestId) {
      return NextResponse.json(
        { error: "Missing contestId" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("twitter_campaign_participants")
      .select("id, is_active")
      .eq("contest_id", contestId)
      .eq("creator_id", user.id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found for maybeSingle
      console.error("Error checking twitter_campaign_participants:", error);
      return NextResponse.json(
        { error: "Failed to check join status" },
        { status: 500 }
      );
    }

    const joined = !!data && data.is_active !== false;

    return NextResponse.json({ joined }, { status: 200 });
  } catch (error: any) {
    console.error("Unexpected error in twitter join-status API:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
