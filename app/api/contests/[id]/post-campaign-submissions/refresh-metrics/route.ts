import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  fetchAllPostCampaignPlatformValues,
  fetchPostCampaignMetricsCount,
  refreshPostCampaignMetrics,
} from "@/lib/post-campaign-metrics";
import { isInstagramInsightsQueueEnabled } from "@/lib/queue/instagram-insights-queue";
import { isYouTubeMetricsQueueEnabled } from "@/lib/queue/youtube-metrics-queue";
import { isTikTokMetricsQueueEnabled } from "@/lib/queue/tiktok-metrics-queue";
import type { YouTubeRefreshScope } from "@/lib/queue/youtube-metrics-queue";
import {
  abandonStaleActiveMetricsRuns,
  assertNoCrossTargetActiveRun,
  postCampaignCooldownResponse,
  postCampaignNextRefreshAvailable,
} from "@/lib/post-campaign-enqueue-guards";
import {
  metricsRunTableForPlatform,
  resolvePostCampaignRefreshPlatforms,
  type PostCampaignVideoPlatform,
} from "@/lib/post-campaign-platforms";
import {
  parseRequestedRefreshPlatforms,
  resolveMetricsRefreshPlatformQueue,
} from "@/lib/multi-platform-metrics-refresh";
import { startMultiPlatformMetricsChain } from "@/lib/queue/multi-platform-metrics-chain";

const YT_SCOPES: YouTubeRefreshScope[] = [
  "basic",
  "core",
  "traffic",
  "demographics",
  "all",
  "all_standard",
];

function resolveBaseUrl(request: Request): string {
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host");
  if (host) return `${protocol}://${host}`;
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.startsWith("http")
      ? process.env.NEXT_PUBLIC_APP_URL
      : `https://${process.env.NEXT_PUBLIC_APP_URL}`;
  }
  return "http://localhost:3000";
}

function isQueueEnabledForPlatform(platform: PostCampaignVideoPlatform): boolean {
  switch (platform) {
    case "instagram":
      return isInstagramInsightsQueueEnabled();
    case "youtube":
      return isYouTubeMetricsQueueEnabled();
    case "tiktok":
      return isTikTokMetricsQueueEnabled();
  }
}

export async function POST(
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
    const body = await request.json().catch(() => ({}));
    const scopeRaw = (body?.scope as string | undefined) ?? "basic";
    const scope = (
      YT_SCOPES.includes(scopeRaw as YouTubeRefreshScope)
        ? scopeRaw
        : "basic"
    ) as YouTubeRefreshScope;

    const { data: contest, error } = await supabase
      .from("contests")
      .select(
        "id, title, platform, advertiser_id, end_date, post_campaign_last_metrics_updated",
      )
      .eq("id", contestId)
      .single();

    if (error || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin && contest.advertiser_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const contestPlatforms = resolvePostCampaignRefreshPlatforms({
      contestPlatform: contest.platform,
    });

    if (
      scope !== "basic" &&
      !isAdmin &&
      contestPlatforms.includes("youtube") &&
      contest.advertiser_id !== user.id
    ) {
      return NextResponse.json(
        { error: "Admin access required for this analytics scope" },
        { status: 403 },
      );
    }

    if (!contest.end_date || new Date() < new Date(contest.end_date)) {
      return NextResponse.json(
        {
          error:
            "Post-campaign metrics refresh is only available after the contest has ended.",
        },
        { status: 400 },
      );
    }

    if (contestPlatforms.length === 0) {
      return NextResponse.json(
        {
          error: `Post-campaign metrics refresh not supported for platform: ${contest.platform}`,
        },
        { status: 400 },
      );
    }

    const cooldownDenied = postCampaignCooldownResponse(
      contest.post_campaign_last_metrics_updated,
      isAdmin,
    );
    if (cooldownDenied) return cooldownDenied;

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Refresh Metrics must not sync from submissions — Sync is a separate explicit action.
    const existingCount = await fetchPostCampaignMetricsCount(
      supabaseAdmin,
      contestId,
    );
    if (existingCount === 0) {
      return NextResponse.json(
        {
          error:
            "No post-campaign submissions to refresh. Sync from Submissions first to copy contest submissions.",
        },
        { status: 400 },
      );
    }

    const overlayPlatformRows = await fetchAllPostCampaignPlatformValues(
      supabaseAdmin,
      contestId,
    );

    const allowedPlatforms = resolvePostCampaignRefreshPlatforms({
      contestPlatform: contest.platform,
      rowPlatforms: overlayPlatformRows,
    });

    if (allowedPlatforms.length === 0) {
      return NextResponse.json(
        {
          error: `Post-campaign metrics refresh not supported for platform: ${contest.platform}`,
        },
        { status: 400 },
      );
    }

    const requestedPlatforms = parseRequestedRefreshPlatforms(body?.platforms);
    const platforms = resolveMetricsRefreshPlatformQueue({
      allowedPlatforms,
      requestedPlatforms,
    });

    if (platforms.length === 0) {
      return NextResponse.json(
        {
          error:
            requestedPlatforms.length > 0
              ? "None of the requested platforms are available on this contest."
              : `Post-campaign metrics refresh not supported for platform: ${contest.platform}`,
        },
        { status: 400 },
      );
    }

    for (const p of platforms) {
      const runTable = metricsRunTableForPlatform(p);
      // Stuck runs (no heartbeat) are abandoned so retry is not bricked forever.
      // Fresh active runs are handled by platform enqueue (re-trigger processor).
      await abandonStaleActiveMetricsRuns(supabaseAdmin, runTable, contestId, {
        metricsTarget: "post_campaign",
      });
      const crossTargetBlocked = await assertNoCrossTargetActiveRun(
        supabaseAdmin,
        runTable,
        contestId,
        "post_campaign",
      );
      if (crossTargetBlocked) return crossTargetBlocked;
    }

    const baseUrl = resolveBaseUrl(request);
    const cookieHeader = request.headers.get("cookie");

    const queueTargets = platforms.filter((p) => isQueueEnabledForPlatform(p));

    if (queueTargets.length > 0) {
      // Sequential Redis chain: YouTube → Instagram → TikTok (subset only).
      // First platform enqueued now; processors advance the chain via QStash.
      const chainResult = await startMultiPlatformMetricsChain({
        baseUrl,
        contestId,
        platforms: queueTargets,
        metricsTarget: "post_campaign",
        scope,
        cookieHeader,
      });

      if (chainResult.error) {
        return NextResponse.json(
          { error: chainResult.error },
          { status: chainResult.status ?? 500 },
        );
      }

      const runs = chainResult.runs;
      const count = existingCount;
      const existingUpdated =
        contest.post_campaign_last_metrics_updated ?? null;
      const labels = runs.map((r) => r.platformLabel).join(" → ");
      const anyAlreadyActive = runs.some((r) => r.alreadyActive);
      const orderNote = chainResult.chain
        ? " Queued in order (YouTube → Instagram → TikTok)."
        : "";

      return NextResponse.json({
        success: true,
        queued: true,
        chain: chainResult.chain,
        refreshInProgress: true,
        count,
        message: anyAlreadyActive
          ? `Post-campaign refresh already in progress for ${labels}. Metrics will update shortly.`
          : `${labels} post-campaign metrics refresh started.${orderNote} Metrics update in the background.`,
        contestId,
        contestTitle: contest.title,
        platform: contest.platform,
        platforms: queueTargets,
        runs,
        // Back-compat for older clients that poll a single runId/statusPath.
        runId: runs[0]?.runId,
        metricsTarget: "post_campaign",
        scope,
        post_campaign_last_metrics_updated: existingUpdated,
        nextRefreshAvailable: postCampaignNextRefreshAvailable(
          existingUpdated,
          isAdmin,
        ),
      });
    }

    const result = await refreshPostCampaignMetrics(
      supabaseAdmin,
      contestId,
      contest.platform,
      { scope, syncIfEmpty: false },
    );
    const count = await fetchPostCampaignMetricsCount(supabaseAdmin, contestId);

    const reconnectHint =
      platforms.includes("instagram") && result.failed > 0
        ? " Failed rows usually mean creators need to reconnect Instagram (invalid/expired token). Previous metrics were kept for those rows."
        : "";

    const { success: updatedCount, synced: _ignoredSynced, ...resultRest } =
      result;

    return NextResponse.json({
      ...resultRest,
      message: `Post-campaign metrics refreshed (${scope}) for ${platforms.join(", ")}. Updated ${updatedCount}, failed ${result.failed}${result.skipped ? `, skipped ${result.skipped}` : ""}.${reconnectHint}`,
      scope,
      success: updatedCount,
      count,
      platforms,
      contestId,
      contestTitle: contest.title,
      post_campaign_last_metrics_updated: result.post_campaign_last_metrics_updated,
      nextRefreshAvailable: postCampaignNextRefreshAvailable(
        result.post_campaign_last_metrics_updated,
        isAdmin,
      ),
    });
  } catch (e) {
    console.error("[post-campaign-submissions/refresh-metrics]", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Failed to refresh post-campaign metrics",
      },
      { status: 500 },
    );
  }
}
