import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard/[contestId]/creators/[creatorId]/submissions
 * Returns all submissions for a single creator in the contest (for creator-wise expand).
 * Each submission includes global rank. Excludes rejected.
 * Scalable: fetches only this creator's rows and computes rank via count queries (no full contest load).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ contestId: string; creatorId: string }> },
) {
  const supabase = await createClient();
  const params = await context.params;
  const contestId = params?.contestId;
  const creatorId = params?.creatorId;

  if (!contestId || !creatorId) {
    return NextResponse.json(
      { error: "Contest ID and Creator ID are required" },
      { status: 400 },
    );
  }

  try {
    const { data: creatorSubmissions, error: subError } =
      await fetchContestSubmissionsAllPages(
        supabase,
        contestId,
        "id, creator_id, video_title, video_thumbnail_url, views, earnings, status, created_at, content_link, platform",
        {
          creatorId,
          statusNeq: "rejected",
          order: [
            { column: "views", ascending: false, nullsFirst: false },
            { column: "created_at", ascending: true },
          ],
        },
      );

    if (subError) {
      console.error("Error fetching creator submissions:", subError);
      throw new Error(
        `Failed to fetch submissions: ${String((subError as { message?: string })?.message ?? subError)}`,
      );
    }

    const subs = creatorSubmissions || [];
    if (subs.length === 0) {
      return NextResponse.json({ submissions: [] });
    }

    // Compute global rank per submission via count queries (scalable: no load-all)
    // Rank = 1 + (number of submissions strictly "ahead": views > this.views OR (views = this.views AND created_at < this.created_at))
    const rankBySubmissionId = new Map<string, number>();
    for (const sub of subs) {
      const v = sub.views;
      const t = sub.created_at;
      let q = supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("contest_id", contestId)
        .neq("status", "rejected");
      if (v === null || v === undefined) {
        q = q.not("views", "is", null);
      } else {
        const createdFilter =
          t != null ? `and(views.eq.${v},created_at.lt.${t})` : `views.eq.${v}`;
        q = q.or(`views.gt.${v},${createdFilter}`);
      }
      const { count, error: countErr } = await q;
      if (countErr) {
        console.error("Error counting rank for submission:", sub.id, countErr);
        rankBySubmissionId.set(String(sub.id), 0);
      } else {
        rankBySubmissionId.set(String(sub.id), (count ?? 0) + 1);
      }
    }

    // Fetch user and creator profile for display
    const { data: userData } = await supabase
      .from("users")
      .select("id, username, profile_picture_url, full_name")
      .eq("id", creatorId)
      .single();

    const { data: creatorProfile } = await supabase
      .from("creator_profiles")
      .select("id, youtube_account, instagram_account, tiktok_account")
      .eq("id", creatorId)
      .single();

    const platform = subs[0]?.platform ?? null;
    let creator_pfp_url: string | null = null;
    let creator_display_name: string | null = null;
    let creator_username: string | null = null;

    if (creatorProfile && platform) {
      try {
        if (platform === "youtube") {
          const yt =
            typeof creatorProfile.youtube_account === "string"
              ? JSON.parse(creatorProfile.youtube_account)
              : creatorProfile.youtube_account;
          creator_display_name = yt?.channel_title ?? null;
          creator_username = (yt?.channel_custom_url || yt?.channel_id) ?? null;
          creator_pfp_url = yt?.channel_thumbnail ?? null;
        } else if (platform === "instagram") {
          const ig =
            typeof creatorProfile.instagram_account === "string"
              ? JSON.parse(creatorProfile.instagram_account)
              : creatorProfile.instagram_account;
          creator_display_name =
            (ig?.name_of_account || ig?.full_name || ig?.display_name) ?? null;
          creator_username = ig?.username ?? null;
          creator_pfp_url = ig?.profile_picture_url ?? null;
        } else if (platform === "tiktok") {
          const tt =
            typeof (creatorProfile as any).tiktok_account === "string"
              ? JSON.parse((creatorProfile as any).tiktok_account)
              : (creatorProfile as any).tiktok_account;
          creator_display_name = tt?.display_name ?? null;
          creator_username = tt?.username ?? null;
          creator_pfp_url = tt?.avatar_url ?? null;
        }
      } catch (_) {}
    }
    if (!creator_display_name)
      creator_display_name =
        userData?.full_name || userData?.username || "Unknown Creator";
    if (!creator_username) creator_username = userData?.username || "N/A";
    if (!creator_pfp_url)
      creator_pfp_url = userData?.profile_picture_url ?? null;

    const submissions = subs.map((sub) => ({
      ...sub,
      rank: rankBySubmissionId.get(String(sub.id)),
      creator_display_name,
      creator_username,
      creator_avatar_url: creator_pfp_url,
      user_platform_username: userData?.username || "N/A",
      user_full_name: userData?.full_name || "Anonymous User",
      creator_pfp_url,
      user_platform_pfp_url: userData?.profile_picture_url ?? null,
    }));

    return NextResponse.json({ submissions });
  } catch (error: any) {
    console.error("Error in creator submissions endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch creator submissions" },
      { status: 500 },
    );
  }
}
