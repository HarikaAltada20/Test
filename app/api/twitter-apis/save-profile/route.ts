import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const twitterProfile = body?.twitterProfile;

    if (!twitterProfile || typeof twitterProfile !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid twitterProfile payload" },
        { status: 400 }
      );
    }

    // Minimal required fields we care about from the fetched profile
    const twitterAccountData = {
      username: twitterProfile.profile ?? null,
      name: twitterProfile.name ?? null,
      verified: twitterProfile.blue_verified ?? false,
      profile_picture_url: twitterProfile.avatar ?? null,
      bio: twitterProfile.desc ?? null,
      media_count: twitterProfile.media_count ?? null,
      tweet_count: twitterProfile.statuses_count ?? null,
      following_count: twitterProfile.friends_count ?? null,
      followers_count: twitterProfile.sub_count ?? null,
      twitter_id: twitterProfile.rest_id ?? null,
      account_created_at: twitterProfile.created_at ?? "",
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("creator_profiles")
      .update({ twitter_account: twitterAccountData })
      .eq("id", user.id);

    if (updateError) {
      console.error(
        "Error saving Twitter account to creator_profiles:",
        updateError
      );
      return NextResponse.json(
        { error: "Failed to save Twitter profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Unexpected error in twitter save-profile API:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
