import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  fetchPostCampaignMetrics,
  fetchPostCampaignMetricsCount,
  fetchPostCampaignLastSyncedAt,
  syncPostCampaignFromSubmissions,
} from "@/lib/post-campaign-metrics";
import {
  activePostCampaignRunResponse,
  hasActivePostCampaignMetricsRun,
  postCampaignCooldownResponse,
} from "@/lib/post-campaign-enqueue-guards";

async function authorizeContestAccess(
  contestId: string,
  userId: string,
): Promise<
  | {
      ok: true;
      isAdmin: boolean;
      contest: {
        id: string;
        advertiser_id: string;
        platform: string | null;
        end_date: string | null;
        post_campaign_last_metrics_updated: string | null;
        contest_based_details: Record<string, unknown> | null;
      };
    }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();
  const { data: contest, error } = await supabase
    .from("contests")
    .select(
      "id, advertiser_id, platform, end_date, post_campaign_last_metrics_updated, contest_based_details",
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

  return {
    ok: true,
    isAdmin,
    contest: {
      ...contest,
      contest_based_details:
        (contest.contest_based_details as Record<string, unknown> | null) ??
        null,
    },
  };
}

function isContestEnded(endDate: string | null): boolean {
  if (!endDate) return false;
  return new Date() >= new Date(endDate);
}

export async function GET(
  request: Request,
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

    // Service role: faster than RLS user client for large overlay payloads.
    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const url = new URL(request.url);
    const probeOnly = url.searchParams.get("probe") === "1";
    if (probeOnly) {
      const count = await fetchPostCampaignMetricsCount(
        supabaseAdmin,
        contestId,
      );
      return NextResponse.json({
        count,
        empty: count === 0,
        post_campaign_last_metrics_updated:
          auth.contest.post_campaign_last_metrics_updated,
      });
    }

    const metrics = await fetchPostCampaignMetrics(supabaseAdmin, contestId, {
      light: true,
    });
    const pcYt =
      (
        auth.contest.contest_based_details
          ?.post_campaign_youtube_metrics_last_updated as
          | Record<string, string>
          | undefined
      ) ?? null;
    return NextResponse.json({
      metrics,
      post_campaign_last_metrics_updated:
        auth.contest.post_campaign_last_metrics_updated,
      post_campaign_youtube_metrics_last_updated: pcYt,
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

    // Prefer refresh timestamp; fall back to latest overlay synced_at so empty
    // contests cannot spam sync before the first metrics refresh.
    const cooldownAnchor =
      auth.contest.post_campaign_last_metrics_updated ??
      (await fetchPostCampaignLastSyncedAt(supabaseAdmin, contestId));
    const cooldownDenied = postCampaignCooldownResponse(
      cooldownAnchor,
      auth.isAdmin,
    );
    if (cooldownDenied) return cooldownDenied;

    const platform = (auth.contest.platform ?? "").toLowerCase();
    const activeRunTable = platform.includes("instagram")
      ? "instagram_insights_refresh_runs"
      : platform.includes("youtube")
        ? "youtube_metrics_refresh_runs"
        : platform.includes("tiktok")
          ? "tiktok_metrics_refresh_runs"
          : null;
    if (
      activeRunTable &&
      (await hasActivePostCampaignMetricsRun(
        supabaseAdmin,
        activeRunTable,
        contestId,
      ))
    ) {
      return activePostCampaignRunResponse();
    }

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
