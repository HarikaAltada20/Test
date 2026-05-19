import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";
import {
  creditCreatorWithdrawableBalance,
  debitCreatorWithdrawableBalance,
  logTransaction,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import { MetricsService } from "@/lib/metrics-service";
import { SUBMISSION_STATUS } from "@/lib/constants-status";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  buildMilestoneSubmissionPayoutCentsMap,
  getMilestoneCappedPayoutCentsForCreatorSubmission,
} from "@/lib/milestone-contest-expected-spend";
import {
  loadDualCreatorCapMaps,
  type DualCreatorCapMaps,
} from "@/lib/dual-rewards-payout-eligibility";
import {
  adjustBonusCents,
  adjustRewardCents,
  dualRewardsPayoutAdjustmentAppliesToCpm,
  dualRewardsPayoutAdjustmentAppliesToMilestone,
  parsePayoutAdjustment,
} from "@/lib/payout-rules";
import { allocateFlatFeeBonusCents } from "@/lib/bonus-allocation";
import { buildFlatFeeBonusExpectedCentsBySubmissionId } from "@/lib/twitter-cpm-bonus-expected";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { applyPayoutAdjustment } from "@/lib/payout-adjustment";
import {
  parseDualRewardPayoutScopeFromRemarks,
  stripDualComponentTagFromRemarks,
  buildDualRewardsPayoutPersistValue,
} from "@/lib/dual-rewards-payout";

function getTransactionPayoutCycle(metadata: any): number {
  const rawCycle = metadata?.payout_cycle;
  const parsedCycle =
    typeof rawCycle === "number"
      ? rawCycle
      : Number.parseInt(String(rawCycle ?? ""), 10);
  return Number.isFinite(parsedCycle) && parsedCycle > 0 ? parsedCycle : 1;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    let paidStatusReversalSummary: {
      reward_refunded_cents: number;
      bonus_refunded_cents: number;
      total_refunded_cents: number;
    } | null = null;
    const { submissionId, action, reason, paymentDetails } =
      await request.json();

    if (!submissionId || !action) {
      return NextResponse.json(
        { error: "Submission ID and action are required" },
        { status: 400 },
      );
    }

    if (
      ![
        "verified",
        "rejected",
        "pending",
        "paid",
        "mark_bonus_paid",
        "mark_both_paid",
      ].includes(action)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid action. Must be verified, rejected, pending, paid, mark_bonus_paid, or mark_both_paid",
        },
        { status: 400 },
      );
    }

    // Verify admin access first
    const {
      isAdmin,
      error: adminError,
      user: adminUser,
    } = await verifyAdminAccess();

    let currentUserId: string;

    if (!isAdmin) {
      // If not admin, check if it's an advertiser managing their own contest
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !authUser) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        );
      }

      const { data: userData, error: userDataError } = await supabase
        .from("users")
        .select("user_type")
        .eq("id", authUser.id)
        .single();

      if (userDataError || !userData || userData.user_type !== "advertiser") {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 },
        );
      }

      // For advertisers, verify they own the contest associated with this submission
      const { data: submission, error: submissionError } = await supabase
        .from("submissions")
        .select("contest_id, contests!inner(advertiser_id)")
        .eq("id", submissionId)
        .single();

      if (submissionError || !submission) {
        return NextResponse.json(
          { error: "Submission not found" },
          { status: 404 },
        );
      }

      if ((submission as any).contests.advertiser_id !== authUser.id) {
        return NextResponse.json(
          { error: "You can only manage submissions for your own contests" },
          { status: 403 },
        );
      }

      currentUserId = authUser.id;
    } else {
      currentUserId = adminUser?.id || "";
    }

    // Fetch the submission to verify it exists
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select("id, contest_id, creator_id, status")
      .eq("id", submissionId)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    // Fetch the contest to check its type and status
    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .select(
        "title, contest_type, contest_based_details, post_contest_status, max_earnings_per_creator, payout_adjustment_percentage, payout_adjustment_mode",
      )
      .eq("id", submission.contest_id)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    const payoutAdjustment = parsePayoutAdjustment(
      (contest as any).payout_adjustment_percentage,
      (contest as any).payout_adjustment_mode,
      { contestType: contest.contest_type },
    );

    const maxEarningsPerCreator =
      (contest as any).max_earnings_per_creator ??
      (contest as any).contest_based_details?.cpm_contest
        ?.max_earnings_per_creator ??
      (contest as any).contest_based_details?.leaderboard_contest
        ?.max_earnings_per_creator ??
      null;

    // Prevent submission status changes only after payouts are processed
    if (contest.post_contest_status === "payouts_processed") {
      return NextResponse.json(
        {
          error:
            "Submission status cannot be changed after payouts are processed. Contest is fully finalized.",
        },
        { status: 400 },
      );
    }

    // Only allow payment actions when contest status is verification_complete
    const isPaymentAction =
      action === SUBMISSION_STATUS.paid ||
      action === "mark_bonus_paid" ||
      action === "mark_both_paid";

    if (isPaymentAction && !isAdmin) {
      return NextResponse.json(
        { error: "Admin access required for payment actions" },
        { status: 403 },
      );
    }

    if (
      isPaymentAction &&
      contest.post_contest_status !== "verification_complete"
    ) {
      return NextResponse.json(
        {
          error:
            "Payments can only be processed when contest status is 'verification_complete'",
        },
        { status: 400 },
      );
    }

    // Allow status updates for leaderboard, CPM, milestone, and dual rewards contests
    if (
      !contest.contest_type ||
      !["leaderboard", "cpm", "milestone", "dual_rewards"].includes(
        contest.contest_type,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid contest type. Only leaderboard, CPM, milestone, and dual rewards contests are supported",
        },
        { status: 400 },
      );
    }

    // We may need submission.earnings and creator_id for payments
    // Fetch submission with earnings and creator_id
    const { data: submissionFull, error: submissionFullErr } = await supabase
      .from("submissions")
      .select(
        "id, contest_id, creator_id, status, earnings, views, paid, paid_at, bonus_paid, bonus_paid_at, bonus_amount, created_at, platform, other_stats, milestone_bonus_paid, metadata, dual_rewards_payout",
      )
      .eq("id", submissionId)
      .single();
    if (submissionFullErr || !submissionFull) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    // Guard against duplicate payments
    if (isPaymentAction) {
      const tryingStandard =
        action === SUBMISSION_STATUS.paid || action === "mark_both_paid";
      const tryingBonus =
        action === "mark_bonus_paid" || action === "mark_both_paid";

      if (tryingStandard && submissionFull.paid) {
        return NextResponse.json(
          { error: "This submission has already been paid" },
          { status: 409 },
        );
      }
      if (tryingBonus && submissionFull.bonus_paid) {
        return NextResponse.json(
          { error: "Bonus has already been paid for this submission" },
          { status: 409 },
        );
      }
    }

    const shouldMarkPaid =
      action === SUBMISSION_STATUS.paid || action === "mark_both_paid";
    const normalizedStatus =
      action === "mark_bonus_paid"
        ? submission.status
        : shouldMarkPaid
          ? SUBMISSION_STATUS.paid
          : action;

    // Update the submission status
    const updateData: any = {
      // Payment actions finalize status only after wallet credit succeeds.
      status: isPaymentAction ? submission.status : normalizedStatus,
    };

    // Clear views_locked when changing status to pending or rejected
    if (action === "pending" || action === "rejected") {
      updateData.views_locked = null;
    }

    // Use the metadata column to store structured metadata as JSON
    if (action === "rejected" && reason) {
      // Parse reason and additional notes if they exist
      const reasonParts = reason.split("\n\nAdditional Notes:");
      const mainReason = reasonParts[0].trim();
      const additionalNotes = reasonParts[1] ? reasonParts[1].trim() : null;

      // Store the reason as provided by the client (modal now sends human-readable labels)
      const displayReason = mainReason;

      // Store rejection metadata
      updateData.metadata = {
        type: "rejection",
        reason: displayReason,
        additionalNotes: additionalNotes,
        timestamp: new Date().toISOString(),
        updatedBy: currentUserId,
      };
    } else if (shouldMarkPaid && paymentDetails) {
      if (contest.contest_type === "dual_rewards") {
        // Main split lives on `dual_rewards_payout`; do not persist payment audit blob on the row.
        updateData.metadata = null;
      } else {
        const rawRemarks = String(
          (paymentDetails as any)?.customRemarks || "",
        ).trim();
        const humanRemarks = stripDualComponentTagFromRemarks(rawRemarks);

        updateData.metadata = {
          type: "payment",
          paymentProofUrl: paymentDetails.paymentProofUrl || null,
          paymentDescription: paymentDetails.paymentDescription || null,
          customRemarks: humanRemarks || null,
          timestamp: new Date().toISOString(),
          updatedBy: currentUserId,
        };
      }
    } else if (action === "verified" || action === "pending") {
      // Clear metadata for verified/pending status
      updateData.metadata = null;
      updateData.dual_rewards_payout = null;
    }

    // Use admin client to bypass RLS for the update operation
    const supabaseAdmin = createAdminClient();

    // Dual rewards: creator-scoped cap data; contest-wide fetch only for milestone FCFS.
    let dualCreatorCapMaps: DualCreatorCapMaps | null = null;
    let dualCreatorCapFetchError: string | null = null;
    const ensureDualCreatorCapMaps = async (): Promise<DualCreatorCapMaps> => {
      const empty: DualCreatorCapMaps = {
        milestoneCappedBySubmissionId: new Map(),
        cpmCappedBySubmissionId: new Map(),
      };
      if (contest.contest_type !== "dual_rewards") return empty;
      if (dualCreatorCapMaps) return dualCreatorCapMaps;

      const milestones = Array.isArray(
        (contest as any)?.contest_based_details?.milestone_contest?.milestones,
      )
        ? (contest as any).contest_based_details.milestone_contest.milestones
        : [];
      const cpmCfg = (contest as any)?.contest_based_details?.cpm_contest;
      const maxCap = Number(maxEarningsPerCreator || 0);

      const result = await loadDualCreatorCapMaps(
        supabaseAdmin,
        submissionFull.contest_id,
        String(submissionFull.creator_id),
        milestones,
        cpmCfg,
        maxCap,
      );
      if (result.error) {
        dualCreatorCapFetchError = result.error;
        dualCreatorCapMaps = empty;
        return empty;
      }
      dualCreatorCapMaps = result.maps ?? empty;
      return dualCreatorCapMaps;
    };

    const { data: updatedSubmission, error: updateError } = await supabaseAdmin
      .from("submissions")
      .update(updateData)
      .eq("id", submissionId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating submission status:", updateError);
      return NextResponse.json(
        { error: "Failed to update submission status" },
        { status: 500 },
      );
    }

    // Note: budget_spent is updated via scheduled cron jobs and manual "Refresh Metrics" button
    // This improves scalability by avoiding O(n) recalculation on every submission status change
    // Budget will be updated on next metrics refresh (typically within 10-15 minutes)

    // Snapshot views and credit creator totals when entering verified/paid (idempotent via delta)
    if (
      action === SUBMISSION_STATUS.verified ||
      action === SUBMISSION_STATUS.paid
    ) {
      const currentViews = submissionFull.views || 0;

      // Read prior credited snapshot (0 if none)
      const { data: priorSnap, error: priorErr } = await supabaseAdmin
        .from("submission_views_credited")
        .select("credited_views")
        .eq("submission_id", submissionId)
        .maybeSingle();
      if (priorErr) {
        console.error("Failed to read prior credited snapshot:", priorErr);
      }
      const priorCredited = (priorSnap?.credited_views as number) || 0;
      const delta = Math.max(0, currentViews - priorCredited);

      // Credit creator total_views by delta
      if (delta > 0) {
        try {
          const currentTotal = await MetricsService.getCreatorField(
            submissionFull.creator_id,
            "total_views",
          );
          const { error: updCreatorErr } = await supabaseAdmin
            .from("creator_profiles")
            .update({ total_views: currentTotal + delta })
            .eq("id", submissionFull.creator_id);
          if (updCreatorErr) {
            console.error(
              "Failed to update creator total_views:",
              updCreatorErr,
            );
          }
        } catch (e) {
          console.error("Error while crediting creator total_views:", e);
        }
      }

      // Upsert snapshot to current
      const { error: snapErr } = await supabaseAdmin
        .from("submission_views_credited")
        .upsert(
          {
            submission_id: submissionId,
            credited_views: currentViews,
            credited_at: new Date().toISOString(),
          },
          { onConflict: "submission_id" },
        );
      if (snapErr) {
        console.error("Failed to snapshot credited views:", snapErr);
      }

      // Persist locked views on the submission row only (contest-wide timestamp lives on contests)
      try {
        const { error: lockErr } = await supabaseAdmin
          .from("submissions")
          .update({
            // per-submission locked views snapshot
            views_locked: currentViews,
          })
          .eq("id", submissionId);
        if (lockErr) {
          console.error("Failed to update submission views_locked:", lockErr);
        }
      } catch (e) {
        console.warn("Skipping submission views_locked update due to error.");
      }
    }

    let bonusOutcome:
      | "credited"
      | "skipped_cap"
      | "skipped_adjustment_to_zero"
      | "skipped_not_expected"
      | null = null;

    // Handle flat fee bonus payments
    if (action === "mark_bonus_paid" || action === "mark_both_paid") {
      if (contest.contest_type === "dual_rewards") {
        const milestones = Array.isArray(
          (contest as any)?.contest_based_details?.milestone_contest
            ?.milestones,
        )
          ? (contest as any).contest_based_details.milestone_contest.milestones
          : [];

        if (milestones.length === 0) {
          return NextResponse.json(
            { error: "No milestones configured for this dual rewards contest" },
            { status: 400 },
          );
        }

        if (
          submissionFull.status !== SUBMISSION_STATUS.verified &&
          submissionFull.status !== SUBMISSION_STATUS.paid
        ) {
          return NextResponse.json(
            {
              error:
                "Submission must be verified before paying milestone reward",
            },
            { status: 400 },
          );
        }

        if (!submissionFull.bonus_paid) {
          const capMaps = await ensureDualCreatorCapMaps();
          if (dualCreatorCapFetchError) {
            return NextResponse.json(
              {
                error: "Failed to compute milestone payout eligibility",
                details: dualCreatorCapFetchError,
              },
              { status: 500 },
            );
          }

          let milestoneAmount =
            capMaps.milestoneCappedBySubmissionId.get(
              String(submissionFull.id),
            ) ?? 0;

          const adjPct = Number(
            (contest as any).payout_adjustment_percentage ?? 0,
          );
          const adjMode = (contest as any).payout_adjustment_mode as
            | string
            | null
            | undefined;
          if (
            adjPct > 0 &&
            adjMode &&
            dualRewardsPayoutAdjustmentAppliesToMilestone(adjMode)
          ) {
            milestoneAmount = applyPayoutAdjustment(milestoneAmount, adjPct);
          }

          if (milestoneAmount <= 0) {
            return NextResponse.json(
              {
                error:
                  "No milestone payout available for this submission (eligibility/caps may apply)",
              },
              { status: 400 },
            );
          }

          const [
            { data: existingBonusRewards },
            { data: existingBonusRefunds },
          ] = await Promise.all([
            supabaseAdmin
              .from("money_transactions")
              .select("id")
              .eq("user_id", submissionFull.creator_id)
              .eq("type", "reward")
              .contains("metadata", {
                source_submission_id: submissionId,
                payout_component: "milestone",
              }),
            supabaseAdmin
              .from("money_transactions")
              .select("id, remarks")
              .eq("user_id", submissionFull.creator_id)
              .eq("type", "refund")
              .contains("metadata", {
                source_submission_id: submissionId,
                payout_component: "milestone",
              }),
          ] as any);

          const bonusRewardsCount = (existingBonusRewards || []).length;
          const bonusRefundsCount = (existingBonusRefunds || []).filter(
            (r: any) => !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK,
          ).length;
          const nextBonusCycle =
            bonusRewardsCount > bonusRefundsCount
              ? bonusRewardsCount
              : bonusRewardsCount + 1;
          const idempotencyKey = `milestone_bonus:v1:${submissionId}:cycle:${nextBonusCycle}`;

          const creditResult = await creditCreatorWithdrawableBalance(
            submissionFull.creator_id,
            milestoneAmount,
            `Milestone reward for submission in contest ${
              contest.title || "Contest"
            }`,
            {
              idempotencyKey,
              remarks:
                paymentDetails?.customRemarks ||
                "Milestone reward credited to creator wallet",
              metadata: {
                source_submission_id: submissionId,
                contest_id: submissionFull.contest_id,
                payout_component: "milestone",
                payout_cycle: nextBonusCycle,
              },
            },
          );

          if (!creditResult.success) {
            return NextResponse.json(
              {
                error: `Failed to credit milestone reward: ${creditResult.error}`,
              },
              { status: 500 },
            );
          }

          const { data: afterBonusUpdate, error: bonusUpdateError } =
            await supabaseAdmin
              .from("submissions")
              .update({
                bonus_paid: true,
                bonus_paid_at: new Date().toISOString(),
                bonus_amount: milestoneAmount,
                milestone_bonus_paid: {
                  ...(submissionFull.milestone_bonus_paid || {}),
                  paid_at: new Date().toISOString(),
                  amount_cents: milestoneAmount,
                },
              })
              .eq("id", submissionId)
              .select(
                "id, status, earnings, paid, paid_at, bonus_paid, bonus_paid_at, bonus_amount, milestone_bonus_paid",
              )
              .single();

          if (bonusUpdateError) {
            return NextResponse.json(
              {
                error:
                  "Milestone reward was credited but failed to mark submission bonus_paid — retry; duplicate wallet credits are suppressed by idempotency.",
                details: bonusUpdateError.message,
              },
              { status: 500 },
            );
          }
          if (afterBonusUpdate) {
            Object.assign(updatedSubmission, afterBonusUpdate);
          }
        }

        if (action === "mark_bonus_paid") {
          return NextResponse.json({
            success: true,
            message: "Milestone reward paid successfully",
            submission: updatedSubmission,
          });
        }
      }

      if (contest.contest_type !== "dual_rewards") {
        // Get flat fee bonus from contest details based on contest type
        const contestDetails =
          contest.contest_type === "cpm"
            ? (contest.contest_based_details as any)?.cpm_contest
            : (contest.contest_based_details as any)?.leaderboard_contest;

        const flatFeeBonus = contestDetails?.flat_fee_bonus || 0;
        const totalBudget = contestDetails?.total_budget || null;
        const flatFeeBonusCap = contestDetails?.flat_fee_bonus_cap || null;

      const submissionStatusLower = String(
        submissionFull.status || "",
      ).toLowerCase();
      const isBonusEligibleStatus =
        submissionStatusLower === "verified" ||
        submissionStatusLower === "approved" ||
        // Allow paying bonus after the standard reward has already been paid.
        // Only valid for mark_bonus_paid; mark_both_paid still requires verified
        // because we cannot pay the main reward twice.
        (action === "mark_bonus_paid" &&
          (submissionStatusLower === "paid" || submissionFull.paid === true));

      if (flatFeeBonus > 0 && isBonusEligibleStatus) {
        // Fetch every contest submission and let `buildFlatFeeBonusExpectedCentsBySubmissionId`
        // apply its internal eligibility rule (status in verified/approved/paid OR paid=true).
        // Pre-filtering with PostgREST `.or(...)` is unsafe here because commas inside
        // `in.(...)` collide with the `.or()` separator and return an empty result.
        const { data: allEligibleContestSubs } = await supabaseAdmin
          .from("submissions")
          .select("id, created_at, status, paid")
          .eq("contest_id", submissionFull.contest_id);
        const expectedBonusMap = buildFlatFeeBonusExpectedCentsBySubmissionId(
          contest as any,
          (allEligibleContestSubs || []).map((s: any) => ({
            id: String(s.id),
            created_at: s.created_at,
            status: s.status,
            paid: s.paid === true,
          })),
        );
        const expectedBonusForSubmission =
          expectedBonusMap.get(String(submissionId)) || 0;
        if (expectedBonusForSubmission <= 0) {
          bonusOutcome = "skipped_not_expected";
          if (action === "mark_bonus_paid") {
            return NextResponse.json(
              {
                success: true,
                skipped: true,
                bonus_reason: "BONUS_NOT_ELIGIBLE",
                submission: updatedSubmission,
              },
              { status: 200 },
            );
          }
        }

        // Calculate current bonus spending
        const { data: bonusSpendingData } = await supabaseAdmin
          .from("submissions")
          .select("bonus_amount")
          .eq("contest_id", submissionFull.contest_id)
          .eq("bonus_paid", true);

          const currentBonusSpent = (bonusSpendingData || []).reduce(
            (sum, sub) => sum + (sub.bonus_amount || 0),
            0,
          );

        const budgetLimit =
          contest.contest_type === "leaderboard"
            ? totalBudget
            : contest.contest_type === "cpm"
              ? flatFeeBonusCap
              : null;
        const remainingBonusBudget =
          budgetLimit != null
            ? Math.max(0, budgetLimit - currentBonusSpent)
            : null;
        const rawBonusAllocation = allocateFlatFeeBonusCents(
          flatFeeBonus,
          remainingBonusBudget,
        );
        const adjustedBonusAllocation = adjustBonusCents(
          rawBonusAllocation.amount,
          {
            shouldAdjustBonus: payoutAdjustment.shouldAdjustBonus,
            percentage: payoutAdjustment.percentage,
          },
        );
        // Check if bonus already paid
        if (!submissionFull.bonus_paid) {
          const [
            { data: existingRewardsForSubmission },
            { data: existingBonusRewards },
            { data: existingBonusRefunds },
          ] = await Promise.all([
            supabaseAdmin
              .from("money_transactions")
              .select("id, metadata")
              .eq("user_id", submissionFull.creator_id)
              .eq("type", "reward")
              .contains("metadata", {
                submission_id: submissionId,
              }),
            supabaseAdmin
              .from("money_transactions")
              .select("id, metadata")
              .eq("user_id", submissionFull.creator_id)
              .eq("type", "reward")
              .contains("metadata", {
                submission_id: submissionId,
                bonus_type: "flat_fee",
              }),
            supabaseAdmin
              .from("money_transactions")
              .select("id, remarks")
              .eq("user_id", submissionFull.creator_id)
              .eq("type", "refund")
              .contains("metadata", {
                submission_id: submissionId,
                bonus_type: "flat_fee",
              }),
          ] as any);
          const bonusRewardsCount = (existingBonusRewards || []).length;
          const bonusRefundsCount = (existingBonusRefunds || []).filter(
            (r: any) => !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK,
          ).length;
          const nextBonusCycle =
            bonusRewardsCount > bonusRefundsCount
              ? bonusRewardsCount
              : bonusRewardsCount + 1;
          const occupiedRewardCycles = new Set(
            (existingRewardsForSubmission || []).map((r: any) =>
              getTransactionPayoutCycle(r?.metadata),
            ),
          );
          let resolvedBonusCycle = nextBonusCycle;
          while (occupiedRewardCycles.has(resolvedBonusCycle)) {
            resolvedBonusCycle += 1;
          }
          const flatFeeBonusIdempotencyKey = `flat_fee_bonus:v2:${submissionId}:cycle:${resolvedBonusCycle}`;

          if (adjustedBonusAllocation <= 0) {
            bonusOutcome =
              rawBonusAllocation.reason === "partial_remainder"
                ? "skipped_adjustment_to_zero"
                : "skipped_cap";
            if (action === "mark_bonus_paid") {
              return NextResponse.json(
                {
                  success: true,
                  skipped: true,
                  bonus_reason:
                    rawBonusAllocation.reason === "partial_remainder"
                      ? "BONUS_PARTIAL_REMAINDER_TO_ZERO_AFTER_ADJUSTMENT"
                      : "BONUS_CAP_REACHED",
                  submission: updatedSubmission,
                },
                { status: 200 },
              );
            }
          }

          if (adjustedBonusAllocation > 0) {
            bonusOutcome = "credited";
            const creditResult = await creditCreatorWithdrawableBalance(
              submissionFull.creator_id,
              adjustedBonusAllocation,
              `Flat fee bonus for submission in contest ${
                contest.title || "Contest"
              }`,
              {
                idempotencyKey: flatFeeBonusIdempotencyKey,
                remarks:
                  paymentDetails?.customRemarks ||
                  "Flat fee bonus credited to creator wallet",
                metadata: {
                  submission_id: submissionId,
                  contest_id: submissionFull.contest_id,
                  bonus_type: "flat_fee",
                  payout_cycle: resolvedBonusCycle,
                  bonus_reason: rawBonusAllocation.reason,
                  original_bonus_amount: flatFeeBonus,
                  adjusted_bonus_amount: adjustedBonusAllocation,
                },
              },
            );

            if (!creditResult.success) {
              return NextResponse.json(
                {
                  error: `Failed to credit flat fee bonus: ${creditResult.error}`,
                },
                { status: 500 },
              );
            }

            const { data: afterBonusUpdate, error: bonusUpdateError } =
              await supabaseAdmin
                .from("submissions")
                .update({
                  bonus_paid: true,
                  bonus_paid_at: new Date().toISOString(),
                  bonus_amount: adjustedBonusAllocation, // Store actual bonus amount paid (in cents)
                })
                .eq("id", submissionId)
                .select(
                  "id, status, earnings, paid, paid_at, bonus_paid, bonus_paid_at, bonus_amount",
                )
                .single();

            if (bonusUpdateError) {
              console.error(
                "Error updating bonus_paid status:",
                bonusUpdateError,
              );
              return NextResponse.json(
                {
                  error:
                    "Bonus was credited but failed to mark submission bonus_paid — retry the same operation; duplicate wallet credits are suppressed by idempotency.",
                  details: bonusUpdateError.message,
                },
                { status: 500 },
              );
            }
            if (afterBonusUpdate) {
              Object.assign(updatedSubmission, afterBonusUpdate);
            }
          }
        }
      } else if (flatFeeBonus <= 0) {
        return NextResponse.json(
          { error: "No flat fee bonus configured for this contest" },
          { status: 400 },
        );
      } else if (!isBonusEligibleStatus) {
        return NextResponse.json(
          {
            error:
              action === "mark_bonus_paid"
                ? "Bonus can only be paid on verified submissions or already-paid submissions whose bonus has not been paid yet."
                : "Submission must be verified before paying bonus",
          },
          { status: 400 },
        );
      }
      }
    }

    // If action is mark_both_paid, continue to regular payment logic
    // Otherwise, return success for mark_bonus_paid
    if (action === "mark_bonus_paid") {
      return NextResponse.json({
        success: true,
        message: "Flat fee bonus paid successfully",
        submission: updatedSubmission,
      });
    }

    // Process payment inline to ensure money_transactions are created immediately
    // This ensures TikTok payments work the same as Instagram bulk payments
    if (action === SUBMISSION_STATUS.paid || action === "mark_both_paid") {
      // Handle wallet credit/debit on status changes
      if (action === SUBMISSION_STATUS.paid || action === "mark_both_paid") {
        // Determine amount: custom from paymentDetails or default to earnings
        const customAmount =
          paymentDetails?.amountInCents && paymentDetails?.isCustom
            ? Number(paymentDetails.amountInCents)
            : null;
        const customRemarks = (paymentDetails as any)?.customRemarks as
          | string
          | undefined;

        const shouldAdjustReward = payoutAdjustment.shouldAdjustReward;

        let rewardAmount = 0;
        let dualRewardsPayoutJson: {
          cpm_cents: number;
          milestone_cents: number;
        } | null = null;

        if (customAmount && customAmount > 0) {
          rewardAmount = customAmount;
        } else if (contest.contest_type === "milestone") {
          const milestoneDetails = (contest as any)?.contest_based_details
            ?.milestone_contest;
          const milestones = Array.isArray(milestoneDetails?.milestones)
            ? milestoneDetails.milestones
            : [];

          if (milestones.length > 0) {
            const { data: payoutEligibleSubs, error: payoutSubsErr } =
              await supabaseAdmin
                .from("submissions")
                .select(
                  "id, creator_id, status, views, created_at, platform, other_stats",
                )
                .eq("contest_id", submissionFull.contest_id)
                .in("status", ["pending", "verified", "paid"])
                .order("created_at", { ascending: true });

            if (!payoutSubsErr && Array.isArray(payoutEligibleSubs)) {
              const records = payoutEligibleSubs.map((sub: any) => ({
                id: String(sub.id),
                creator_id: sub.creator_id,
                created_at: sub.created_at,
                status: sub.status,
                views: sub.views,
                platform: sub.platform,
                other_stats: sub.other_stats,
              }));
              const payoutBySubmissionId =
                buildMilestoneSubmissionPayoutCentsMap(records, milestones);

              const { data: creatorSubs, error: creatorSubsErr } =
                await supabaseAdmin
                  .from("submissions")
                  .select("id, created_at")
                  .eq("contest_id", submissionFull.contest_id)
                  .eq("creator_id", submissionFull.creator_id);

              const creatorRows =
                Array.isArray(creatorSubs) && !creatorSubsErr
                  ? creatorSubs.map((r: any) => ({
                      id: String(r.id),
                      created_at: r.created_at,
                    }))
                  : [
                      {
                        id: String(submissionFull.id),
                        created_at:
                          submissionFull.created_at ||
                          new Date(0).toISOString(),
                      },
                    ];

              const cappedBase =
                getMilestoneCappedPayoutCentsForCreatorSubmission(
                  payoutBySubmissionId,
                  creatorRows,
                  maxEarningsPerCreator,
                  String(submissionFull.id),
                );

              rewardAmount = cappedBase;
            }
          }
        } else {
          rewardAmount = Number(submissionFull.earnings) || 0;

          // Fallback amount computation when earnings are not yet set
          if ((!rewardAmount || rewardAmount <= 0) && !customAmount) {
            if (
              contest.contest_type === "cpm" ||
              contest.contest_type === "dual_rewards"
            ) {
              const cpm = (contest as any)?.contest_based_details?.cpm_contest;
              const rate =
                typeof cpm?.cpm_rate_usd === "number" ? cpm.cpm_rate_usd : 0;
              let effectiveViews = submissionFull.views || 0;
              if (
                typeof cpm?.min_views === "number" &&
                effectiveViews < cpm.min_views
              )
                effectiveViews = 0;
              if (
                typeof cpm?.max_views === "number" &&
                effectiveViews > cpm.max_views
              )
                effectiveViews = cpm.max_views;
              
              const rawAmount = Math.round(((effectiveViews * rate) / 1000) * 100); // cents
              let finalCpmCappedAmount = rawAmount;
              
              if (maxEarningsPerCreator && maxEarningsPerCreator > 0) {
                const maxCap = Number(maxEarningsPerCreator);
                if (contest.contest_type === "dual_rewards") {
                  const milestones = Array.isArray(
                    (contest as any)?.contest_based_details?.milestone_contest
                      ?.milestones,
                  )
                    ? (contest as any).contest_based_details.milestone_contest
                        .milestones
                    : [];
                  if (milestones.length > 0) {
                    const capMaps = await ensureDualCreatorCapMaps();
                    if (!dualCreatorCapFetchError) {
                      finalCpmCappedAmount =
                        capMaps.cpmCappedBySubmissionId.get(
                          String(submissionFull.id),
                        ) ?? rawAmount;
                    }
                  } else {
                    const { data: creatorSubs } = await supabaseAdmin
                      .from("submissions")
                      .select("id, views, status")
                      .eq("contest_id", submissionFull.contest_id)
                      .eq("creator_id", submissionFull.creator_id)
                      .in("status", ["pending", "verified", "paid"])
                      .order("created_at", { ascending: true });

                    if (creatorSubs) {
                      let runningTotal = 0;
                      for (const sub of creatorSubs) {
                        let subViews = sub.views || 0;
                        if (
                          typeof cpm?.min_views === "number" &&
                          subViews < cpm.min_views
                        )
                          subViews = 0;
                        if (
                          typeof cpm?.max_views === "number" &&
                          subViews > cpm.max_views
                        )
                          subViews = cpm.max_views;
                        const subRawAmount = Math.round(
                          ((subViews * rate) / 1000) * 100,
                        );

                        let subCapped = subRawAmount;
                        if (
                          runningTotal + subRawAmount >
                          maxEarningsPerCreator
                        ) {
                          subCapped = Math.max(
                            0,
                            maxEarningsPerCreator - runningTotal,
                          );
                        }

                        if (String(sub.id) === String(submissionFull.id)) {
                          finalCpmCappedAmount = subCapped;
                          break;
                        }
                        runningTotal += subCapped;
                      }
                    }
                  }
                } else {
                  const { data: creatorSubs } = await supabaseAdmin
                    .from("submissions")
                    .select("id, views, status")
                    .eq("contest_id", submissionFull.contest_id)
                    .eq("creator_id", submissionFull.creator_id)
                    .in("status", ["pending", "verified", "paid"])
                    .order("created_at", { ascending: true });

                  if (creatorSubs) {
                    let runningTotal = 0;
                    for (const sub of creatorSubs) {
                      let subViews = sub.views || 0;
                      if (
                        typeof cpm?.min_views === "number" &&
                        subViews < cpm.min_views
                      )
                        subViews = 0;
                      if (
                        typeof cpm?.max_views === "number" &&
                        subViews > cpm.max_views
                      )
                        subViews = cpm.max_views;
                      const subRawAmount = Math.round(
                        ((subViews * rate) / 1000) * 100,
                      );

                      let subCapped = subRawAmount;
                      if (
                        runningTotal + subRawAmount > maxEarningsPerCreator
                      ) {
                        subCapped = Math.max(
                          0,
                          maxEarningsPerCreator - runningTotal,
                        );
                      }

                      if (String(sub.id) === String(submissionFull.id)) {
                        finalCpmCappedAmount = subCapped;
                        break;
                      }
                      runningTotal += subCapped;
                    }
                  }
                }
              }
              
              rewardAmount = finalCpmCappedAmount;
            } else if (contest.contest_type === "leaderboard") {
              // Compute prize by rank among verified (and already paid) submissions only
              const { count: higherViewsCount } = await supabase
                .from("submissions")
                .select("id", { count: "exact", head: true })
                .eq("contest_id", submissionFull.contest_id)
                .in("status", ["verified", "paid"])
                .gt("views", submissionFull.views || 0);
              const rank = (higherViewsCount || 0) + 1;
              const prizes =
                (contest as any)?.contest_based_details?.leaderboard_contest
                  ?.prizes || [];
              const prizeForRank = prizes.find((p: any) => p.position === rank);
              rewardAmount = prizeForRank?.amount || 0; // already in cents
            }
          }

          // Keep single-item CPM payout parity with bulk route creator cap logic.
          if (
            contest.contest_type === "cpm" &&
            !customAmount &&
            typeof (contest as any).max_earnings_per_creator === "number"
          ) {
            const maxEarningsPerCreator = Number(
              (contest as any).max_earnings_per_creator,
            );
            const { data: creatorSubmissions } = await supabaseAdmin
              .from("submissions")
              .select("id, created_at, earnings, views, status")
              .eq("contest_id", submissionFull.contest_id)
              .eq("creator_id", submissionFull.creator_id)
              .in("status", ["verified", "paid"])
              .order("created_at", { ascending: true });

            if (creatorSubmissions && creatorSubmissions.length > 0) {
              const cpm = (contest as any)?.contest_based_details?.cpm_contest;
              const rate =
                typeof cpm?.cpm_rate_usd === "number" ? cpm.cpm_rate_usd : 0;
              let runningTotal = 0;
              let cappedForSubmission = 0;

              for (const row of creatorSubmissions) {
                let baseAmount = Number((row as any).earnings) || 0;
                if (baseAmount <= 0) {
                  let effectiveViews = Number((row as any).views) || 0;
                  if (
                    typeof cpm?.min_views === "number" &&
                    effectiveViews < cpm.min_views
                  ) {
                    effectiveViews = 0;
                  }
                  if (
                    typeof cpm?.max_views === "number" &&
                    effectiveViews > cpm.max_views
                  ) {
                    effectiveViews = cpm.max_views;
                  }
                  baseAmount = Math.round(
                    ((effectiveViews * rate) / 1000) * 100,
                  );
                }

                let applied = baseAmount;
                if (maxEarningsPerCreator > 0) {
                  if (runningTotal + applied > maxEarningsPerCreator) {
                    const remaining = Math.max(
                      0,
                      maxEarningsPerCreator - runningTotal,
                    );
                    applied = remaining;
                  }
                }
                runningTotal += applied;

                if (String((row as any).id) === String(submissionId)) {
                  cappedForSubmission = applied;
                  break;
                }
              }

              rewardAmount = cappedForSubmission;
            }
          }
        }
        if (
          contest.contest_type === "dual_rewards" &&
          customAmount &&
          customAmount > 0 &&
          rewardAmount > 0
        ) {
          const componentMatch = String(customRemarks || "").match(
            /dual_component:(cpm|milestone|both)/i,
          );
          const dualPayComponent = componentMatch?.[1]?.toLowerCase() as
            | "cpm"
            | "milestone"
            | "both"
            | undefined;
          if (dualPayComponent) {
            const milestones = Array.isArray(
              (contest as any)?.contest_based_details?.milestone_contest
                ?.milestones,
            )
              ? (contest as any).contest_based_details.milestone_contest
                  .milestones
              : [];
            const capMaps = await ensureDualCreatorCapMaps();
            if (dualCreatorCapFetchError) {
              return NextResponse.json(
                {
                  error:
                    "Failed to validate dual payment against creator cap",
                  details: dualCreatorCapFetchError,
                },
                { status: 500 },
              );
            }

            const { milestoneCappedBySubmissionId, cpmCappedBySubmissionId } =
              capMaps;
            const mCap =
              milestoneCappedBySubmissionId.get(String(submissionFull.id)) ?? 0;
            const cCap =
              cpmCappedBySubmissionId.get(String(submissionFull.id)) ?? 0;

            const pct = Number(
              (contest as any).payout_adjustment_percentage ?? 0,
            );
            const mode = (contest as any).payout_adjustment_mode as
              | string
              | null
              | undefined;
            const hasAdj = pct > 0 && !!mode;
            const adjCpm =
              hasAdj && dualRewardsPayoutAdjustmentAppliesToCpm(mode);
            const adjMs =
              hasAdj && dualRewardsPayoutAdjustmentAppliesToMilestone(mode);
            const mFinal = adjMs ? applyPayoutAdjustment(mCap, pct) : mCap;
            const cFinal = adjCpm ? applyPayoutAdjustment(cCap, pct) : cCap;

            let maxAllowed = 0;
            if (dualPayComponent === "cpm") maxAllowed = cFinal;
            else if (dualPayComponent === "milestone") maxAllowed = mFinal;
            else maxAllowed = cFinal + mFinal;

            if (maxAllowed <= 0) {
              return NextResponse.json(
                {
                  error:
                    "No payable CPM or milestone amount for this submission under the creator earnings cap.",
                },
                { status: 400 },
              );
            }
            if (rewardAmount > maxAllowed + 1) {
              return NextResponse.json(
                {
                  error: `Custom payout (${rewardAmount}¢) exceeds the allowed amount for this dual-rewards payment (${maxAllowed}¢).`,
                },
                { status: 400 },
              );
            }
            if (dualPayComponent === "cpm") {
              dualRewardsPayoutJson = {
                cpm_cents: rewardAmount,
                milestone_cents: 0,
              };
            } else if (dualPayComponent === "milestone") {
              dualRewardsPayoutJson = {
                cpm_cents: 0,
                milestone_cents: rewardAmount,
              };
            } else {
              dualRewardsPayoutJson = {
                cpm_cents: cFinal,
                milestone_cents: mFinal,
              };
            }
          }
        }
        if (rewardAmount > 0) {
          if (!customAmount) {
            rewardAmount = adjustRewardCents(rewardAmount, {
              shouldAdjustReward,
              percentage: payoutAdjustment.percentage,
            });
          }

          if (
            contest.contest_type === "dual_rewards" &&
            rewardAmount > 0 &&
            !dualRewardsPayoutJson
          ) {
            dualRewardsPayoutJson = {
              cpm_cents: rewardAmount,
              milestone_cents: 0,
            };
          }

          // Determine payout cycle, allowing repay after full refund
          const { data: existingRewards } = await supabaseAdmin
            .from("money_transactions")
            .select("id, metadata")
            .eq("user_id", submissionFull.creator_id)
            .eq("type", "reward")
            .contains("metadata", { submission_id: submissionId });

          const { data: existingRefunds } = await supabaseAdmin
            .from("money_transactions")
            .select("id, remarks, metadata")
            .eq("user_id", submissionFull.creator_id)
            .eq("type", "refund")
            .contains("metadata", { submission_id: submissionId });

          const mainRewards = (existingRewards || []).filter(
            (r: any) =>
              !r?.metadata?.bonus_type && !r?.metadata?.payout_component,
          );
          const mainRefunds = (existingRefunds || []).filter(
            (r: any) =>
              !r?.metadata?.bonus_type && !r?.metadata?.payout_component,
          );

          const rewardsCount = mainRewards.length;
          const refundsCount =
            mainRefunds?.filter(
              (r: any) =>
                !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK,
            ).length || 0;
          const nextCycle =
            rewardsCount > refundsCount ? rewardsCount : rewardsCount + 1;
          const occupiedRewardCycles = new Set(
            (existingRewards || []).map((r: any) =>
              getTransactionPayoutCycle(r?.metadata),
            ),
          );
          let resolvedNextCycle = nextCycle;
          while (occupiedRewardCycles.has(resolvedNextCycle)) {
            resolvedNextCycle += 1;
          }

          // Check duplicate reward in this cycle
          const { data: rewardInThisCycle } = await supabaseAdmin
            .from("money_transactions")
            .select("id, metadata")
            .eq("user_id", submissionFull.creator_id)
            .eq("type", "reward")
            .contains("metadata", {
              submission_id: submissionId,
              payout_cycle: resolvedNextCycle,
            });

          const contestRewardIdempotencyKey = customAmount
            ? `contest_reward:v1:${submissionId}:cycle:${resolvedNextCycle}:amt:${rewardAmount}`
            : `contest_reward:v1:${submissionId}:cycle:${resolvedNextCycle}`;

          const mainRewardInThisCycle = (rewardInThisCycle || []).filter(
            (r: any) =>
              !r?.metadata?.bonus_type && !r?.metadata?.payout_component,
          );

          if (mainRewardInThisCycle.length === 0) {
            const creditRes = await creditCreatorWithdrawableBalance(
              submissionFull.creator_id,
              rewardAmount,
              customAmount
                ? `Custom contest payment credited - ${
                    (contest as any)?.title || "Contest"
                  }`
                : `Contest reward credited - ${
                    (contest as any)?.title || "Contest"
                  }`,
              {
                idempotencyKey: contestRewardIdempotencyKey,
                remarks:
                  customRemarks ||
                  (customAmount
                    ? "Custom payout credited to creator wallet"
                    : "Standard payout credited to creator wallet"),
                metadata: {
                  contest_id: submissionFull.contest_id,
                  submission_id: submissionId,
                  payout_type: customAmount ? "custom" : "standard",
                  payout_cycle: resolvedNextCycle,
                },
              },
            );
            if (!creditRes.success) {
              return NextResponse.json(
                { error: `Failed to credit creator: ${creditRes.error}` },
                { status: 500 },
              );
            }
          }

          const shouldPersistEarnings =
            !!customAmount ||
            contest.contest_type === "milestone" ||
            !submissionFull.earnings ||
            submissionFull.earnings <= 0;

          const dualPersist =
            contest.contest_type === "dual_rewards"
              ? {
                  dual_rewards_payout:
                    rewardAmount > 0
                      ? buildDualRewardsPayoutPersistValue(
                          dualRewardsPayoutJson ?? {
                            cpm_cents: rewardAmount,
                            milestone_cents: 0,
                          },
                          {
                            updatedBy: currentUserId,
                            customRemarks: customRemarks ?? null,
                          },
                        )
                      : null,
                }
              : {};

          let paidPersistError:
            | { message: string; code?: string; details?: unknown }
            | undefined;
          if (shouldPersistEarnings) {
            const { error } = await supabaseAdmin
              .from("submissions")
              .update({
                earnings: rewardAmount,
                status: SUBMISSION_STATUS.paid,
                paid: true,
                paid_at: new Date().toISOString(),
                ...dualPersist,
              })
              .eq("id", submissionId);
            paidPersistError = error ?? undefined;
          } else {
            const { error } = await supabaseAdmin
              .from("submissions")
              .update({
                paid: true,
                status: SUBMISSION_STATUS.paid,
                paid_at: new Date().toISOString(),
                ...dualPersist,
              })
              .eq("id", submissionId);
            paidPersistError = error ?? undefined;
          }

          if (paidPersistError) {
            return NextResponse.json(
              {
                error:
                  "Reward was credited (or skipped as duplicate) but failed to mark submission paid — retry the same operation; duplicate wallet credits are suppressed by idempotency.",
                details: paidPersistError.message,
              },
              { status: 500 },
            );
          }

          try {
            await MetricsService.incrementSubmissionWin(
              submissionFull.creator_id,
              submissionFull.contest_id,
              submissionId,
            );
          } catch (e: unknown) {
            console.error("Metrics update (paid) failed:", e);
          }
        }
      }
    }

    // If status is changed away from paid, remove reward, reverse wallet credit, and clear earnings
    if (
      (action === SUBMISSION_STATUS.verified ||
        action === SUBMISSION_STATUS.pending ||
        action === SUBMISSION_STATUS.rejected) &&
      submission.status === SUBMISSION_STATUS.paid
    ) {
      const [
        { data: rewardTxns, error: rewardErr },
        { data: refundTxns, error: refundErr },
      ] = await Promise.all([
        supabaseAdmin
          .from("money_transactions")
          .select("id, amount, metadata")
          .eq("user_id", submissionFull.creator_id)
          .eq("type", "reward")
          .contains("metadata", { contest_id: submissionFull.contest_id }),
        supabaseAdmin
          .from("money_transactions")
          .select("id, amount, remarks, metadata")
          .eq("user_id", submissionFull.creator_id)
          .eq("type", "refund")
          .contains("metadata", { contest_id: submissionFull.contest_id }),
      ] as any);

      if (rewardErr || refundErr) {
        const message = rewardErr?.message || refundErr?.message || "unknown";
        return NextResponse.json(
          { error: `Failed to fetch transactions for reversal: ${message}` },
          { status: 500 },
        );
      }

      const isReversalRefund = (tx: any) =>
        !tx.remarks || tx.remarks === REVERSAL_TRANSACTION_REMARK;
      const isMainSubmissionTx = (tx: any) =>
        String(tx?.metadata?.submission_id || "") === String(submissionId) &&
        !tx?.metadata?.bonus_type &&
        !tx?.metadata?.payout_component;
      const isBonusSubmissionTx = (tx: any) => {
        const metadata = tx?.metadata || {};
        if (!metadata.bonus_type && !metadata.payout_component) return false;
        return (
          String(metadata.submission_id || "") === String(submissionId) ||
          String(metadata.source_submission_id || "") === String(submissionId)
        );
      };
      const sumAmount = (rows: any[]) =>
        rows.reduce(
          (sum: number, tx: any) => sum + (Number(tx.amount) || 0),
          0,
        );

      const mainRewardNet = Math.max(
        0,
        sumAmount((rewardTxns || []).filter(isMainSubmissionTx)) -
          sumAmount(
            (refundTxns || []).filter(
              (tx: any) => isReversalRefund(tx) && isMainSubmissionTx(tx),
            ),
          ),
      );
      const mainReversalAmount =
        Number(submissionFull.earnings) > 0
          ? Number(submissionFull.earnings)
          : mainRewardNet;

      const bonusRewards = (rewardTxns || []).filter(isBonusSubmissionTx);
      const bonusRefunds = (refundTxns || []).filter(
        (tx: any) => isReversalRefund(tx) && isBonusSubmissionTx(tx),
      );
      const bonusByType = new Map<string, number>();
      for (const tx of bonusRewards) {
        const key = String(tx?.metadata?.bonus_type || "bonus");
        bonusByType.set(
          key,
          (bonusByType.get(key) || 0) + (Number(tx.amount) || 0),
        );
      }
      for (const tx of bonusRefunds) {
        const key = String(tx?.metadata?.bonus_type || "bonus");
        bonusByType.set(
          key,
          (bonusByType.get(key) || 0) - (Number(tx.amount) || 0),
        );
      }
      let bonusReversals = Array.from(bonusByType.entries())
        .map(([bonusType, amount]) => ({
          bonusType,
          amount: Math.max(0, amount),
        }))
        .filter((row) => row.amount > 0);
      let bonusReversalAmount = bonusReversals.reduce(
        (sum, row) => sum + row.amount,
        0,
      );

      // If bonus was marked paid but ledger matching missed rows, still refund stored bonus_amount
      const storedBonusCents =
        submissionFull.bonus_paid === true
          ? Math.max(0, Number(submissionFull.bonus_amount) || 0)
          : 0;
      if (storedBonusCents > bonusReversalAmount) {
        bonusReversalAmount = storedBonusCents;
        bonusReversals = [
          { bonusType: "flat_fee_bonus", amount: storedBonusCents },
        ];
      }

      const reversalAmount = mainReversalAmount + bonusReversalAmount;

      paidStatusReversalSummary = {
        reward_refunded_cents: mainReversalAmount,
        bonus_refunded_cents: bonusReversalAmount,
        total_refunded_cents: reversalAmount,
      };

      if (reversalAmount > 0) {
        // Debit creator wallet once, then write explicit refund ledger rows.
        const debitRes = await debitCreatorWithdrawableBalance(
          submissionFull.creator_id,
          reversalAmount,
        );
        if (!debitRes.success) {
          return NextResponse.json(
            { error: `Failed to reverse creator credit: ${debitRes.error}` },
            { status: 500 },
          );
        }
        // Do NOT delete the original reward transactions. We only add a new explicit reversal entry.
        if (mainReversalAmount > 0) {
          await logTransactionAsAdmin(
            submissionFull.creator_id,
            "refund",
            mainReversalAmount,
            "success",
            `Reversal of contest reward - ${
              (contest as any)?.title || "Contest"
            }`,
            {
              remarks: REVERSAL_TRANSACTION_REMARK,
              paymentMethod: "refund",
              metadata: {
                submission_id: submissionId,
                contest_id: submissionFull.contest_id,
              },
            },
          );
        }
        for (const bonus of bonusReversals) {
          if (bonus.amount <= 0) continue;
          await logTransactionAsAdmin(
            submissionFull.creator_id,
            "refund",
            bonus.amount,
            "success",
            `Reversal of contest bonus - ${(contest as any)?.title || "Contest"}`,
            {
              remarks: REVERSAL_TRANSACTION_REMARK,
              paymentMethod: "refund",
              metadata: {
                submission_id: submissionId,
                source_submission_id: submissionId,
                contest_id: submissionFull.contest_id,
                payout_component: bonus.bonusType,
              },
            },
          );
        }
        // No longer keep earnings on reversal; it should be cleared when leaving Paid
      }

      // Revert submission/contest win counts whenever leaving Paid (not only when wallet debit runs)
      try {
        await MetricsService.decrementSubmissionWin(
          submissionFull.creator_id,
          submissionFull.contest_id,
          submissionFull.id,
        );
      } catch (e: any) {
        console.error("Metrics update (revert paid) failed:", e);
      }

      // Always clear paid/bonus state once we move away from Paid.
      await supabaseAdmin
        .from("submissions")
        .update({
          earnings: null,
          paid: false,
          paid_at: null,
          bonus_paid: false,
          bonus_paid_at: null,
          bonus_amount: null,
          milestone_bonus_paid: null,
          dual_rewards_payout: null,
        })
        .eq("id", submissionId);
    }

    // Note: With the new system, verified and pending submissions show in leaderboard immediately
    // Only rejected submissions are hidden from public view

    // Log the verification action (optional - for audit trail)
    // Always return the latest submission data (including updated earnings)
    const { data: latestSubmission } = await supabaseAdmin
      .from("submissions")
      .select(
        "id, status, earnings, paid, paid_at, bonus_paid, bonus_paid_at, bonus_amount, views, creator_id, created_at, contest_id, platform, other_stats, metadata, dual_rewards_payout",
      )
      .eq("id", submissionId)
      .single();

    let message = `Submission ${action} successfully${
      action === "rejected" ? ` with reason: ${reason}` : ""
    }`;
    if (paidStatusReversalSummary) {
      const s = paidStatusReversalSummary;
      const refundDetail =
        s.total_refunded_cents > 0
          ? ` Verification complete: refunded from creator withdrawable balance — ${formatCurrencyFromCents(s.reward_refunded_cents)} reward, ${formatCurrencyFromCents(s.bonus_refunded_cents)} bonus (${formatCurrencyFromCents(s.total_refunded_cents)} total).`
          : ` Verification complete: no reward or bonus was debited from the creator (nothing on record to refund). Paid and bonus-paid flags were cleared.`;
      message += refundDetail;
    }

    return NextResponse.json({
      success: true,
      submission: latestSubmission || updatedSubmission,
      message,
      ...(paidStatusReversalSummary
        ? { refund_summary: paidStatusReversalSummary }
        : {}),
      ...(action === "mark_both_paid" ? { bonus_outcome: bonusOutcome } : {}),
    });
  } catch (error: any) {
    console.error("Error in verification endpoint:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

// GET endpoint to fetch submissions for verification based on status filter
export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";

  try {
    // Get current user and check if they have admin privileges
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Check if user is admin or advertiser
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: "User data not found" },
        { status: 404 },
      );
    }

    if (userData.user_type !== "admin" && userData.user_type !== "advertiser") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Fetch submissions for verification from both leaderboard and CPM contests
    const { data: submissions, error: submissionsError } = await supabase
      .from("submissions")
      .select(
        `
        id,
        creator_id,
        contest_id,
        video_title,
        video_thumbnail_url,
        content_link,
        platform,
        views,
        earnings,
                 status,
         metadata,
        created_at,
        contests!inner(
          title,
          contest_type
        ),
        users!creator_id(
          username,
          full_name
        )
      `,
      )
      .eq("status", status)
      .in("contests.contest_type", ["leaderboard", "cpm"])
      .order("created_at", { ascending: false });

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError);
      return NextResponse.json(
        { error: "Failed to fetch submissions" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      submissions: submissions || [],
      status: status,
    });
  } catch (error: any) {
    console.error("Error in GET /api/admin/verify-submission:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
