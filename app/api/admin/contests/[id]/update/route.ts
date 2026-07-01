import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { syncContestToMetrics } from "@/lib/twitter-metrics-sync";
import { isVideoContestFormat } from "@/lib/trust-score";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const contestId = resolvedParams.id;
    const payload = await request.json();

    // Whitelist allowed columns to prevent accidental/unsafe writes
    const allowedKeys = new Set([
      "title",
      "category",
      "brief_html",
      "brief_json",
      "rules_html",
      "rules_json",
      "inspiration_links",
      "tracking_links",
      "resources",
      "moderation_status",
      "submitted_for_approval_at",
      "rejection_reason",
      "start_date",
      "end_date",
      "contest_type",
      "contest_based_details",
      "thumbnail_url",
      // Categories, subcategories, and interests
      "categories",
      "subcategories",
      "interests",
      // Regions and countries (JSONB)
      "region",
      // New features (2025-10-01)
      "multiple_submissions_enabled",
      "max_submissions_per_creator",
      "content_type",
      "bonus_details",
      "max_earnings_per_creator",
      "payout_adjustment_percentage",
      "payout_adjustment_mode",
      "trust_score",
      "trust_number",
      "min_avg_quality_score",
      "min_best_quality_score",
      "min_platform_earnings",
      "min_platform_views",
      "platform",
      "contest_format",
      "subscription_info_of_user",
    ]);

    const updateData: Record<string, any> = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (allowedKeys.has(key)) {
        updateData[key] = value;
      }
    });

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Validate payout adjustment fields when present
    const validPayoutModes = [
      "cpm_only",
      "milestone_only",
      "bonus_only",
      "combined",
      "cpm_and_milestone",
      "dual_rewards_only",
      "bonus",
    ];
    if (updateData.payout_adjustment_mode !== undefined) {
      const mode = updateData.payout_adjustment_mode;
      if (mode != null && !validPayoutModes.includes(mode)) {
        return NextResponse.json(
          {
            error: `payout_adjustment_mode must be one of: ${validPayoutModes.join(", ")} or null`,
          },
          { status: 400 }
        );
      }
    }
    if (updateData.payout_adjustment_percentage !== undefined) {
      const pct = updateData.payout_adjustment_percentage;
      if (pct != null) {
        const num = typeof pct === "number" ? pct : parseFloat(pct);
        if (Number.isNaN(num) || num < 0 || num > 100) {
          return NextResponse.json(
            { error: "payout_adjustment_percentage must be between 0 and 100" },
            { status: 400 }
          );
        }
      }
    }

    if (updateData.trust_score !== undefined && updateData.trust_score != null) {
      const trustNum =
        typeof updateData.trust_score === "number"
          ? updateData.trust_score
          : parseInt(String(updateData.trust_score), 10);
      if (Number.isNaN(trustNum) || trustNum < 0 || trustNum > 100) {
        return NextResponse.json(
          { error: "trust_score must be between 0 and 100, or null" },
          { status: 400 },
        );
      }
    }

    if (updateData.trust_number !== undefined && updateData.trust_number != null) {
      const trustNumber =
        typeof updateData.trust_number === "number"
          ? updateData.trust_number
          : parseInt(String(updateData.trust_number), 10);
      if (Number.isNaN(trustNumber)) {
        return NextResponse.json(
          { error: "trust_number must be a valid integer, or null" },
          { status: 400 },
        );
      }
      updateData.trust_number = trustNumber;
    }

    if (
      updateData.min_best_quality_score !== undefined &&
      updateData.min_best_quality_score != null
    ) {
      const minBest = Number(updateData.min_best_quality_score);
      if (
        !Number.isInteger(minBest) ||
        minBest < 1 ||
        minBest > 3
      ) {
        return NextResponse.json(
          { error: "min_best_quality_score must be an integer between 1 and 3, or null" },
          { status: 400 },
        );
      }
      updateData.min_best_quality_score = minBest;
    }

    if (
      updateData.min_avg_quality_score !== undefined &&
      updateData.min_avg_quality_score != null
    ) {
      const minAvg = Number(updateData.min_avg_quality_score);
      if (!Number.isFinite(minAvg) || minAvg < 1 || minAvg > 3) {
        return NextResponse.json(
          { error: "min_avg_quality_score must be between 1 and 3, or null" },
          { status: 400 },
        );
      }
      updateData.min_avg_quality_score = minAvg;
    }

    if (
      updateData.min_platform_earnings !== undefined &&
      updateData.min_platform_earnings != null
    ) {
      const minEarnings =
        typeof updateData.min_platform_earnings === "number"
          ? updateData.min_platform_earnings
          : parseInt(String(updateData.min_platform_earnings), 10);
      if (!Number.isInteger(minEarnings) || minEarnings <= 0) {
        return NextResponse.json(
          { error: "min_platform_earnings must be a positive integer (cents), or null" },
          { status: 400 },
        );
      }
      updateData.min_platform_earnings = minEarnings;
    }

    if (
      updateData.min_platform_views !== undefined &&
      updateData.min_platform_views != null
    ) {
      const minViews =
        typeof updateData.min_platform_views === "number"
          ? updateData.min_platform_views
          : parseInt(String(updateData.min_platform_views), 10);
      if (!Number.isInteger(minViews) || minViews <= 0) {
        return NextResponse.json(
          { error: "min_platform_views must be a positive integer, or null" },
          { status: 400 },
        );
      }
      updateData.min_platform_views = minViews;
    }

    const admin = createAdminClient();

    const hasCreatorRequirementUpdate =
      (updateData.trust_score !== undefined && updateData.trust_score != null) ||
      (updateData.trust_number !== undefined && updateData.trust_number != null) ||
      (updateData.min_avg_quality_score !== undefined &&
        updateData.min_avg_quality_score != null) ||
      (updateData.min_best_quality_score !== undefined &&
        updateData.min_best_quality_score != null) ||
      (updateData.min_platform_earnings !== undefined &&
        updateData.min_platform_earnings != null) ||
      (updateData.min_platform_views !== undefined &&
        updateData.min_platform_views != null);

    if (hasCreatorRequirementUpdate) {
      const { data: contestRow } = await admin
        .from("contests")
        .select("contest_format")
        .eq("id", contestId)
        .maybeSingle();

      if (!isVideoContestFormat(contestRow?.contest_format)) {
        return NextResponse.json(
          {
            error:
              "Creator requirement fields are only supported for video campaigns (contest_format video)",
          },
          { status: 400 },
        );
      }
    }
    if (
      updateData.payout_adjustment_mode === "cpm_only" &&
      updateData.contest_type === "milestone"
    ) {
      updateData.payout_adjustment_mode = "milestone_only";
    }

    if (updateData.payout_adjustment_mode === "cpm_only") {
      const { data: existingContest } = await admin
        .from("contests")
        .select("contest_type")
        .eq("id", contestId)
        .maybeSingle();
      if (existingContest?.contest_type === "milestone") {
        updateData.payout_adjustment_mode = "milestone_only";
      }
    }

    if (updateData.payout_adjustment_mode === "cpm_and_milestone") {
      const { data: rowForPayoutMode } = await admin
        .from("contests")
        .select("contest_type")
        .eq("id", contestId)
        .maybeSingle();
      if (rowForPayoutMode?.contest_type !== "dual_rewards") {
        return NextResponse.json(
          {
            error:
              "payout_adjustment_mode cpm_and_milestone is only valid for dual_rewards contests",
          },
          { status: 400 }
        );
      }
    }

    const { data, error } = await admin
      .from("contests")
      .update(updateData)
      .eq("id", contestId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Admin update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Sync Twitter campaign metrics if contest_based_details was updated
    if (updateData.contest_based_details) {
      try {
        const { data: updatedContest } = await admin
          .from("contests")
          .select("platform, contest_based_details")
          .eq("id", contestId)
          .maybeSingle();

        if (
          updatedContest?.platform === "twitter" &&
          updatedContest?.contest_based_details?.twitter_campaign
        ) {
          await syncContestToMetrics(
            contestId,
            updatedContest.contest_based_details.twitter_campaign,
            admin
          );
        }
      } catch (syncError) {
        console.error(
          "[admin/contests/update] Error syncing metrics:",
          syncError
        );
        // Don't fail the request if sync fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Admin contest update failed:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
