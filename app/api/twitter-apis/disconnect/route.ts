import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { appendDisconnectSnapshotSimple } from "@/lib/platform-social-archive";

export const dynamic = "force-dynamic";

/** Legacy route — delegates to same archive behavior as POST /api/creator/social-disconnect */
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

    const { data: profile, error: profileError } = await supabase
      .from("creator_profiles")
      .select("twitter_account, twitter_archive")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Creator profile not found" },
        { status: 404 }
      );
    }

    const live = profile.twitter_account as Record<string, unknown> | null;
    const mergedArchive = appendDisconnectSnapshotSimple(
      profile.twitter_archive,
      live ?? undefined
    );

    const { error: updateError } = await supabase
      .from("creator_profiles")
      .update({
        twitter_account: null,
        twitter_archive: mergedArchive as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error disconnecting Twitter account:", updateError);
      return NextResponse.json(
        { error: "Failed to disconnect Twitter account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("Unexpected error in twitter disconnect API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      { status: 500 }
    );
  }
}
