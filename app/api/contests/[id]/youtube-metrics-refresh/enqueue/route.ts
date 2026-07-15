/**
 * POST: Enqueue a YouTube metrics/analytics refresh for a contest (batched via Redis + processor).

 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  METRICS_REFRESH_COOLDOWN_MS_ADMIN,
  METRICS_REFRESH_COOLDOWN_MS_BRAND,
  METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES,
} from "@/lib/constants";
import {
  isYouTubeMetricsQueueEnabled,
  enqueueYouTubeMetricsJob,
  type YouTubeMetricsJob,
  type YouTubeRefreshScope,
} from "@/lib/queue/youtube-metrics-queue";
import { isQStashEnabled, triggerProcessYouTubeMetricsQueue } from "@/lib/qstash";
import { insightsRefreshInsightsStatusOrFilter } from "@/lib/insights-refresh-eligibility";

const BATCH_SIZE = 25;

const SCOPES: YouTubeRefreshScope[] = [
  "basic",
  "core",
  "traffic",
  "demographics",
  "all",
  "all_standard",
];

function isAnalyticsScope(scope: YouTubeRefreshScope): boolean {
  return scope !== "basic";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cronAuth = request.headers.get("Authorization") === `Bearer ${process.env.CRON_SECRET}`;
    let user: { id: string } | null = null;
    let isAdmin = false;
    if (!cronAuth) {
      const supabase = await createClient();
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      user = u;
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      ({ isAdmin } = await verifyAdminAccess());
    }

    const body = await request.json().catch(() => ({}));
    const metricsTarget =
      body?.metricsTarget === "post_campaign" ? "post_campaign" : "submissions";
    const isPostCampaignTarget = metricsTarget === "post_campaign";
    const scope = body.scope as YouTubeRefreshScope | undefined;
    if (!scope || !SCOPES.includes(scope)) {
      return NextResponse.json(
        {
          error:
            "scope is required and must be one of: basic, core, traffic, demographics, all, all_standard",
        },
        { status: 400 }
      );
    }

    if (!cronAuth && isAnalyticsScope(scope) && !isAdmin) {
      return NextResponse.json(
        { error: "Admin access required for this analytics scope" },
        { status: 403 }
      );
    }

    const { id: contestId } = await params;
    if (!contestId) {
      return NextResponse.json({ error: "Contest ID required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: contest, error: contestError } = await supabaseAdmin
      .from("contests")
      .select(
        "id, platform, advertiser_id, views_locked_at, post_contest_status, last_metrics_updated, end_date",
      )
      .eq("id", contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }
    const platformLower = (contest.platform ?? "").toString().toLowerCase();
    if (!platformLower.includes("youtube")) {
      return NextResponse.json({ error: "Contest is not a YouTube contest" }, { status: 400 });
    }

    // Submissions refresh stays locked after review; post-campaign overlay can still refresh.
    if (!isPostCampaignTarget) {
      if (contest.views_locked_at) {
        return NextResponse.json(
          { error: "Contest is finalized; refresh not allowed" },
          { status: 400 }
        );
      }
      if (
        contest.post_contest_status === "in_review" ||
        contest.post_contest_status === "verification_complete" ||
        contest.post_contest_status === "payouts_processed"
      ) {
        return NextResponse.json(
          { error: "Metrics are locked after contest review begins. No further refresh allowed." },
          { status: 400 }
        );
      }
    } else if (!contest.end_date || new Date() < new Date(contest.end_date)) {
      return NextResponse.json(
        {
          error:
            "Post-campaign metrics refresh is only available after the contest has ended.",
        },
        { status: 400 },
      );
    }

    if (!isYouTubeMetricsQueueEnabled()) {
      return NextResponse.json(
        { error: "YouTube metrics queue not configured (Redis env missing)" },
        { status: 503 }
      );
    }

    const baseUrl =
      request.headers.get("x-forwarded-proto") && request.headers.get("host")
        ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("host")}`
        : process.env.NEXT_PUBLIC_APP_URL
          ? process.env.NEXT_PUBLIC_APP_URL.startsWith("http")
            ? process.env.NEXT_PUBLIC_APP_URL
            : `https://${process.env.NEXT_PUBLIC_APP_URL}`
          : "http://localhost:3000";

    const doFetch = () =>
      fetch(`${baseUrl.replace(/\/$/, "")}/api/cron/process-youtube-metrics-queue`, {
        method: "POST",
        headers: process.env.CRON_SECRET
          ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
          : {},
      }).catch((e) => console.warn("[youtube-metrics-refresh] Trigger processor failed:", e));

    // Post-campaign cooldown is enforced by the post-campaign refresh-metrics caller.
    if (!cronAuth && !isPostCampaignTarget) {
      const isOwner = contest.advertiser_id === user?.id;
      const isOpportunitiesRefresh = !isAdmin && !isOwner;
      const cooldownMs = isOpportunitiesRefresh
        ? METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES
        : isAdmin
          ? METRICS_REFRESH_COOLDOWN_MS_ADMIN
          : METRICS_REFRESH_COOLDOWN_MS_BRAND;

      if (contest.last_metrics_updated) {
        const now = Date.now();
        const lastUpdateMs = new Date(contest.last_metrics_updated).getTime();
        const timeSinceLastUpdate = now - lastUpdateMs;
        if (!Number.isNaN(lastUpdateMs) && timeSinceLastUpdate < cooldownMs) {
          const remainingMs = cooldownMs - timeSinceLastUpdate;
          const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);
          return NextResponse.json(
            {
              error: `Metrics were updated ${Math.floor(
                timeSinceLastUpdate / 1000 / 60
              )} minutes ago. Please wait ${remainingMinutes} more minutes before refreshing again.`,
              nextRefreshAvailable: new Date(lastUpdateMs + cooldownMs).toISOString(),
              userType: isOpportunitiesRefresh
                ? "creators"
                : isAdmin
                  ? "admins"
                  : "brands/owners",
            },
            { status: 429 }
          );
        }
      }
    }

    const { data: existingRun } = await supabaseAdmin
      .from("youtube_metrics_refresh_runs")
      .select("id, status, total_submissions, total_batches, scope")
      .eq("contest_id", contestId)
      .in("status", ["pending", "running"])
      .maybeSingle();

    if (existingRun) {
      if (isQStashEnabled()) {
        triggerProcessYouTubeMetricsQueue(baseUrl)
          .then((res) => {
            if (res?.error) doFetch();
          })
          .catch(() => doFetch());
      } else {
        doFetch();
      }
      return NextResponse.json({
        runId: existingRun.id,
        status: existingRun.status,
        scope: existingRun.scope,
        alreadyActive: true,
        total_submissions: existingRun.total_submissions,
        total_batches: existingRun.total_batches,
        processorTriggered: true,
        metricsTarget,
      });
    }

    let totalEligible = 0;
    if (isPostCampaignTarget) {
      const { count, error: eligibleCountError } = await supabaseAdmin
        .from("post_campaign_submission_metrics")
        .select("*", { count: "exact", head: true })
        .eq("contest_id", contestId)
        .ilike("platform", "%youtube%")
        .neq("status", "rejected")
        .not("content_link", "is", null)
        .or(insightsRefreshInsightsStatusOrFilter());
      if (eligibleCountError) {
        console.error(
          "[youtube-metrics-refresh enqueue] eligible count failed:",
          eligibleCountError,
        );
        return NextResponse.json(
          { error: "Failed to count eligible submissions" },
          { status: 500 },
        );
      }
      totalEligible = count ?? 0;
    } else {
      const { count: eligibleCount, error: eligibleCountError } = await supabaseAdmin
        .from("submissions")
        .select("*", { count: "exact", head: true })
        .eq("contest_id", contestId)
        .ilike("platform", "%youtube%")
        .neq("status", "rejected")
        .not("content_link", "is", null)
        .or(insightsRefreshInsightsStatusOrFilter());
      if (eligibleCountError) {
        console.error(
          "[youtube-metrics-refresh enqueue] eligible count failed:",
          eligibleCountError,
        );
        return NextResponse.json(
          { error: "Failed to count eligible submissions" },
          { status: 500 },
        );
      }
      totalEligible = eligibleCount ?? 0;
    }

    const totalBatches = Math.max(1, Math.ceil(totalEligible / BATCH_SIZE));
    const runStartedAt = new Date().toISOString();

    const { data: newRun, error: insertError } = await supabaseAdmin
      .from("youtube_metrics_refresh_runs")
      .insert({
        contest_id: contestId,
        status: "running",
        scope,
        total_submissions: totalEligible,
        processed_submissions: 0,
        success_count: 0,
        permanent_failure_count: 0,
        temporary_failure_count: 0,
        skipped_recent_count: 0,
        reviewed_count: 0,
        current_batch_index: 0,
        total_batches: totalBatches,
        started_at: runStartedAt,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: again } = await supabaseAdmin
          .from("youtube_metrics_refresh_runs")
          .select("id, status")
          .eq("contest_id", contestId)
          .in("status", ["pending", "running"])
          .maybeSingle();
        if (again) {
          if (isQStashEnabled()) {
            triggerProcessYouTubeMetricsQueue(baseUrl)
              .then((res) => {
                if (res?.error) doFetch();
              })
              .catch(() => doFetch());
          } else {
            doFetch();
          }
          return NextResponse.json({
            runId: again.id,
            status: again.status,
            alreadyActive: true,
            processorTriggered: true,
            metricsTarget,
          });
        }
      }
      console.error("[youtube-metrics-refresh enqueue] insert run failed:", insertError);
      return NextResponse.json({ error: "Failed to create run" }, { status: 500 });
    }

    const runId = newRun.id;
    const firstJob: YouTubeMetricsJob = {
      contestId,
      runId,
      scope,
      batchIndex: 0,
      batchSize: BATCH_SIZE,
      totalBatches: totalBatches,
      metricsTarget,
    };

    const enqueueResult = await enqueueYouTubeMetricsJob(firstJob);
    if (enqueueResult.error) {
      await supabaseAdmin
        .from("youtube_metrics_refresh_runs")
        .update({
          status: "failed",
          error_message: enqueueResult.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", runId);
      return NextResponse.json(
        { error: `Failed to enqueue: ${enqueueResult.error}` },
        { status: 500 }
      );
    }

    if (isQStashEnabled()) {
      triggerProcessYouTubeMetricsQueue(baseUrl)
        .then((res) => {
          if (res?.error) doFetch();
        })
        .catch(() => doFetch());
    } else {
      doFetch();
    }

    return NextResponse.json({
      runId,
      status: "running",
      scope,
      total_submissions: totalEligible,
      total_batches: totalBatches,
      metricsTarget,
    });
  } catch (e) {
    console.error("[youtube-metrics-refresh enqueue]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
