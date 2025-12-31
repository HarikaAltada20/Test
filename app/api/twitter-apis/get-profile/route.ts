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

    const { data: profile, error: profileError } = await supabase
      .from("creator_profiles")
      .select("twitter_account")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching creator_profiles.twitter_account:", profileError);
      return NextResponse.json(
        { error: "Failed to load Twitter account" },
        { status: 500 }
      );
    }

    const twitterAccount = profile?.twitter_account || null;

    return NextResponse.json(
      {
        success: true,
        twitterAccount,
        connected: !!twitterAccount,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Unexpected error in twitter get-profile API:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
