import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  fetchPostCampaignMetrics,
  syncPostCampaignFromSubmissions,
} from "@/lib/post-campaign-metrics";

async function authorizeContestAccess(
  contestId: string,
  userId: string,
): Promise<
  | { ok: true; contest: { id: string; advertiser_id: string; platform: string | null; end_date: string | null; post_campaign_last_metrics_updated: string | null } }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();
  const { data: contest, error } = await supabase
    .from("contests")
    .select(
      "id, advertiser_id, platform, end_date, post_campaign_last_metrics_updated",
    )
    .eq("id", contestId)
    .single();

  if (error || !contest) {
    return { ok: false, status: 404, error: "Contest not found" };
  }

  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin && contest.advertiser_id !== userId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  return { ok: true, contest };
}

function isContestEnded(endDate: string | null): boolean {
  if (!endDate) return false;
  return new Date() >= new Date(endDate);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contestId } = await params;
    const auth = await authorizeContestAccess(contestId, user.id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const metrics = await fetchPostCampaignMetrics(supabase, contestId);
    return NextResponse.json({
      metrics,
      post_campaign_last_metrics_updated:
        auth.contest.post_campaign_last_metrics_updated,
      count: metrics.length,
    });
  } catch (e) {
    console.error("[post-campaign-submissions GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load" },
      { status: 500 },
    );
  }
}

/** Copy all submission metrics into the post-campaign overlay (no live API refresh). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contestId } = await params;
    const auth = await authorizeContestAccess(contestId, user.id);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!isContestEnded(auth.contest.end_date)) {
      return NextResponse.json(
        { error: "Post-campaign submissions are only available after the contest has ended." },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { synced } = await syncPostCampaignFromSubmissions(
      supabaseAdmin,
      contestId,
    );
    const metrics = await fetchPostCampaignMetrics(supabaseAdmin, contestId);

    return NextResponse.json({
      success: true,
      synced,
      metrics,
      post_campaign_last_metrics_updated:
        auth.contest.post_campaign_last_metrics_updated,
    });
  } catch (e) {
    console.error("[post-campaign-submissions POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to sync" },
      { status: 500 },
    );
  }
}
