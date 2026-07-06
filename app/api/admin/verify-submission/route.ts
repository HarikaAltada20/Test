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
import { getSubmissionViewsForCrediting } from "@/lib/submission-credited-views";
import {
  reconcileCreatorTotalViews,
  shouldCreditSubmissionViewsOnStatusChange,
} from "@/lib/creator-total-views";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  postContestStatusLocksSubmissionModeration,
  SUBMISSION_MODERATION_LOCKED_MESSAGE,
} from "@/lib/post-contest-moderation-lock";
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
import {
  fetchContestSubmissionsAllPages,
  formatSubmissionFetchError,
} from "@/lib/fetch-contest-submissions";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { applyPayoutAdjustment } from "@/lib/payout-adjustment";
import {
  parseDualRewardPayoutScopeFromRemarks,
  stripDualComponentTagFromRemarks,
  buildDualRewardsPayoutPersistValue,
  splitDualReversalRefundFromPayout,
} from "@/lib/dual-rewards-payout";
import {
  checkDualRewardsPoolBudgetForPayment,
  computeDualRewardsSubmissionReversalDue,
  filterMoneyTxnsForContest,
  getDualRewardsSubmissionPaidComponents,
  rollbackDualRewardsPoolCommitIfNeeded,
  scaleDualReversalDuesToTotalCap,
  type DualPoolBudgetPaymentResult,
} from "@/lib/dual-rewards-pool-budget";
import { logDualRewardsReversalRefund } from "@/lib/dual-rewards-bulk-reversal";
import { creditDualRewardsSubmissionReward } from "@/lib/dual-rewards-reward-credit";

function isDualRewardsLedgerReward(r: {
  metadata?: Record<string, unknown> | null;
}): boolean {
  const m = r?.metadata ?? {};
  if (m.bonus_type) return false;
  if (m.payout_component && m.dual_rewards_reward !== true) return false;
  return true;
}

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
      cpm_refunded_cents?: number;
      milestone_refunded_cents?: number;
    } | null = null;
    const { submissionId, action, reason, paymentDetails, skipWalletDebit, qualityScore } =
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
    if (postContestStatusLocksSubmissionModeration(contest.post_contest_status)) {
      return NextResponse.json(
        {
          error: SUBMISSION_MODERATION_LOCKED_MESSAGE,
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
      // Clear metadata for verified/pending (dual_rewards_payout cleared after wallet reversal)
      updateData.metadata = null;
    }

    if (action === "verified") {
      const { requireVerifyQualityScore } = await import("@/lib/quality-score");
      const parsedQualityScore = requireVerifyQualityScore(qualityScore);
      if (parsedQualityScore === null) {
        return NextResponse.json(
          {
            error:
              "qualityScore is required and must be 1, 2, or 3 when verifying a submission",
          },
          { status: 400 },
        );
      }
      updateData.quality_score = parsedQualityScore;
      updateData.quality_score_backfilled = false;
    } else if (action === "rejected" || action === "pending") {
      updateData.quality_score = null;
      updateData.quality_score_backfilled = false;
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

    // Snapshot views and credit creator totals once when entering verified/paid.
    const nextViewsCreditStatus =
      action === SUBMISSION_STATUS.verified
        ? SUBMISSION_STATUS.verified
        : action === SUBMISSION_STATUS.paid
          ? SUBMISSION_STATUS.paid
          : null;
    const shouldCreditViews =
      nextViewsCreditStatus !== null &&
      shouldCreditSubmissionViewsOnStatusChange(
        submissionFull.status,
        nextViewsCreditStatus,
      );

    if (shouldCreditViews) {
      const currentViews = getSubmissionViewsForCrediting(submissionFull);

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
      } else if (submissionFull.creator_id) {
        try {
          await reconcileCreatorTotalViews(String(submissionFull.creator_id));
        } catch (reconcileErr) {
          console.error(
            "Failed to reconcile creator total_views after verify:",
            reconcileErr,
          );
        }
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

    const shouldUncreditViews =
      action === SUBMISSION_STATUS.rejected ||
      (action === SUBMISSION_STATUS.pending &&
        (submissionFull.status === SUBMISSION_STATUS.verified ||
          submissionFull.status === SUBMISSION_STATUS.paid));

    if (shouldUncreditViews) {
      const { error: uncreditErr } = await supabaseAdmin
        .from("submission_views_credited")
        .delete()
        .eq("submission_id", submissionId);
      if (uncreditErr) {
        console.error("Failed to uncredit views for submission:", uncreditErr);
      } else if (submissionFull.creator_id) {
        try {
          await reconcileCreatorTotalViews(String(submissionFull.creator_id));
        } catch (reconcileErr) {
          console.error(
            "Failed to reconcile creator total_views after uncredit:",
            reconcileErr,
          );
        }
      }
    }

    let bonusOutcome:
      | "credited"
      | "skipped_cap"
      | "skipped_adjustment_to_zero"
      | "skipped_not_expected"
      | null = null;
    let pendingDualMilestoneCents = 0;

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

          if (action === "mark_both_paid") {
            pendingDualMilestoneCents = milestoneAmount;
          } else {
            const paidComponents = getDualRewardsSubmissionPaidComponents({
              id: String(submissionFull.id),
              earnings: submissionFull.earnings,
              paid: submissionFull.paid,
              bonus_amount: submissionFull.bonus_amount,
              bonus_paid: submissionFull.bonus_paid,
              dual_rewards_payout: submissionFull.dual_rewards_payout,
            });
            const poolResult = await checkDualRewardsPoolBudgetForPayment({
              supabaseAdmin,
              contest: contest as any,
              contestId: submissionFull.contest_id,
              targetSubmissionId: submissionId,
              targetAfter: {
                cpmCents: paidComponents.cpmCents,
                milestoneCents: paidComponents.milestoneCents + milestoneAmount,
              },
            });
            if (!poolResult.ok) {
              const denied = poolResult.check;
              return NextResponse.json(
                {
                  error: denied.error,
                  details: {
                    poolBudgetCents: denied.poolBudgetCents,
                    projectedSpentCents: denied.projectedSpentCents,
                    remainingCents: denied.remainingCents,
                    additionalMilestoneCents: milestoneAmount,
                  },
                },
                { status: 400 },
              );
            }

            const [
              { data: existingSubmissionRewards },
              { data: existingLegacyMilestoneRewards },
              { data: existingBonusRefunds },
            ] = await Promise.all([
              supabaseAdmin
                .from("money_transactions")
                .select("id, metadata")
                .eq("user_id", submissionFull.creator_id)
                .eq("type", "reward")
                .contains("metadata", { submission_id: submissionId }),
              supabaseAdmin
                .from("money_transactions")
                .select("id, metadata")
                .eq("user_id", submissionFull.creator_id)
                .eq("type", "reward")
                .contains("metadata", {
                  source_submission_id: submissionId,
                  payout_component: "milestone",
                }),
              supabaseAdmin
                .from("money_transactions")
                .select("id, remarks, metadata")
                .eq("user_id", submissionFull.creator_id)
                .eq("type", "refund")
                .contains("metadata", { submission_id: submissionId }),
            ] as any);

            const milestoneRewards = [
              ...(existingSubmissionRewards || []).filter(
                (r: any) =>
                  r?.metadata?.dual_rewards_reward === true &&
                  Math.max(
                    0,
                    Math.round(Number(r?.metadata?.milestone_cents) || 0),
                  ) > 0,
              ),
              ...(existingLegacyMilestoneRewards || []),
            ];
            const milestoneRefunds = (existingBonusRefunds || []).filter(
              (r: any) =>
                (!r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK) &&
                (r?.metadata?.dual_rewards_reversal === true ||
                  r?.metadata?.payout_component === "milestone" ||
                  Math.max(
                    0,
                    Math.round(Number(r?.metadata?.milestone_refunded_cents) || 0),
                  ) > 0),
            );
            const rewardsCount = milestoneRewards.length;
            const refundsCount = milestoneRefunds.length;
            const nextBonusCycle =
              rewardsCount > refundsCount ? rewardsCount : rewardsCount + 1;
            const idempotencyKey = `dual_rewards_reward:v1:${submissionId}:cycle:${nextBonusCycle}`;

            const creditResult = await creditDualRewardsSubmissionReward({
              creatorId: submissionFull.creator_id,
              submissionId,
              contestId: submissionFull.contest_id,
              contestTitle: contest.title || "Contest",
              cpmCents: 0,
              milestoneCents: milestoneAmount,
              payoutCycle: nextBonusCycle,
              idempotencyKey,
              remarks:
                paymentDetails?.customRemarks ||
                "Milestone reward credited to creator wallet",
            });

            if (!creditResult.success) {
              await rollbackDualRewardsPoolCommitIfNeeded(
                supabaseAdmin,
                submissionFull.contest_id,
                submissionId,
                poolResult,
              );
              return NextResponse.json(
                {
                  error: `Failed to credit milestone reward: ${creditResult.error}`,
                },
                { status: 500 },
              );
            }

            const committedMilestonePayout = {
              cpm_cents: paidComponents.cpmCents,
              milestone_cents: paidComponents.milestoneCents + milestoneAmount,
            };

            const { data: afterBonusUpdate, error: bonusUpdateError } =
              await supabaseAdmin
                .from("submissions")
                .update({
                  bonus_paid: true,
                  bonus_paid_at: new Date().toISOString(),
                  bonus_amount: milestoneAmount,
                  dual_rewards_payout: buildDualRewardsPayoutPersistValue(
                    committedMilestonePayout,
                    {
                      updatedBy: currentUserId,
                      customRemarks: paymentDetails?.customRemarks ?? null,
                    },
                  ),
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
              await rollbackDualRewardsPoolCommitIfNeeded(
                supabaseAdmin,
                submissionFull.contest_id,
                submissionId,
                poolResult,
              );
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
        const { data: allEligibleContestSubs, error: allEligibleErr } =
          await fetchContestSubmissionsAllPages(
            supabaseAdmin,
            submissionFull.contest_id,
            "id, created_at, status, paid",
            { order: { column: "created_at", ascending: true } },
          );
        if (allEligibleErr) {
          return NextResponse.json(
            { error: formatSubmissionFetchError(allEligibleErr) },
            { status: 500 },
          );
        }
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
        const { data: bonusSpendingData, error: bonusSpendErr } =
          await fetchContestSubmissionsAllPages<{ bonus_amount?: number | null }>(
          supabaseAdmin,
          submissionFull.contest_id,
          "bonus_amount",
          {
            bonusPaid: true,
            order: { column: "created_at", ascending: true },
          },
        );
        if (bonusSpendErr) {
          return NextResponse.json(
            { error: formatSubmissionFetchError(bonusSpendErr) },
            { status: 500 },
          );
        }

          const currentBonusSpent = (bonusSpendingData || []).reduce(
            (sum, sub) => sum + (Number(sub.bonus_amount) || 0),
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
              await fetchContestSubmissionsAllPages(
                supabaseAdmin,
                submissionFull.contest_id,
                "id, creator_id, status, views, created_at, platform, other_stats",
                {
                  statusIn: ["pending", "verified", "paid"],
                  order: { column: "created_at", ascending: true },
                },
              );

            if (payoutSubsErr) {
              return NextResponse.json(
                { error: formatSubmissionFetchError(payoutSubsErr) },
                { status: 500 },
              );
            }
            if (Array.isArray(payoutEligibleSubs)) {
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
                await fetchContestSubmissionsAllPages(
                  supabaseAdmin,
                  submissionFull.contest_id,
                  "id, created_at",
                  {
                    creatorId: submissionFull.creator_id,
                    order: { column: "created_at", ascending: true },
                  },
                );

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
                if (contest.contest_type === "dual_rewards") {
                  const capMaps = await ensureDualCreatorCapMaps();
                  if (!dualCreatorCapFetchError) {
                    finalCpmCappedAmount =
                      capMaps.cpmCappedBySubmissionId.get(
                        String(submissionFull.id),
                      ) ?? rawAmount;
                  }
                } else {
                  const { data: creatorSubs } =
                    await fetchContestSubmissionsAllPages<{
                      id: string;
                      views?: number | null;
                      status?: string;
                    }>(
                    supabaseAdmin,
                    submissionFull.contest_id,
                    "id, views, status",
                    {
                      creatorId: submissionFull.creator_id,
                      statusIn: ["pending", "verified", "paid"],
                      order: { column: "created_at", ascending: true },
                    },
                  );

                  if (creatorSubs) {
                    let runningTotal = 0;
                    for (const sub of creatorSubs) {
                      let subViews = Number(sub.views) || 0;
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
            const { data: creatorSubmissions } = await fetchContestSubmissionsAllPages(
              supabaseAdmin,
              submissionFull.contest_id,
              "id, created_at, earnings, views, status",
              {
                creatorId: submissionFull.creator_id,
                statusIn: ["verified", "paid"],
                order: { column: "created_at", ascending: true },
              },
            );

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
        const shouldCreditDualRewardsPaid =
          contest.contest_type === "dual_rewards" &&
          action === "mark_both_paid" &&
          pendingDualMilestoneCents > 0 &&
          rewardAmount <= 0;

        if (rewardAmount > 0 || shouldCreditDualRewardsPaid) {
          if (rewardAmount > 0 && !customAmount) {
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

          if (
            contest.contest_type === "dual_rewards" &&
            action === "mark_both_paid" &&
            pendingDualMilestoneCents > 0
          ) {
            dualRewardsPayoutJson = {
              cpm_cents: dualRewardsPayoutJson?.cpm_cents ?? rewardAmount,
              milestone_cents: pendingDualMilestoneCents,
            };
          }

          const isDualRewardsRefundForCycle = (r: {
            metadata?: Record<string, unknown> | null;
          }) => {
            const m = r?.metadata ?? {};
            if (m.bonus_type) return false;
            if (m.payout_component && m.dual_rewards_reversal !== true) {
              return false;
            }
            return true;
          };

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
            isDualRewardsLedgerReward,
          );
          const mainRefunds = (existingRefunds || []).filter(
            isDualRewardsRefundForCycle,
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
            (existingRewards || [])
              .filter(isDualRewardsLedgerReward)
              .map((r: any) => getTransactionPayoutCycle(r?.metadata)),
          );
          let resolvedNextCycle = nextCycle;
          while (occupiedRewardCycles.has(resolvedNextCycle)) {
            resolvedNextCycle += 1;
          }

          const dualRewardsSplit = dualRewardsPayoutJson ?? {
            cpm_cents: rewardAmount,
            milestone_cents: 0,
          };
          const dualCreditCpmCents = Math.max(
            0,
            Math.round(dualRewardsSplit.cpm_cents),
          );
          const dualCreditMilestoneCents = Math.max(
            0,
            Math.round(dualRewardsSplit.milestone_cents),
          );
          const dualCreditTotalCents =
            dualCreditCpmCents + dualCreditMilestoneCents;

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

          const contestRewardIdempotencyKey =
            contest.contest_type === "dual_rewards"
              ? customAmount
                ? `dual_rewards_reward:v1:${submissionId}:cycle:${resolvedNextCycle}:amt:${dualCreditTotalCents}`
                : `dual_rewards_reward:v1:${submissionId}:cycle:${resolvedNextCycle}`
              : customAmount
                ? `contest_reward:v1:${submissionId}:cycle:${resolvedNextCycle}:amt:${rewardAmount}`
                : `contest_reward:v1:${submissionId}:cycle:${resolvedNextCycle}`;

          const mainRewardInThisCycle = (rewardInThisCycle || []).filter(
            isDualRewardsLedgerReward,
          );

          let dualRewardsPoolCommit: DualPoolBudgetPaymentResult | undefined;

          if (mainRewardInThisCycle.length === 0) {
            if (contest.contest_type === "dual_rewards") {
              const paidComponents = getDualRewardsSubmissionPaidComponents({
                id: String(submissionFull.id),
                earnings: submissionFull.earnings,
                paid: submissionFull.paid,
                bonus_amount: submissionFull.bonus_amount,
                bonus_paid: submissionFull.bonus_paid,
                dual_rewards_payout: submissionFull.dual_rewards_payout,
              });
              const split = dualRewardsSplit;
              dualRewardsPoolCommit = await checkDualRewardsPoolBudgetForPayment({
                supabaseAdmin,
                contest: contest as any,
                contestId: submissionFull.contest_id,
                targetSubmissionId: submissionId,
                targetAfter: {
                  cpmCents: Math.max(paidComponents.cpmCents, split.cpm_cents),
                  milestoneCents: Math.max(
                    paidComponents.milestoneCents,
                    split.milestone_cents,
                  ),
                },
              });
              if (!dualRewardsPoolCommit.ok) {
                const denied = dualRewardsPoolCommit.check;
                return NextResponse.json(
                  {
                    error: denied.error,
                    details: {
                      poolBudgetCents: denied.poolBudgetCents,
                      projectedSpentCents: denied.projectedSpentCents,
                      remainingCents: denied.remainingCents,
                      attemptedCpmCents: split.cpm_cents,
                      attemptedMilestoneCents: split.milestone_cents,
                    },
                  },
                  { status: 400 },
                );
              }
            }

            const creditRes =
              contest.contest_type === "dual_rewards"
                ? await creditDualRewardsSubmissionReward({
                    creatorId: submissionFull.creator_id,
                    submissionId,
                    contestId: submissionFull.contest_id,
                    contestTitle: (contest as any)?.title || "Contest",
                    cpmCents: dualCreditCpmCents,
                    milestoneCents: dualCreditMilestoneCents,
                    payoutCycle: resolvedNextCycle,
                    idempotencyKey: contestRewardIdempotencyKey,
                    remarks:
                      customRemarks ||
                      (customAmount
                        ? "Custom payout credited to creator wallet"
                        : "Dual rewards payout credited to creator wallet"),
                    payoutType: customAmount ? "custom" : "standard",
                  })
                : await creditCreatorWithdrawableBalance(
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
              await rollbackDualRewardsPoolCommitIfNeeded(
                supabaseAdmin,
                submissionFull.contest_id,
                submissionId,
                dualRewardsPoolCommit,
              );
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

          const markBothPaidBonusPersist =
            action === "mark_both_paid" && pendingDualMilestoneCents > 0
              ? {
                  bonus_paid: true,
                  bonus_paid_at: new Date().toISOString(),
                  bonus_amount: pendingDualMilestoneCents,
                  milestone_bonus_paid: {
                    ...(submissionFull.milestone_bonus_paid || {}),
                    paid_at: new Date().toISOString(),
                    amount_cents: pendingDualMilestoneCents,
                  },
                }
              : {};

          const dualPersist =
            contest.contest_type === "dual_rewards"
              ? {
                  dual_rewards_payout:
                    rewardAmount > 0 || shouldCreditDualRewardsPaid
                      ? buildDualRewardsPayoutPersistValue(
                          dualRewardsPayoutJson ?? {
                            cpm_cents: rewardAmount,
                            milestone_cents: pendingDualMilestoneCents,
                          },
                          {
                            updatedBy: currentUserId,
                            customRemarks: customRemarks ?? null,
                          },
                        )
                      : null,
                  ...markBothPaidBonusPersist,
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
            await rollbackDualRewardsPoolCommitIfNeeded(
              supabaseAdmin,
              submissionFull.contest_id,
              submissionId,
              dualRewardsPoolCommit,
            );
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

    const wasPaidBeforeReversal =
      submission.status === SUBMISSION_STATUS.paid ||
      submissionFull.status === SUBMISSION_STATUS.paid ||
      submissionFull.paid === true;

    const { data: freshPaidRow } = await supabaseAdmin
      .from("submissions")
      .select(
        "earnings, paid, bonus_paid, bonus_amount, dual_rewards_payout, status",
      )
      .eq("id", submissionId)
      .maybeSingle();

    const reversalSubmissionRow = {
      id: String(submissionFull.id),
      earnings: freshPaidRow?.earnings ?? submissionFull.earnings,
      paid: freshPaidRow?.paid ?? submissionFull.paid,
      bonus_amount: freshPaidRow?.bonus_amount ?? submissionFull.bonus_amount,
      bonus_paid: freshPaidRow?.bonus_paid ?? submissionFull.bonus_paid,
      dual_rewards_payout:
        freshPaidRow?.dual_rewards_payout ?? submissionFull.dual_rewards_payout,
    };

    const shouldRunPaidReversal =
      wasPaidBeforeReversal ||
      reversalSubmissionRow.paid === true ||
      reversalSubmissionRow.bonus_paid === true;

    if (
      (action === SUBMISSION_STATUS.verified ||
        action === SUBMISSION_STATUS.pending ||
        action === SUBMISSION_STATUS.rejected) &&
      shouldRunPaidReversal
    ) {
      const { data: contestSubRows, error: contestSubErr } = await supabaseAdmin
        .from("submissions")
        .select("id")
        .eq("contest_id", submissionFull.contest_id)
        .eq("creator_id", submissionFull.creator_id);

      if (contestSubErr) {
        return NextResponse.json(
          {
            error: `Failed to load contest submissions for reversal: ${contestSubErr.message}`,
          },
          { status: 500 },
        );
      }

      const contestSubmissionIds = new Set(
        (contestSubRows || []).map((r: { id: string }) => String(r.id)),
      );
      contestSubmissionIds.add(String(submissionId));

      const [
        { data: rewardTxnsAll, error: rewardErr },
        { data: refundTxnsAll, error: refundErr },
      ] = await Promise.all([
        supabaseAdmin
          .from("money_transactions")
          .select("id, amount, metadata")
          .eq("user_id", submissionFull.creator_id)
          .eq("type", "reward"),
        supabaseAdmin
          .from("money_transactions")
          .select("id, amount, remarks, metadata")
          .eq("user_id", submissionFull.creator_id)
          .eq("type", "refund"),
      ] as any);

      const rewardTxns = filterMoneyTxnsForContest(
        rewardTxnsAll,
        submissionFull.contest_id,
        contestSubmissionIds,
      );
      const refundTxns = filterMoneyTxnsForContest(
        refundTxnsAll,
        submissionFull.contest_id,
        contestSubmissionIds,
      );

      if (rewardErr || refundErr) {
        const message = rewardErr?.message || refundErr?.message || "unknown";
        return NextResponse.json(
          { error: `Failed to fetch transactions for reversal: ${message}` },
          { status: 500 },
        );
      }

      let mainReversalAmount = 0;
      let bonusReversalAmount = 0;
      let bonusReversals: { bonusType: string; amount: number }[] = [];
      let reversalAmount = 0;

      if (contest.contest_type === "dual_rewards") {
        const due = computeDualRewardsSubmissionReversalDue({
          submissionRow: reversalSubmissionRow,
          submissionId,
          rewardTxns,
          refundTxns,
          reversalRemark: REVERSAL_TRANSACTION_REMARK,
          wasPaidBeforeReversal,
        });
        mainReversalAmount = due.mainCents;
        bonusReversalAmount = due.bonusCents;
        bonusReversals = due.bonusReversals;
        reversalAmount = due.totalCents;
        paidStatusReversalSummary = {
          reward_refunded_cents: due.mainCents,
          bonus_refunded_cents: due.bonusCents,
          total_refunded_cents: due.totalCents,
          cpm_refunded_cents: due.mainCents,
          milestone_refunded_cents: due.bonusCents,
        };
      } else {
        const due = computeDualRewardsSubmissionReversalDue({
          submissionRow: reversalSubmissionRow,
          submissionId,
          rewardTxns,
          refundTxns,
          reversalRemark: REVERSAL_TRANSACTION_REMARK,
          wasPaidBeforeReversal,
        });
        mainReversalAmount = due.mainCents;
        bonusReversalAmount = due.bonusCents;
        bonusReversals = due.bonusReversals;
        reversalAmount = due.totalCents;
        paidStatusReversalSummary = {
          reward_refunded_cents: mainReversalAmount,
          bonus_refunded_cents: bonusReversalAmount,
          total_refunded_cents: reversalAmount,
        };
      }

      if (reversalAmount > 0 && !skipWalletDebit) {
        const { data: reversalProfile } = await supabaseAdmin
          .from("creator_profiles")
          .select("withdrawable_balance")
          .eq("id", submissionFull.creator_id)
          .single();
        const reversalAvailableCents = Math.max(
          0,
          Math.round(Number(reversalProfile?.withdrawable_balance) || 0),
        );

        let walletDebitCents = reversalAmount;
        if (reversalAvailableCents < reversalAmount) {
          if (reversalAvailableCents <= 0) {
            walletDebitCents = 0;
          } else {
            const scaled = scaleDualReversalDuesToTotalCap(
              new Map([
                [
                  submissionId,
                  {
                    totalCents: reversalAmount,
                    mainCents: mainReversalAmount,
                    bonusCents: bonusReversalAmount,
                    bonusReversals,
                  },
                ],
              ]),
              reversalAvailableCents,
            );
            const capped = scaled.get(submissionId)!;
            mainReversalAmount = capped.mainCents;
            bonusReversalAmount = capped.bonusCents;
            bonusReversals = capped.bonusReversals;
            walletDebitCents = capped.totalCents;
            reversalAmount = capped.totalCents;
            if (paidStatusReversalSummary) {
              paidStatusReversalSummary = {
                ...paidStatusReversalSummary,
                reward_refunded_cents: mainReversalAmount,
                bonus_refunded_cents: bonusReversalAmount,
                total_refunded_cents: reversalAmount,
                cpm_refunded_cents: mainReversalAmount,
                milestone_refunded_cents: bonusReversalAmount,
              };
            }
          }
        }

        if (walletDebitCents > 0) {
          const debitRes = await debitCreatorWithdrawableBalance(
            submissionFull.creator_id,
            walletDebitCents,
          );
          if (!debitRes.success) {
            return NextResponse.json(
              { error: `Failed to reverse creator credit: ${debitRes.error}` },
              { status: 500 },
            );
          }
        }

        if (reversalAmount > 0) {
          if (contest.contest_type === "dual_rewards") {
            await logDualRewardsReversalRefund({
              creatorId: submissionFull.creator_id,
              submissionId,
              contestId: submissionFull.contest_id,
              contestTitle: (contest as any)?.title || "Contest",
              cpmCents: mainReversalAmount,
              milestoneCents: bonusReversalAmount,
            });
          } else {
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
          }
        }
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
        "id, status, quality_score, earnings, paid, paid_at, bonus_paid, bonus_paid_at, bonus_amount, views, creator_id, created_at, contest_id, platform, other_stats, metadata, dual_rewards_payout",
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
          ? contest.contest_type === "dual_rewards"
            ? ` Verification complete: refunded from creator withdrawable balance — ${formatCurrencyFromCents(s.cpm_refunded_cents ?? s.reward_refunded_cents)} CPM, ${formatCurrencyFromCents(s.milestone_refunded_cents ?? s.bonus_refunded_cents)} milestone (${formatCurrencyFromCents(s.total_refunded_cents)} total).`
            : ` Verification complete: refunded from creator withdrawable balance — ${formatCurrencyFromCents(s.reward_refunded_cents)} reward, ${formatCurrencyFromCents(s.bonus_refunded_cents)} bonus (${formatCurrencyFromCents(s.total_refunded_cents)} total).`
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
