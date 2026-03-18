/**
 * POST: Enqueue an Instagram insights refresh for a contest.
 * Creates a run (or returns existing active run), pushes first job to Redis, triggers processor.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import {
  isInstagramInsightsQueueEnabled,
  enqueueInstagramInsightsJob,
  type InstagramInsightsJob,
} from "@/lib/queue/instagram-insights-queue";
import {
  isQStashEnabled,
  triggerProcessInstagramInsightsQueue,
} from "@/lib/qstash";

const BATCH_SIZE = 100;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cronAuth = request.headers.get("Authorization") === `Bearer ${process.env.CRON_SECRET}`;
    let user: { id: string } | null = null;
    if (!cronAuth) {
      const supabase = await createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      user = u;
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
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
      .select("id, platform, views_locked_at, post_contest_status")
      .eq("id", contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }
    if ((contest.platform ?? "").toString().toLowerCase() !== "instagram") {
      return NextResponse.json(
        { error: "Contest is not an Instagram contest" },
        { status: 400 }
      );
    }
    if (contest.views_locked_at) {
      return NextResponse.json(
        { error: "Contest is finalized; refresh not allowed" },
        { status: 400 }
      );
    }
    // Hard lock: once in review, verification complete, or payouts processed, do not refresh
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

    // Any authenticated user (creator, brand, admin) may enqueue; run data is non-sensitive.

    if (!isInstagramInsightsQueueEnabled()) {
      return NextResponse.json(
        { error: "Instagram insights queue not configured (Redis env missing)" },
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
      fetch(`${baseUrl.replace(/\/$/, "")}/api/cron/process-instagram-insights-queue`, {
        method: "POST",
        headers: process.env.CRON_SECRET
          ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
          : {},
      }).catch((e) =>
        console.warn("[instagram-insights-refresh] Trigger processor failed:", e)
      );

    // Check for existing active run
    const { data: existingRun } = await supabaseAdmin
      .from("instagram_insights_refresh_runs")
      .select("id, status, total_submissions, total_batches")
      .eq("contest_id", contestId)
      .in("status", ["pending", "running"])
      .maybeSingle();

    if (existingRun) {
      // IMPORTANT: If a previous processor invocation failed (or crashed mid-pop),
      // the run can remain "running" while no worker is active. Re-triggering is safe:
      // - pop uses crash-safe LMOVE
      // - worker/run updates are idempotent and batch-index guarded
      if (isQStashEnabled()) {
        triggerProcessInstagramInsightsQueue(baseUrl).then((res) => {
          if (res?.error) doFetch();
        }).catch(() => doFetch());
      } else {
        doFetch();
      }
      return NextResponse.json({
        runId: existingRun.id,
        status: existingRun.status,
        alreadyActive: true,
        total_submissions: existingRun.total_submissions,
        total_batches: existingRun.total_batches,
        processorTriggered: true,
      });
    }

    // Count eligible submissions (instagram, has video_id, not rejected, not permanent_failure)
    const { count: eligibleCount } = await supabaseAdmin
      .from("submissions")
      .select("*", { count: "exact", head: true })
      .eq("contest_id", contestId)
      .eq("platform", "instagram")
      .neq("status", "rejected")
      .not("video_id", "is", null)
      .or("insights_status.is.null,insights_status.neq.permanent_failure");

    const totalEligible = eligibleCount ?? 0;
    const totalBatches = Math.max(1, Math.ceil(totalEligible / BATCH_SIZE));
    const runStartedAt = new Date().toISOString();

    const { data: newRun, error: insertError } = await supabaseAdmin
      .from("instagram_insights_refresh_runs")
      .insert({
        contest_id: contestId,
        status: "running",
        total_submissions: totalEligible,
        processed_submissions: 0,
        success_count: 0,
        permanent_failure_count: 0,
        temporary_failure_count: 0,
        skipped_recent_count: 0,
        current_batch_index: 0,
        total_batches: totalBatches,
        started_at: runStartedAt,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: again } = await supabaseAdmin
          .from("instagram_insights_refresh_runs")
          .select("id, status")
          .eq("contest_id", contestId)
          .in("status", ["pending", "running"])
          .maybeSingle();
        if (again) {
          return NextResponse.json({
            runId: again.id,
            status: again.status,
            alreadyActive: true,
          });
        }
      }
      console.error("[instagram-insights-refresh enqueue] insert run failed:", insertError);
      return NextResponse.json(
        { error: "Failed to create run" },
        { status: 500 }
      );
    }

    const runId = newRun.id;
    const firstJob: InstagramInsightsJob = {
      contestId,
      runId,
      batchIndex: 0,
      batchSize: BATCH_SIZE,
      totalBatches: totalBatches,
      // no cursor for first batch
    };

    const enqueueResult = await enqueueInstagramInsightsJob(firstJob);
    if (enqueueResult.error) {
      await supabaseAdmin
        .from("instagram_insights_refresh_runs")
        .update({ status: "failed", error_message: enqueueResult.error, updated_at: new Date().toISOString() })
        .eq("id", runId);
      return NextResponse.json(
        { error: `Failed to enqueue: ${enqueueResult.error}` },
        { status: 500 }
      );
    }

    if (isQStashEnabled()) {
      triggerProcessInstagramInsightsQueue(baseUrl).then((res) => {
        if (res?.error) doFetch();
      }).catch(() => doFetch());
    } else {
      doFetch();
    }

    return NextResponse.json({
      runId,
      status: "running",
      total_submissions: totalEligible,
      total_batches: totalBatches,
    });
  } catch (e) {
    console.error("[instagram-insights-refresh enqueue]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
