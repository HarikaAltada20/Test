/**
 * GET: Latest Twitter metrics refresh run for the contest (admin polling).
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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

    const { data: contest } = await supabaseAdmin
      .from("contests")
      .select("id")
      .eq("id", contestId)
      .maybeSingle();

    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const { data: run, error } = await supabaseAdmin
      .from("twitter_metrics_refresh_runs")
      .select(
        "id, status, is_raid, total_batches, current_batch_index, total_participants, processed_participants, tweets_upserted, started_at, last_batch_completed_at, finished_at, updated_at, error_message"
      )
      .eq("contest_id", contestId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[twitter-metrics-refresh status]", error);
      return NextResponse.json({ error: "Failed to load run" }, { status: 500 });
    }

    return NextResponse.json({
      contestId,
      run: run
        ? {
            id: run.id,
            status: run.status,
            is_raid: run.is_raid,
            total_batches: run.total_batches,
            current_batch_index: run.current_batch_index,
            total_participants: run.total_participants,
            processed_participants: run.processed_participants,
            tweets_upserted: run.tweets_upserted,
            started_at: run.started_at,
            last_batch_completed_at: run.last_batch_completed_at,
            updated_at: run.updated_at,
            last_updated_at: run.updated_at ?? run.last_batch_completed_at ?? run.started_at,
            finished_at: run.finished_at,
            error_message: run.error_message,
          }
        : null,
    });
  } catch (e) {
    console.error("[twitter-metrics-refresh status]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
