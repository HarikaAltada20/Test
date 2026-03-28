import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

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

    const body = await request.json().catch(() => null);
    const contestId = body?.contestId as string | undefined;

    if (!contestId) {
      return NextResponse.json(
        { error: "Missing contestId" },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS for contest lookup
    // Query from contests_with_status view to get computed status
    const adminSupabase = createAdminClient();
    const { data: contest, error: contestError } = await adminSupabase
      .from("contests_with_status")
      .select("id, platform, contest_format, moderation_status, status, contest_based_details")
      .eq("id", contestId)
      .maybeSingle();

    if (contestError || !contest) {
      console.error("Contest lookup error:", contestError);
      return NextResponse.json(
        { error: "Contest not found" },
        { status: 404 }
      );
    }

    const platform = (contest as any).platform;
    const contestFormat = (contest as any).contest_format;

    const isTwitterTextImage =
      platform === "twitter" && contestFormat === "text_image";

    if (
      !isTwitterTextImage ||
      (contest as any).moderation_status !== "published"
      // Optionally enforce status === 'active'
      // || (contest as any).status !== 'active'
    ) {
      return NextResponse.json(
        { error: "This contest is not a joinable Twitter campaign" },
        { status: 400 }
      );
    }

    // Check max_participants limit (excluding rejected creators)
    const twitterCampaign = (contest as any).contest_based_details?.twitter_campaign;
    const maxParticipants = twitterCampaign?.max_participants;
    
    if (maxParticipants && maxParticipants > 0) {
      // Get all active participants
      const { data: allParticipants } = await adminSupabase
        .from("twitter_campaign_participants")
        .select("creator_id")
        .eq("contest_id", contestId)
        .eq("is_active", true);

      // Get rejected creator IDs
      const allCreatorIds = (allParticipants || []).map((p) => p.creator_id);
      const { data: leaderboardData } = await adminSupabase
        .from("twitter_campaign_leaderboard")
        .select("creator_id, moderation_status")
        .eq("contest_id", contestId)
        .in("creator_id", allCreatorIds);

      const rejectedCreatorIdsSet = new Set(
        (leaderboardData || [])
          .filter((entry) => entry.moderation_status === "rejected")
          .map((entry) => entry.creator_id)
      );

      // Count only non-rejected participants
      const currentParticipantCount = (allParticipants || []).filter(
        (p) => !rejectedCreatorIdsSet.has(p.creator_id)
      ).length;

      // Check if user is already a participant (even if rejected)
      const isAlreadyParticipant = (allParticipants || []).some(
        (p) => p.creator_id === user.id
      );

      // If not already a participant and limit is reached, reject
      if (!isAlreadyParticipant && currentParticipantCount >= maxParticipants) {
        return NextResponse.json(
          {
            error: `This campaign has reached the maximum participant limit of ${maxParticipants}. Please try another campaign.`,
            code: "PARTICIPANT_LIMIT_REACHED",
          },
          { status: 400 }
        );
      }
    }

    // Use admin client to bypass RLS for creator_profiles lookup
    const { data: profile, error: profileError } = await adminSupabase
      .from("creator_profiles")
      .select("twitter_account")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Creator profile lookup error:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch creator profile" },
        { status: 500 }
      );
    }

    if (!profile) {
      console.error("No creator profile found for user:", user.id);
      return NextResponse.json(
        {
          error:
            "Creator profile not found. Please complete your profile setup.",
          code: "CREATOR_PROFILE_MISSING",
        },
        { status: 400 }
      );
    }

    const twitterAccount = (profile as any).twitter_account as any | null;

    if (!twitterAccount) {
      return NextResponse.json(
        {
          error:
            "Please connect your Twitter (X) account in Settings before joining this campaign.",
          code: "TWITTER_NOT_CONNECTED",
        },
        { status: 400 }
      );
    }

    const twitterUsername: string | undefined = twitterAccount.username;
    const bio: string = twitterAccount.bio || "";

    // Fetch the Game Of Creators username from users table
    const { data: userRow, error: userRowError } = await adminSupabase
      .from("users")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();

    if (userRowError) {
      console.error("User row lookup error while joining campaign:", userRowError);
      return NextResponse.json(
        { error: "Failed to fetch your profile information" },
        { status: 500 }
      );
    }

    const gocUsername: string = (userRow as any)?.username || "";

    if (!twitterUsername) {
      return NextResponse.json(
        {
          error:
            "Twitter username is missing from your connected account.",
          code: "TWITTER_USERNAME_MISSING",
        },
        { status: 400 }
      );
    }

    if (
      gocUsername &&
      !bio.toLowerCase().includes(gocUsername.toLowerCase())
    ) {
      return NextResponse.json(
        {
          error:
            "Please add your Game Of Creators username to your X bio before joining this campaign.",
          code: "BIO_USERNAME_MISSING",
        },
        { status: 400 }
      );
    }

    const { error: upsertError } = await supabase
      .from("twitter_campaign_participants")
      .upsert(
        {
          contest_id: contestId,
          creator_id: user.id,
          twitter_username: twitterUsername,
          is_active: true,
          joined_at: new Date().toISOString(),
        },
        {
          onConflict: "contest_id,creator_id",
        }
      );

    if (upsertError) {
      console.error(
        "Error upserting into twitter_campaign_participants:",
        upsertError
      );
      return NextResponse.json(
        { error: "Failed to join Twitter campaign" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Unexpected error in twitter join-campaign API:", error);
    return NextResponse.json(
      { error: error?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
