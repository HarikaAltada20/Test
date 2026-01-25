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

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const { submissionId, action, reason, paymentDetails } =
      await request.json();

    if (!submissionId || !action) {
      return NextResponse.json(
        { error: "Submission ID and action are required" },
        { status: 400 }
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
        { status: 400 }
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
          { status: 401 }
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
          { status: 403 }
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
          { status: 404 }
        );
      }

      if ((submission as any).contests.advertiser_id !== authUser.id) {
        return NextResponse.json(
          { error: "You can only manage submissions for your own contests" },
          { status: 403 }
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
        { status: 404 }
      );
    }

    // Fetch the contest to check its type and status
    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .select("title, contest_type, contest_based_details, post_contest_status")
      .eq("id", submission.contest_id)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Prevent submission status changes only after payouts are processed
    if (contest.post_contest_status === "payouts_processed") {
      return NextResponse.json(
        {
          error:
            "Submission status cannot be changed after payouts are processed. Contest is fully finalized.",
        },
        { status: 400 }
      );
    }

    // Only allow payment actions when contest status is verification_complete
    const isPaymentAction =
      action === SUBMISSION_STATUS.paid ||
      action === "mark_bonus_paid" ||
      action === "mark_both_paid";
    if (
      isPaymentAction &&
      contest.post_contest_status !== "verification_complete"
    ) {
      return NextResponse.json(
        {
          error:
            "Payments can only be processed when contest status is 'verification_complete'",
        },
        { status: 400 }
      );
    }

    // Allow status updates for both leaderboard and CPM contests
    if (
      !contest.contest_type ||
      !["leaderboard", "cpm"].includes(contest.contest_type)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid contest type. Only leaderboard and CPM contests are supported",
        },
        { status: 400 }
      );
    }

    // We may need submission.earnings and creator_id for payments
    // Fetch submission with earnings and creator_id
    const { data: submissionFull, error: submissionFullErr } = await supabase
      .from("submissions")
      .select(
        "id, contest_id, creator_id, status, earnings, views, paid, paid_at, bonus_paid, bonus_paid_at"
      )
      .eq("id", submissionId)
      .single();
    if (submissionFullErr || !submissionFull) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
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
      status: normalizedStatus,
    };

    if (shouldMarkPaid) {
      updateData.paid = true;
      updateData.paid_at = new Date().toISOString();
    }

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
        { status: 500 }
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
            "total_views"
          );
          const { error: updCreatorErr } = await supabaseAdmin
            .from("creator_profiles")
            .update({ total_views: currentTotal + delta })
            .eq("id", submissionFull.creator_id);
          if (updCreatorErr) {
            console.error(
              "Failed to update creator total_views:",
              updCreatorErr
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
          { onConflict: "submission_id" }
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
        // Calculate current bonus spending
        const { data: bonusSpendingData } = await supabaseAdmin
          .from("submissions")
          .select("bonus_amount")
          .eq("contest_id", submissionFull.contest_id)
          .eq("bonus_paid", true);

        const currentBonusSpent = (bonusSpendingData || []).reduce(
          (sum, sub) => sum + (sub.bonus_amount || 0),
          0
        );

        // For leaderboard contests with total_budget, check if budget would be exceeded
        if (contest.contest_type === "leaderboard" && totalBudget) {
          if (currentBonusSpent + flatFeeBonus > totalBudget) {
            return NextResponse.json(
              {
                error: "Total budget exceeded",
                details: {
                  currentSpent: currentBonusSpent,
                  bonusAmount: flatFeeBonus,
                  budgetLimit: totalBudget,
                  remaining: totalBudget - currentBonusSpent,
                },
              },
              { status: 400 }
            );
          }
        }

        // For CPM contests with flat_fee_bonus_cap, check if cap would be exceeded
        if (contest.contest_type === "cpm" && flatFeeBonusCap) {
          if (currentBonusSpent + flatFeeBonus > flatFeeBonusCap) {
            return NextResponse.json(
              {
                error: "Flat fee bonus cap exceeded",
                details: {
                  currentSpent: currentBonusSpent,
                  bonusAmount: flatFeeBonus,
                  capLimit: flatFeeBonusCap,
                  remaining: flatFeeBonusCap - currentBonusSpent,
                },
              },
              { status: 400 }
            );
          }
        }
        // Check if bonus already paid
        if (!submissionFull.bonus_paid) {
          // Credit bonus to creator wallet
          const creditResult = await creditCreatorWithdrawableBalance(
            submissionFull.creator_id,
            flatFeeBonus,
            `Flat fee bonus for submission in contest ${
              contest.title || "Contest"
            }`,
            {
              remarks:
                paymentDetails?.customRemarks ||
                "Flat fee bonus credited to creator wallet",
              metadata: {
                submission_id: submissionId,
                contest_id: submissionFull.contest_id,
                bonus_type: "flat_fee",
              },
            }
          );

          if (!creditResult.success) {
            return NextResponse.json(
              {
                error: `Failed to credit flat fee bonus: ${creditResult.error}`,
              },
              { status: 500 }
            );
          }

          // Update submission bonus_paid status and amount
          const { error: bonusUpdateError } = await supabaseAdmin
            .from("submissions")
            .update({
              bonus_paid: true,
              bonus_paid_at: new Date().toISOString(),
              bonus_amount: flatFeeBonus, // Store actual bonus amount paid (in cents)
            })
            .eq("id", submissionId);

          if (bonusUpdateError) {
            console.error(
              "Error updating bonus_paid status:",
              bonusUpdateError
            );
          }
        }
      } else if (flatFeeBonus <= 0) {
        return NextResponse.json(
          { error: "No flat fee bonus configured for this contest" },
          { status: 400 }
        );
      } else if (submissionFull.status !== "verified") {
        return NextResponse.json(
          { error: "Submission must be verified before paying bonus" },
          { status: 400 }
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

    // Enqueue payout job instead of doing full payout synchronously (avoid timeouts)
    if (action === SUBMISSION_STATUS.paid || action === "mark_both_paid") {
      // Try to enqueue; on failure, fall back to inline payout logic below
      const { error: enqueueErr } = await supabaseAdmin
        .from("payout_jobs")
        .insert({
          submission_id: submissionId,
          requested_by: currentUserId,
          payload: paymentDetails || {},
        });
      if (!enqueueErr) {
        return NextResponse.json({
          success: true,
          queued: true,
          message: "Payout queued for processing",
        });
      }

      // Fallback path below keeps previous inline behavior if enqueue fails
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
        let rewardAmount =
          customAmount && customAmount > 0
            ? customAmount
            : submissionFull.earnings || 0;

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
        if (rewardAmount > 0) {
          // Determine payout cycle, allowing repay after full refund
          const { data: existingRewards } = await supabase
            .from("money_transactions")
            .select("id")
            .eq("user_id", submissionFull.creator_id)
            .eq("type", "reward")
            .contains("metadata", { submission_id: submissionId });

          const { data: existingRefunds } = await supabase
            .from("money_transactions")
            .select("id, remarks")
            .eq("user_id", submissionFull.creator_id)
            .eq("type", "refund")
            .contains("metadata", { submission_id: submissionId });

          const rewardsCount = (existingRewards || []).length;
          const refundsCount =
            (existingRefunds || [])?.filter(
              (r: any) =>
                !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK
            ).length || 0;
          const nextCycle =
            rewardsCount > refundsCount ? rewardsCount : rewardsCount + 1;

          // Check duplicate reward in this cycle
          const { data: rewardInThisCycle } = await supabase
            .from("money_transactions")
            .select("id")
            .eq("user_id", submissionFull.creator_id)
            .eq("type", "reward")
            .contains("metadata", {
              submission_id: submissionId,
              payout_cycle: nextCycle,
            });

          if (!rewardInThisCycle || rewardInThisCycle.length === 0) {
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
              }
            );
            if (!creditRes.success) {
              return NextResponse.json(
                { error: `Failed to credit creator: ${creditRes.error}` },
                { status: 500 }
              );
            }
          }

          // Update creator metrics: submission wins and contest wins (+1)
          try {
            await MetricsService.incrementSubmissionWin(
              submissionFull.creator_id,
              submissionFull.contest_id,
              submissionId
            );
          } catch (e: any) {
            console.error("Metrics update (paid) failed:", e);
          }

          // Ensure reward amount is reflected on the submission for UI display
          if (
            !submissionFull.earnings ||
            submissionFull.earnings <= 0 ||
            customAmount
          ) {
            await supabaseAdmin
              .from("submissions")
              .update({
                earnings: rewardAmount,
                paid: true,
                paid_at: new Date().toISOString(),
              })
              .eq("id", submissionId);
          } else {
            // Update paid status even if earnings already set
            await supabaseAdmin
              .from("submissions")
              .update({
                paid: true,
                paid_at: new Date().toISOString(),
              })
              .eq("id", submissionId);
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
      // O(1) reversal: prefer the current earnings snapshot on the submission
      // This is exactly the last granted amount for this submission
      let reversalAmount = submissionFull.earnings || 0;
      if (!reversalAmount || reversalAmount <= 0) {
        // Fallback: calculate net unreversed reward = rewards - prior reversals (rare path)
        const [
          { data: rewardTxns, error: rewardErr },
          { data: refundTxns, error: refundErr },
        ] = await Promise.all([
          supabaseAdmin
            .from("money_transactions")
            .select("id, amount")
            .eq("user_id", submissionFull.creator_id)
            .eq("type", "reward")
            .contains("metadata", { submission_id: submissionId }),
          supabaseAdmin
            .from("money_transactions")
            .select("id, amount, remarks")
            .eq("user_id", submissionFull.creator_id)
            .eq("type", "refund")
            .contains("metadata", { submission_id: submissionId }),
        ] as any);

        if (rewardErr || refundErr) {
          const message = rewardErr?.message || refundErr?.message || "unknown";
          return NextResponse.json(
            { error: `Failed to fetch transactions for reversal: ${message}` },
            { status: 500 }
          );
        }

        const totalRewards = (rewardTxns || []).reduce(
          (sum: number, tx: any) => sum + (tx.amount || 0),
          0
        );
        const totalReversals = (refundTxns || [])
          .filter(
            (tx: any) =>
              !tx.remarks || tx.remarks === REVERSAL_TRANSACTION_REMARK
          )
          .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
        reversalAmount = Math.max(0, totalRewards - totalReversals);
      }

      if (reversalAmount > 0) {
        // Debit creator wallet by the credited total
        const debitRes = await debitCreatorWithdrawableBalance(
          submissionFull.creator_id,
          reversalAmount
        );
        if (!debitRes.success) {
          return NextResponse.json(
            { error: `Failed to reverse creator credit: ${debitRes.error}` },
            { status: 500 }
          );
        }
        // Metrics revert for paid reversal: submission wins and contest wins (-1)
        try {
          await MetricsService.decrementSubmissionWin(
            submissionFull.creator_id,
            submissionFull.contest_id,
            submissionFull.id
          );
        } catch (e: any) {
          console.error("Metrics update (revert paid) failed:", e);
        }
        // Do NOT delete the original reward transactions. We only add a new explicit reversal entry.
        // Always log a reversal transaction entry for audit trail
        await logTransactionAsAdmin(
          submissionFull.creator_id,
          "refund",
          reversalAmount,
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
          }
        );
        // No longer keep earnings on reversal; it should be cleared when leaving Paid
      }

      // Always clear earnings and paid status once we move away from Paid, regardless of reversalAmount
      await supabaseAdmin
        .from("submissions")
        .update({
          earnings: null,
          paid: false,
          paid_at: null,
        })
        .eq("id", submissionId);
    }

    // Note: With the new system, verified and pending submissions show in leaderboard immediately
    // Only rejected submissions are hidden from public view

    // Log the verification action (optional - for audit trail)
    // Always return the latest submission data (including updated earnings)
    const { data: latestSubmission } = await supabaseAdmin
      .from("submissions")
      .select("id, status, earnings, paid, paid_at, bonus_paid, bonus_paid_at")
      .eq("id", submissionId)
      .single();

    return NextResponse.json({
      success: true,
      submission: latestSubmission || updatedSubmission,
      message: `Submission ${action} successfully${
        action === "rejected" ? ` with reason: ${reason}` : ""
      }`,
    });
  } catch (error: any) {
    console.error("Error in verification endpoint:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
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
        { status: 401 }
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
        { status: 404 }
      );
    }

    if (userData.user_type !== "admin" && userData.user_type !== "advertiser") {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
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
      `
      )
      .eq("status", status)
      .in("contests.contest_type", ["leaderboard", "cpm"])
      .order("created_at", { ascending: false });

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError);
      return NextResponse.json(
        { error: "Failed to fetch submissions" },
        { status: 500 }
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
      { status: 500 }
    );
  }
}
