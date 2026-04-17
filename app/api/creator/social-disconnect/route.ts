import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  appendDisconnectSnapshotSimple,
  appendInstagramDisconnectAndClearAccount,
} from "@/lib/platform-social-archive";

export const dynamic = "force-dynamic";

type Platform = "instagram" | "youtube" | "twitter" | "tiktok";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const platform = body.platform as Platform | undefined;

    if (!platform || !["instagram", "youtube", "twitter", "tiktok"].includes(platform)) {
      return NextResponse.json(
        { error: "Invalid platform. Use instagram, youtube, twitter, or tiktok." },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("creator_profiles")
      .select(
        "instagram_account, youtube_account, twitter_account, tiktok_account, instagram_archive, youtube_archive, twitter_archive, tiktok_archive"
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Creator profile not found" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    if (platform === "instagram") {
      const live = profile.instagram_account as Record<string, unknown> | null;
      const mergedArchive = appendInstagramDisconnectAndClearAccount(
        profile.instagram_archive,
        live ?? undefined
      );
      const { error: upErr } = await supabase
        .from("creator_profiles")
        .update({
          instagram_account: null,
          instagram_archive: mergedArchive as unknown as Record<string, unknown>,
          updated_at: now,
        })
        .eq("id", user.id);

      if (upErr) {
        console.error("[social-disconnect] instagram update error:", upErr);
        return NextResponse.json(
          { error: "Failed to disconnect Instagram" },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (platform === "youtube") {
      const live = profile.youtube_account as Record<string, unknown> | null;
      const mergedArchive = appendDisconnectSnapshotSimple(
        profile.youtube_archive,
        live ?? undefined
      );
      const { error: upErr } = await supabase
        .from("creator_profiles")
        .update({
          youtube_account: null,
          youtube_archive: mergedArchive as unknown as Record<string, unknown>,
          updated_at: now,
        })
        .eq("id", user.id);

      if (upErr) {
        console.error("[social-disconnect] youtube update error:", upErr);
        return NextResponse.json(
          { error: "Failed to disconnect YouTube" },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (platform === "tiktok") {
      const live = profile.tiktok_account as Record<string, unknown> | null;
      const mergedArchive = appendDisconnectSnapshotSimple(
        profile.tiktok_archive,
        live ?? undefined
      );
      const { error: upErr } = await supabase
        .from("creator_profiles")
        .update({
          tiktok_account: null,
          tiktok_archive: mergedArchive as unknown as Record<string, unknown>,
          updated_at: now,
        })
        .eq("id", user.id);

      if (upErr) {
        console.error("[social-disconnect] tiktok update error:", upErr);
        return NextResponse.json(
          { error: "Failed to disconnect TikTok" },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }

    // twitter
    const live = profile.twitter_account as Record<string, unknown> | null;
    const mergedArchive = appendDisconnectSnapshotSimple(
      profile.twitter_archive,
      live ?? undefined
    );
    const { error: upErr } = await supabase
      .from("creator_profiles")
      .update({
        twitter_account: null,
        twitter_archive: mergedArchive as unknown as Record<string, unknown>,
        updated_at: now,
      })
      .eq("id", user.id);

    if (upErr) {
      console.error("[social-disconnect] twitter update error:", upErr);
      return NextResponse.json(
        { error: "Failed to disconnect Twitter" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[social-disconnect] unexpected:", e);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
