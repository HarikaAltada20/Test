import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  fetchPostCampaignMetricsCount,
  fetchPostCampaignMetricsPage,
  POST_CAMPAIGN_METRICS_PAGE_SIZE,
  syncPostCampaignFromSubmissions,
} from "@/lib/post-campaign-metrics";
import {
  activePostCampaignRunResponse,
  claimPostCampaignSyncSlot,
  hasActivePostCampaignMetricsRun,
  releasePostCampaignSyncSlot,
} from "@/lib/post-campaign-enqueue-guards";
import {
  metricsRunTableForPlatform,
  resolvePostCampaignRefreshPlatforms,
} from "@/lib/post-campaign-platforms";

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

function parsePaginationParams(url: URL): {
  limit: number;
  offset: number;
} | null {
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");
  const limit = limitRaw
    ? Number.parseInt(limitRaw, 10)
    : POST_CAMPAIGN_METRICS_PAGE_SIZE;
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;
  if (
    !Number.isFinite(limit) ||
    !Number.isFinite(offset) ||
    limit < 1 ||
    limit > 1000 ||
    offset < 0
  ) {
    return null;
  }
  return { limit, offset };
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

    const pagination = parsePaginationParams(url);
    if (!pagination) {
      return NextResponse.json(
        { error: "Invalid limit or offset" },
        { status: 400 },
      );
    }

    const page = await fetchPostCampaignMetricsPage(
      supabaseAdmin,
      contestId,
      {
        light: true,
        limit: pagination.limit,
        offset: pagination.offset,
      },
    );
    const pcYt =
      (auth.contest.contest_based_details
        ?.post_campaign_youtube_metrics_last_updated as
        | Record<string, string>
        | undefined) ?? null;
    return NextResponse.json({
      metrics: page.rows,
      count: page.total,
      limit: page.limit,
      offset: page.offset,
      hasMore: page.hasMore,
      post_campaign_last_metrics_updated:
        auth.contest.post_campaign_last_metrics_updated,
      post_campaign_youtube_metrics_last_updated: pcYt,
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
        {
          error:
            "Post-campaign submissions are only available after the contest has ended.",
        },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const platforms = resolvePostCampaignRefreshPlatforms({
      contestPlatform: auth.contest.platform,
    });
    for (const p of platforms) {
      if (
        await hasActivePostCampaignMetricsRun(
          supabaseAdmin,
          metricsRunTableForPlatform(p),
          contestId,
        )
      ) {
        return activePostCampaignRunResponse();
      }
    }

    // CAS claim sync slot (covers first-sync spam when refresh timestamp is null).
    const slotResult = await claimPostCampaignSyncSlot(
      supabaseAdmin,
      contestId,
      auth.isAdmin,
    );
    if (!slotResult.ok) return slotResult.response;

    try {
      const { synced } = await syncPostCampaignFromSubmissions(
        supabaseAdmin,
        contestId,
      );
      const count = await fetchPostCampaignMetricsCount(
        supabaseAdmin,
        contestId,
      );

      return NextResponse.json({
        success: true,
        synced,
        count,
        post_campaign_last_metrics_updated:
          auth.contest.post_campaign_last_metrics_updated,
      });
    } catch (syncError) {
      try {
        await releasePostCampaignSyncSlot(
          supabaseAdmin,
          contestId,
          slotResult.claim,
        );
      } catch (releaseError) {
        console.error(
          "[post-campaign-submissions POST] failed to release sync slot",
          releaseError,
        );
      }
      throw syncError;
    }
  } catch (e) {
    console.error("[post-campaign-submissions POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to sync" },
      { status: 500 },
    );
  }
}
