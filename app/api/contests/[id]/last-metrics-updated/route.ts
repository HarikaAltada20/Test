/**
 * GET: Return last_metrics_updated for a contest (for polling after queued refresh).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contestId } = await params;
    if (!contestId) {
      return NextResponse.json({ error: "Contest ID required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: contest, error } = await supabaseAdmin
      .from("contests")
      .select("id, last_metrics_updated, advertiser_id, platform")
      .eq("id", contestId)
      .maybeSingle();

    if (error || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const platform = (contest.platform ?? "").toString().toLowerCase();
    const allowAnyAuthenticated =
      platform === "instagram" || platform === "youtube";

    if (!allowAnyAuthenticated) {
      // Twitter and others: allow owner, admin, or participant only
      const isOwner = contest.advertiser_id === user.id;
      const { data: userData } = await supabase
        .from("users")
        .select("user_type")
        .eq("id", user.id)
        .single();
      const isAdmin = userData?.user_type === "admin";
      if (isOwner || isAdmin) {
        // allowed
      } else {
        const { data: participant } = await supabaseAdmin
          .from("twitter_campaign_participants")
          .select("creator_id")
          .eq("contest_id", contestId)
          .eq("creator_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        if (!participant) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    return NextResponse.json({
      contestId: contest.id,
      last_metrics_updated: contest.last_metrics_updated ?? null,
    });
  } catch (e) {
    console.error("[last-metrics-updated]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
