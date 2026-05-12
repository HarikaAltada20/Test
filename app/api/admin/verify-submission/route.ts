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
  adjustBonusCents,
  adjustRewardCents,
  parsePayoutAdjustment,
} from "@/lib/payout-rules";
import { allocateFlatFeeBonusCents } from "@/lib/bonus-allocation";
import { buildFlatFeeBonusExpectedCentsBySubmissionId } from "@/lib/twitter-cpm-bonus-expected";
import { formatCurrencyFromCents } from "@/lib/currency-utils";

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
    );

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

    // Allow status updates for leaderboard, CPM, and milestone contests
    if (
      !contest.contest_type ||
      !["leaderboard", "cpm", "milestone"].includes(contest.contest_type)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid contest type. Only leaderboard, CPM, and milestone contests are supported",
        },
        { status: 400 },
      );
    }

    // We may need submission.earnings and creator_id for payments
    // Fetch submission with earnings and creator_id
    const { data: submissionFull, error: submissionFullErr } = await supabase
      .from("submissions")
      .select(
        "id, contest_id, creator_id, status, earnings, views, paid, paid_at, bonus_paid, bonus_paid_at, bonus_amount, created_at",
      )
      .eq("id", submissionId)
      .single();
    if (submissionFullErr || !submissionFull) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
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
      // Store payment metadata
      updateData.metadata = {
        type: "payment",
        paymentProofUrl: paymentDetails.paymentProofUrl || null,
        paymentDescription: paymentDetails.paymentDescription || null,
        customRemarks: paymentDetails.customRemarks || null,
        timestamp: new Date().toISOString(),
        updatedBy: currentUserId,
      };
    } else if (action === "verified" || action === "pending") {
      // Clear metadata for verified/pending status
      updateData.metadata = null;
    }

    // Use admin client to bypass RLS for the update operation
    const supabaseAdmin = createAdminClient();
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
      // Get flat fee bonus from contest details based on contest type
      const contestDetails =
        contest.contest_type === "cpm"
          ? (contest.contest_based_details as any)?.cpm_contest
          : (contest.contest_based_details as any)?.leaderboard_contest;

      const flatFeeBonus = contestDetails?.flat_fee_bonus || 0;
      const totalBudget = contestDetails?.total_budget || null;
      const flatFeeBonusCap = contestDetails?.flat_fee_bonus_cap || null;

      if (flatFeeBonus > 0 && submissionFull.status === "verified") {
        const { data: allEligibleContestSubs } = await supabaseAdmin
          .from("submissions")
          .select("id, created_at, status, paid")
          .eq("contest_id", submissionFull.contest_id)
          .in("status", ["verified", "paid", "approved"]);
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
          budgetLimit != null ? Math.max(0, budgetLimit - currentBonusSpent) : null;
        const rawBonusAllocation = allocateFlatFeeBonusCents(
          flatFeeBonus,
          remainingBonusBudget,
        );
        const adjustedBonusAllocation = adjustBonusCents(rawBonusAllocation.amount, {
          shouldAdjustBonus: payoutAdjustment.shouldAdjustBonus,
          percentage: payoutAdjustment.percentage,
        });
        // Check if bonus already paid
        if (!submissionFull.bonus_paid) {
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
          const bonusRefundsCount = (existingBonusRefunds || [])
            .filter(
              (r: any) =>
                !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK,
            )
            .length;
          const nextBonusCycle =
            bonusRewardsCount > bonusRefundsCount
              ? bonusRewardsCount
              : bonusRewardsCount + 1;
          const flatFeeBonusIdempotencyKey = `flat_fee_bonus:v2:${submissionId}:cycle:${nextBonusCycle}`;

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
                  payout_cycle: nextBonusCycle,
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
      } else if (submissionFull.status !== "verified") {
        return NextResponse.json(
          { error: "Submission must be verified before paying bonus" },
          { status: 400 },
        );
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
              const payoutBySubmissionId = buildMilestoneSubmissionPayoutCentsMap(
                records,
                milestones,
              );

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
                  (contest as any).max_earnings_per_creator,
                  String(submissionFull.id),
                );

              rewardAmount =
                shouldAdjustReward && cappedBase > 0
                  ? adjustRewardCents(cappedBase, {
                      shouldAdjustReward: true,
                      percentage: payoutAdjustment.percentage,
                    })
                  : cappedBase;
            }
          }
        } else {
          rewardAmount = Number(submissionFull.earnings) || 0;

          // Fallback amount computation when earnings are not yet set
          if ((!rewardAmount || rewardAmount <= 0) && !customAmount) {
            if (contest.contest_type === "cpm") {
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
              rewardAmount = Math.round(((effectiveViews * rate) / 1000) * 100); // cents
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
                  baseAmount = Math.round(((effectiveViews * rate) / 1000) * 100);
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
        if (rewardAmount > 0) {
          if (!customAmount) {
            rewardAmount = adjustRewardCents(rewardAmount, {
              shouldAdjustReward,
              percentage: payoutAdjustment.percentage,
            });
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
            (r: any) => !r?.metadata?.bonus_type,
          );
          const mainRefunds = (existingRefunds || []).filter(
            (r: any) => !r?.metadata?.bonus_type,
          );

          const rewardsCount = mainRewards.length;
          const refundsCount =
            mainRefunds?.filter(
              (r: any) =>
                !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK,
            ).length || 0;
          const nextCycle =
            rewardsCount > refundsCount ? rewardsCount : rewardsCount + 1;

          // Check duplicate reward in this cycle
          const { data: rewardInThisCycle } = await supabaseAdmin
            .from("money_transactions")
            .select("id, metadata")
            .eq("user_id", submissionFull.creator_id)
            .eq("type", "reward")
            .contains("metadata", {
              submission_id: submissionId,
              payout_cycle: nextCycle,
            });

          const contestRewardIdempotencyKey = customAmount
            ? `contest_reward:v1:${submissionId}:cycle:${nextCycle}:amt:${rewardAmount}`
            : `contest_reward:v1:${submissionId}:cycle:${nextCycle}`;

          const mainRewardInThisCycle = (rewardInThisCycle || []).filter(
            (r: any) => !r?.metadata?.bonus_type,
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
                  payout_cycle: nextCycle,
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
        !tx?.metadata?.bonus_type;
      const isBonusSubmissionTx = (tx: any) => {
        const metadata = tx?.metadata || {};
        if (!metadata.bonus_type) return false;
        return (
          String(metadata.submission_id || "") === String(submissionId) ||
          String(metadata.source_submission_id || "") === String(submissionId)
        );
      };
      const sumAmount = (rows: any[]) =>
        rows.reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);

      const mainRewardNet = Math.max(
        0,
        sumAmount((rewardTxns || []).filter(isMainSubmissionTx)) -
          sumAmount((refundTxns || []).filter((tx: any) => isReversalRefund(tx) && isMainSubmissionTx(tx))),
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
        bonusByType.set(key, (bonusByType.get(key) || 0) + (Number(tx.amount) || 0));
      }
      for (const tx of bonusRefunds) {
        const key = String(tx?.metadata?.bonus_type || "bonus");
        bonusByType.set(key, (bonusByType.get(key) || 0) - (Number(tx.amount) || 0));
      }
      let bonusReversals = Array.from(bonusByType.entries())
        .map(([bonusType, amount]) => ({ bonusType, amount: Math.max(0, amount) }))
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
                bonus_type: bonus.bonusType,
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
        "id, status, earnings, paid, paid_at, bonus_paid, bonus_paid_at, bonus_amount, views, creator_id, created_at, contest_id, platform, other_stats, metadata",
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
