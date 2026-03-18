/**
 * POST: Cancel an active Instagram insights refresh run.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { verifyAdminAccess } from "@/utils/admin-auth";

export async function POST(
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

    const { isAdmin } = await verifyAdminAccess();
    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: contest } = await supabaseAdmin
      .from("contests")
      .select("id, advertiser_id")
      .eq("id", contestId)
      .maybeSingle();

    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const isOwner = contest.advertiser_id === user.id;
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { data: run, error } = await supabaseAdmin
      .from("instagram_insights_refresh_runs")
      .update({ status: "cancelled", finished_at: now, updated_at: now })
      .eq("contest_id", contestId)
      .in("status", ["pending", "running"])
      .select("id, status")
      .maybeSingle();

    if (error) {
      console.error("[instagram-insights-refresh cancel]", error);
      return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
    }

    if (!run) {
      return NextResponse.json(
        { error: "No active run to cancel" },
        { status: 404 }
      );
    }

    return NextResponse.json({ runId: run.id, status: run.status });
  } catch (e) {
    console.error("[instagram-insights-refresh cancel]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
