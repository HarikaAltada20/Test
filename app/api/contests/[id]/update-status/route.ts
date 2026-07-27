import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { MetricsService } from "@/lib/metrics-service";
import { POST_CONTEST_STATUS } from "@/lib/constants-status";
import { postContestStatusLocksViews } from "@/lib/contest-metrics-refresh-eligibility";
import { CONTEST_VIEWS_SYNC_FAILED_MESSAGE } from "@/lib/submission-credited-views";
import { invalidateCampaignListCachesAfterMutation } from "@/lib/campaign-list-cache";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const resolvedParams = await params;
    const contestId = resolvedParams.id;

    const { status, reason } = await request.json();

    const validStatuses = [
      "pending_review",
      "in_review",
      "verification_complete",
      "payouts_processed",
    ];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: "Invalid status. Must be one of: " + validStatuses.join(", "),
        },
        { status: 400 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    const isAdmin = userData?.user_type === "admin";

    let contestQuery = supabase
      .from("contests_with_status")
      .select("id, title, advertiser_id, moderation_status, status, post_contest_status")
      .eq("id", contestId);

    if (!isAdmin) {
      contestQuery = contestQuery.eq("advertiser_id", user.id);
    }

    const { data: contest, error: contestError } = await contestQuery.single();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: "Contest not found or access denied" },
        { status: 404 },
      );
    }

    if (contest.moderation_status !== "published") {
      return NextResponse.json(
        {
          error: "Contest must be published to update post-contest status",
        },
        { status: 400 },
      );
    }

    if (contest.status !== "ended") {
      return NextResponse.json(
        {
          error: "Contest must be ended to update post-contest status",
        },
        { status: 400 },
      );
    }

    const currentStatus = contest.post_contest_status;

    if (status === "payouts_processed" && !isAdmin) {
      return NextResponse.json(
        {
          error: "Only admins can change status to payouts_processed",
        },
        { status: 403 },
      );
    }

    if (!isAdmin) {
      if (currentStatus === "payouts_processed") {
        return NextResponse.json(
          {
            error: "Cannot change status after payouts have been processed",
          },
          { status: 400 },
        );
      }

      if (
        currentStatus === "verification_complete" &&
        status !== "payouts_processed"
      ) {
        return NextResponse.json(
          {
            error:
              "Contest verification is complete. Only payouts_processed status is allowed",
          },
          { status: 400 },
        );
      }
    }

    const requiresViewSync =
      status === POST_CONTEST_STATUS.verification_complete ||
      status === POST_CONTEST_STATUS.payouts_processed;

    const admin = createAdminClient();

    if (requiresViewSync) {
      try {
        const syncResult =
          await MetricsService.syncContestViewsToCreatorProfiles(contestId);
        if (status === POST_CONTEST_STATUS.verification_complete) {
          const { error: fnErr } = await admin.rpc(
            "lock_verified_submission_views",
            { p_contest_id: contestId },
          );
          if (fnErr) {
            console.error(
              "[update-status] lock_verified_submission_views failed:",
              fnErr,
            );
            return NextResponse.json(
              {
                error: CONTEST_VIEWS_SYNC_FAILED_MESSAGE,
                details: fnErr.message,
              },
              { status: 502 },
            );
          }
        }

        const nowIso = new Date().toISOString();
        const contestUpdate: Record<string, unknown> = {
          post_contest_status: status,
          updated_at: nowIso,
        };
        if (postContestStatusLocksViews(status)) {
          contestUpdate.views_locked_at = nowIso;
        }

        const { error: updateError } = await supabase
          .from("contests")
          .update(contestUpdate)
          .eq("id", contestId);

        if (updateError) {
          console.error("Error updating contest status:", updateError);
          return NextResponse.json(
            { error: "Failed to update contest status" },
            { status: 500 },
          );
        }

        await invalidateCampaignListCachesAfterMutation({
          advertiserId: contest.advertiser_id,
          touchOpportunities: false,
        });

        return NextResponse.json({
          success: true,
          message: `Contest status updated to ${status}`,
          previous_status: currentStatus,
          new_status: status,
          views_sync: syncResult,
        });
      } catch (syncError: unknown) {
        console.error("[update-status] View sync failed:", syncError);
        const details =
          syncError instanceof Error ? syncError.message : String(syncError);
        return NextResponse.json(
          {
            error: CONTEST_VIEWS_SYNC_FAILED_MESSAGE,
            details,
          },
          { status: 502 },
        );
      }
    }

    const nowIso = new Date().toISOString();
    const contestUpdate: Record<string, unknown> = {
      post_contest_status: status,
      updated_at: nowIso,
    };
    if (postContestStatusLocksViews(status)) {
      contestUpdate.views_locked_at = nowIso;
    }

    const { error: updateError } = await supabase
      .from("contests")
      .update(contestUpdate)
      .eq("id", contestId);

    if (updateError) {
      console.error("Error updating contest status:", updateError);
      return NextResponse.json(
        { error: "Failed to update contest status" },
        { status: 500 },
      );
    }

    await invalidateCampaignListCachesAfterMutation({
      advertiserId: contest.advertiser_id,
      touchOpportunities: false,
    });

    return NextResponse.json({
      success: true,
      message: `Contest status updated to ${status}`,
      previous_status: currentStatus,
      new_status: status,
      reason: reason ?? null,
    });
  } catch (error) {
    console.error("Error in update contest status API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
