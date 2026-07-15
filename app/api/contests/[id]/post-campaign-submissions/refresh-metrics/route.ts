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
} from "@/lib/post-campaign-metrics";
import type { YouTubeRefreshScope } from "@/lib/queue/youtube-metrics-queue";

const YT_SCOPES: YouTubeRefreshScope[] = [
  "basic",
  "core",
  "traffic",
  "demographics",
  "all",
  "all_standard",
];

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

    const result = await refreshPostCampaignMetrics(
      supabaseAdmin,
      contestId,
      contest.platform,
      { scope, syncIfEmpty: true },
    );
    const metrics = await fetchPostCampaignMetrics(supabaseAdmin, contestId);

    return NextResponse.json({
      success: true,
      message: `Post-campaign metrics refreshed (${scope}) for ${contest.platform}. Updated ${result.success} submissions (${result.failed} failed). Submissions table was not modified.`,
      scope,
      ...result,
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
