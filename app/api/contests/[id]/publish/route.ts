import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { MetricsService } from "@/lib/metrics-service";
import { clearContestsCache } from "@/lib/cache-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const resolvedParams = await params;
    const contestId = resolvedParams.id;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { isAdmin } = await verifyAdminAccess();
    const db = isAdmin ? createAdminClient() : supabase;

    let contestQuery = db
      .from("contests")
      .select("*")
      .eq("id", contestId);

    if (!isAdmin) {
      contestQuery = contestQuery.eq("advertiser_id", user.id);
    }

    const { data: contest, error: contestError } = await contestQuery.single();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const publishableStatuses = isAdmin
      ? ["approved", "pending_approval"]
      : ["approved"];

    if (!publishableStatuses.includes(contest.moderation_status)) {
      return NextResponse.json(
        {
          error: isAdmin
            ? "Campaign must be approved or pending approval before publishing"
            : "Contest must be approved before publishing",
        },
        { status: 400 },
      );
    }

    if (!contest.start_date || !contest.end_date) {
      return NextResponse.json(
        {
          error: "Contest must have start and end dates before publishing",
        },
        { status: 400 },
      );
    }

    if (!isAdmin && new Date(contest.start_date) <= new Date()) {
      return NextResponse.json(
        {
          error: "Cannot publish contest with past start date",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, string> = {
      moderation_status: "published",
      published_at: now,
      updated_at: now,
    };

    if (
      isAdmin &&
      contest.moderation_status === "pending_approval" &&
      !contest.approved_at
    ) {
      updatePayload.approved_at = now;
      updatePayload.approved_by = user.id;
    }

    const { error: updateError } = await db
      .from("contests")
      .update(updatePayload)
      .eq("id", contestId);

    if (updateError) {
      console.error("Error publishing contest:", updateError);
      return NextResponse.json(
        { error: "Failed to publish contest" },
        { status: 500 },
      );
    }

    clearContestsCache();

    try {
      const budgetCents =
        (contest as { payment_details?: { total_amount_paid?: number } })
          ?.payment_details?.total_amount_paid || 0;
      if (contest.advertiser_id) {
        await MetricsService.applyContestPublished(
          contest.advertiser_id,
          budgetCents,
        );
      }
    } catch (accErr: unknown) {
      console.error("Error applying advertiser publish accounting:", accErr);
      const message =
        accErr instanceof Error ? accErr.message : "unknown error";
      return NextResponse.json(
        { error: `Published, but accounting failed: ${message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contest published successfully",
    });
  } catch (error) {
    console.error("Error in publish contest API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
