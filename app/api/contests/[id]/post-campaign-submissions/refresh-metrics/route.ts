import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  METRICS_REFRESH_COOLDOWN_MS_BRAND,
  METRICS_REFRESH_COOLDOWN_MS_ADMIN,
} from "@/lib/constants";
import {
  fetchPostCampaignMetrics,
  refreshPostCampaignMetrics,
  syncPostCampaignFromSubmissions,
} from "@/lib/post-campaign-metrics";
import { isInstagramInsightsQueueEnabled } from "@/lib/queue/instagram-insights-queue";
import { isYouTubeMetricsQueueEnabled } from "@/lib/queue/youtube-metrics-queue";
import { isTikTokMetricsQueueEnabled } from "@/lib/queue/tiktok-metrics-queue";
import type { YouTubeRefreshScope } from "@/lib/queue/youtube-metrics-queue";

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

    if (
      scope !== "basic" &&
      !isAdmin &&
      (contest.platform ?? "").toLowerCase().includes("youtube")
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

    const platform = (contest.platform ?? "").toLowerCase();
    if (
      !platform.includes("instagram") &&
      !platform.includes("youtube") &&
      !platform.includes("tiktok")
    ) {
      return NextResponse.json(
        {
          error: `Post-campaign metrics refresh not supported for platform: ${contest.platform}`,
        },
        { status: 400 },
      );
    }

    const now = new Date();
    const cooldownMs = isAdmin
      ? METRICS_REFRESH_COOLDOWN_MS_ADMIN
      : METRICS_REFRESH_COOLDOWN_MS_BRAND;

    if (contest.post_campaign_last_metrics_updated) {
      const lastUpdate = new Date(contest.post_campaign_last_metrics_updated);
      const elapsed = now.getTime() - lastUpdate.getTime();
      if (elapsed < cooldownMs) {
        const remainingMs = cooldownMs - elapsed;
        const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);
        return NextResponse.json(
          {
            error: `Post-campaign metrics were updated recently. Please wait ${remainingMinutes} more minute${remainingMinutes !== 1 ? "s" : ""}.`,
            nextRefreshAvailable: new Date(
              lastUpdate.getTime() + cooldownMs,
            ).toISOString(),
          },
          { status: 429 },
        );
      }
    }

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Always copy full submission snapshot into overlay first so every row is present.
    const { synced } = await syncPostCampaignFromSubmissions(
      supabaseAdmin,
      contestId,
    );

    const baseUrl = resolveBaseUrl(request);
    const cookieHeader = request.headers.get("cookie");

    const enqueueQueuedRefresh = async (options: {
      platformLabel: string;
      enqueuePath: string;
      body: Record<string, unknown>;
    }) => {
      const enqueueUrl = `${baseUrl.replace(/\/$/, "")}${options.enqueuePath}`;
      const enqueueRes = await fetch(enqueueUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        credentials: "include",
        body: JSON.stringify(options.body),
      });
      const enqueueData = await enqueueRes.json().catch(() => ({}));
      if (!enqueueRes.ok) {
        return NextResponse.json(
          {
            error:
              enqueueData?.error ??
              `Failed to start ${options.platformLabel} post-campaign refresh`,
          },
          { status: enqueueRes.status },
        );
      }

      const metrics = await fetchPostCampaignMetrics(supabaseAdmin, contestId);
      return NextResponse.json({
        success: true,
        queued: true,
        synced,
        message:
          enqueueData.alreadyActive
            ? `Post-campaign ${options.platformLabel} refresh already in progress. Metrics will update shortly.`
            : `Copied ${synced} submissions into post-campaign. ${options.platformLabel} refresh started (same queue as Submissions). Metrics update in the background; Submissions table is not modified.`,
        contestId,
        contestTitle: contest.title,
        platform: contest.platform,
        runId: enqueueData.runId,
        metricsTarget: "post_campaign",
        scope: options.body.scope ?? "basic",
        metrics,
        nextRefreshAvailable: new Date(
          now.getTime() + cooldownMs,
        ).toISOString(),
      });
    };

    // Instagram / YouTube / TikTok: same background queue as Submissions, overlay only.
    if (platform.includes("instagram") && isInstagramInsightsQueueEnabled()) {
      return enqueueQueuedRefresh({
        platformLabel: "Instagram",
        enqueuePath: `/api/contests/${contestId}/instagram-insights-refresh/enqueue`,
        body: { metricsTarget: "post_campaign" },
      });
    }

    if (platform.includes("youtube") && isYouTubeMetricsQueueEnabled()) {
      return enqueueQueuedRefresh({
        platformLabel: "YouTube",
        enqueuePath: `/api/contests/${contestId}/youtube-metrics-refresh/enqueue`,
        body: { scope, metricsTarget: "post_campaign" },
      });
    }

    if (platform.includes("tiktok") && isTikTokMetricsQueueEnabled()) {
      return enqueueQueuedRefresh({
        platformLabel: "TikTok",
        enqueuePath: `/api/contests/${contestId}/tiktok-metrics-refresh/enqueue`,
        body: { metricsTarget: "post_campaign" },
      });
    }

    const result = await refreshPostCampaignMetrics(
      supabaseAdmin,
      contestId,
      contest.platform,
      { scope, syncIfEmpty: false },
    );
    const metrics = await fetchPostCampaignMetrics(supabaseAdmin, contestId);

    const reconnectHint =
      platform.includes("instagram") && result.failed > 0
        ? " Failed rows usually mean creators need to reconnect Instagram (invalid/expired token). Previous metrics were kept for those rows."
        : "";

    const { success: updatedCount, synced: _ignoredSynced, ...resultRest } =
      result;

    return NextResponse.json({
      ...resultRest,
      message: `Post-campaign metrics refreshed (${scope}) for ${contest.platform}. Synced ${synced}, updated ${updatedCount}, failed ${result.failed}${result.skipped ? `, skipped ${result.skipped}` : ""}. Submissions table was not modified.${reconnectHint}`,
      scope,
      synced,
      success: updatedCount,
      metrics,
      contestId,
      contestTitle: contest.title,
      nextRefreshAvailable: new Date(now.getTime() + cooldownMs).toISOString(),
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
