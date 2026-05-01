import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { creditCreatorWithdrawableBalance } from "@/lib/payment-utils";
import { applyPayoutAdjustment } from "@/lib/payout-adjustment";
import { buildMilestoneSubmissionPayoutCentsMap } from "@/lib/milestone-contest-expected-spend";

export async function POST(request: NextRequest) {
  const supabaseAdmin = await createClient();

  try {
    // Authenticate user
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or advertiser
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (!userData || !["admin", "advertiser"].includes(userData.user_type)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { submission_ids, payment_type, contest_id, creator_id } = body;

    if (
      !submission_ids ||
      !Array.isArray(submission_ids) ||
      submission_ids.length === 0
    ) {
      return NextResponse.json(
        { error: "submission_ids is required and must be a non-empty array" },
        { status: 400 },
      );
    }

    if (!["standard", "bonus", "both"].includes(payment_type)) {
      return NextResponse.json(
        { error: "payment_type must be standard, bonus, or both" },
        { status: 400 },
      );
    }

    // Fetch all submissions
    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .in("id", submission_ids)
      .eq("contest_id", contest_id);

    if (submissionsError || !submissions || submissions.length === 0) {
      return NextResponse.json(
        { error: "Failed to fetch submissions" },
        { status: 500 },
      );
    }

    // Fetch contest details
    const { data: contest, error: contestError } = await supabaseAdmin
      .from("contests")
      .select("*")
      .eq("id", contest_id)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Only allow payments when contest status is verification_complete
    if (contest.post_contest_status !== "verification_complete") {
      return NextResponse.json(
        {
          error:
            "Payments can only be processed when contest status is 'verification_complete'",
        },
        { status: 400 },
      );
    }

    // Filter to verified (or legacy "approved") submissions only — same notion as verify-submission / UI
    const verifiedSubmissions = submissions.filter((s) => {
      const st = String(s.status || "").toLowerCase();
      return st === "verified" || st === "approved";
    });

    if (verifiedSubmissions.length === 0) {
      return NextResponse.json(
        { error: "No verified submissions found" },
        { status: 400 },
      );
    }

    // Sort by submission time (earliest first)
    const sortedSubmissions = verifiedSubmissions.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    // Milestone payout — same FCFS + limits + view rules as contest detail / verify-submission
    let milestonePayoutBySubmissionId = new Map<string, number>();
    if (contest.contest_type === "milestone") {
      const milestoneContest = (contest.contest_based_details as any)
        ?.milestone_contest;
      const milestones = Array.isArray(milestoneContest?.milestones)
        ? milestoneContest.milestones
        : [];

      if (milestones.length > 0) {
        const { data: payoutEligibleSubs, error: payoutEligibleErr } =
          await supabaseAdmin
            .from("submissions")
            .select(
              "id, creator_id, status, views, created_at, platform, other_stats",
            )
            .eq("contest_id", contest_id)
            .in("status", ["pending", "verified", "paid"])
            .order("created_at", { ascending: true });

        if (payoutEligibleErr) {
          console.error(
            "[bulk-payment] milestone payout query failed:",
            payoutEligibleErr,
          );
          return NextResponse.json(
            {
              error: `Milestone allocation failed: ${payoutEligibleErr.message}. Try again or contact support.`,
            },
            { status: 500 },
          );
        } else {
          const records = (payoutEligibleSubs || []).map((sub: any) => ({
            id: String(sub.id),
            creator_id: sub.creator_id,
            created_at: sub.created_at,
            status: sub.status,
            views: sub.views,
            platform: sub.platform,
            other_stats: sub.other_stats,
          }));
          milestonePayoutBySubmissionId = buildMilestoneSubmissionPayoutCentsMap(
            records,
            milestones,
          );
        }
      }
    }

    // Get flat fee bonus and total budget
    const contestDetails =
      contest.contest_type === "cpm"
        ? (contest.contest_based_details as any)?.cpm_contest
        : (contest.contest_based_details as any)?.leaderboard_contest;

    const flatFeeBonus = contestDetails?.flat_fee_bonus || 0;
    const totalBudget = contestDetails?.total_budget || null;
    const flatFeeBonusCap = contestDetails?.flat_fee_bonus_cap || null;

    const maxEarnings = contest.max_earnings_per_creator || null;

    // Simple contest-level payout adjustment (percentage + mode)
    const payoutAdjustmentPercentage =
      typeof contest.payout_adjustment_percentage === "number"
        ? contest.payout_adjustment_percentage
        : typeof contest.payout_adjustment_percentage === "string"
          ? parseFloat(contest.payout_adjustment_percentage) || 0
          : 0;
    const payoutAdjustmentMode = contest.payout_adjustment_mode as
      | "cpm_only"
      | "bonus_only"
      | "combined"
      | null;
    const hasPayoutAdjustment =
      payoutAdjustmentPercentage > 0 && !!payoutAdjustmentMode;
    const shouldAdjustReward =
      hasPayoutAdjustment &&
      (payoutAdjustmentMode === "combined" ||
        payoutAdjustmentMode === "cpm_only");
    const shouldAdjustBonus =
      hasPayoutAdjustment &&
      (payoutAdjustmentMode === "combined" ||
        payoutAdjustmentMode === "bonus_only");

    // Check bonus budget/cap before processing
    if (
      (payment_type === "bonus" || payment_type === "both") &&
      flatFeeBonus > 0
    ) {
      // Calculate current bonus spending
      const { data: bonusSpendingData } = await supabaseAdmin
        .from("submissions")
        .select("bonus_amount")
        .eq("contest_id", contest_id)
        .eq("bonus_paid", true);

      const currentBonusSpent = (bonusSpendingData || []).reduce(
        (sum, sub) => sum + (sub.bonus_amount || 0),
        0,
      );

      // Calculate potential bonus spending for this bulk payment (only unpaid bonuses)
      const unpaidBonusSubmissions = verifiedSubmissions.filter(
        (s) => !s.bonus_paid,
      );
      const potentialBonusSpending =
        unpaidBonusSubmissions.length * flatFeeBonus;

      // For leaderboard contests with total_budget, check if budget would be exceeded
      if (contest.contest_type === "leaderboard" && totalBudget) {
        if (currentBonusSpent + potentialBonusSpending > totalBudget) {
          return NextResponse.json(
            {
              error: "Total budget would be exceeded",
              details: {
                currentSpent: currentBonusSpent,
                potentialSpending: potentialBonusSpending,
                budgetLimit: totalBudget,
                remaining: totalBudget - currentBonusSpent,
                maxSubmissions: Math.floor(
                  (totalBudget - currentBonusSpent) / flatFeeBonus,
                ),
              },
            },
            { status: 400 },
          );
        }
      }

      // For CPM contests with flat_fee_bonus_cap, check if cap would be exceeded
      if (contest.contest_type === "cpm" && flatFeeBonusCap) {
        if (currentBonusSpent + potentialBonusSpending > flatFeeBonusCap) {
          return NextResponse.json(
            {
              error: "Flat fee bonus cap would be exceeded",
              details: {
                currentSpent: currentBonusSpent,
                potentialSpending: potentialBonusSpending,
                capLimit: flatFeeBonusCap,
                remaining: flatFeeBonusCap - currentBonusSpent,
                maxSubmissions: Math.floor(
                  (flatFeeBonusCap - currentBonusSpent) / flatFeeBonus,
                ),
              },
            },
            { status: 400 },
          );
        }
      }
    }

    // Calculate earnings for each submission
    let runningTotal = 0;
    const breakdown: any[] = [];
    let totalCPM = 0;
    let totalBonus = 0;
    let paidCount = 0;
    let skippedCount = 0;

    // Check how much has already been paid to this creator
    const { data: previousSubmissions } = await supabaseAdmin
      .from("submissions")
      .select("earnings, paid")
      .eq("contest_id", contest_id)
      .eq("creator_id", creator_id)
      .eq("paid", true);

    const alreadyPaidAmount =
      previousSubmissions?.reduce((sum, s) => sum + (s.earnings || 0), 0) || 0;
    runningTotal = alreadyPaidAmount;

    for (const sub of sortedSubmissions) {
      // Skip if already paid
      if (sub.paid && payment_type !== "bonus") {
        skippedCount++;
        continue;
      }

      // Calculate CPM earnings for this submission
      let submissionEarnings = 0;

      if (payment_type !== "bonus") {
        // Numeric normalize: DB/JSON may send string "0" which is truthy and would skip milestone math below.
        const storedEarnings = Number((sub as any).earnings);
        submissionEarnings =
          Number.isFinite(storedEarnings) && storedEarnings > 0
            ? storedEarnings
            : 0;

        // If earnings not stored, calculate dynamically for CPM contests
        if (!submissionEarnings && contest.contest_type === "cpm") {
          const cpmConfig = (contest.contest_based_details as any)?.cpm_contest;
          if (cpmConfig?.cpm_rate_usd) {
            let effectiveViews = sub.views || 0;

            // Apply min_views threshold
            if (
              cpmConfig.min_views != null &&
              effectiveViews < cpmConfig.min_views
            ) {
              effectiveViews = 0;
            }

            // Apply max_views cap
            if (
              cpmConfig.max_views != null &&
              effectiveViews > cpmConfig.max_views
            ) {
              effectiveViews = cpmConfig.max_views;
            }

            // Calculate earnings: (views * CPM rate) / 1000, convert to cents
            const calculatedEarnings =
              (effectiveViews * cpmConfig.cpm_rate_usd * 100) / 1000;
            submissionEarnings = Math.round(calculatedEarnings);
          }
        } else if (
          !submissionEarnings &&
          contest.contest_type === "milestone"
        ) {
          submissionEarnings =
            milestonePayoutBySubmissionId.get(String(sub.id)) || 0;
        }

        // Check if adding this submission would exceed the cap
        if (maxEarnings && runningTotal + submissionEarnings > maxEarnings) {
          // Partial payment to reach cap exactly
          const remainingCap = maxEarnings - runningTotal;
          if (remainingCap > 0) {
            submissionEarnings = remainingCap;
            runningTotal = maxEarnings;
          } else {
            // Cap reached, skip this submission for CPM payment
            submissionEarnings = 0;
          }
        } else {
          runningTotal += submissionEarnings;
        }

        // Apply contest-level adjustment to CPM (reward) if configured
        const adjustedSubmissionEarnings =
          shouldAdjustReward && submissionEarnings > 0
            ? applyPayoutAdjustment(
                submissionEarnings,
                payoutAdjustmentPercentage,
              )
            : submissionEarnings;

        totalCPM += adjustedSubmissionEarnings;
      }

      // Calculate bonus
      let submissionBonus = 0;
      if (payment_type !== "standard" && flatFeeBonus > 0 && !sub.bonus_paid) {
        // Check if adding this bonus would exceed the cap/budget
        let wouldExceedCap = false;

        if (contest.contest_type === "leaderboard" && totalBudget) {
          const remainingBudget = totalBudget - totalBonus;
          if (flatFeeBonus > remainingBudget) {
            wouldExceedCap = true;
          }
        } else if (contest.contest_type === "cpm" && flatFeeBonusCap) {
          const remainingCap = flatFeeBonusCap - totalBonus;
          if (flatFeeBonus > remainingCap) {
            wouldExceedCap = true;
          }
        }

        if (!wouldExceedCap) {
          submissionBonus = flatFeeBonus;
          totalBonus += submissionBonus;
        } else {
          // Cap reached, skip bonus for remaining submissions
          skippedCount++;
        }
      }

      // Add to breakdown
      const finalCpmAmount =
        payment_type !== "bonus"
          ? shouldAdjustReward
            ? applyPayoutAdjustment(
                submissionEarnings,
                payoutAdjustmentPercentage,
              )
            : submissionEarnings
          : 0;

      const finalBonusAmount =
        payment_type !== "standard"
          ? shouldAdjustBonus
            ? applyPayoutAdjustment(submissionBonus, payoutAdjustmentPercentage)
            : submissionBonus
          : 0;

      if (finalCpmAmount > 0 || finalBonusAmount > 0) {
        breakdown.push({
          submission_id: sub.id,
          video_title: sub.video_title || "Untitled",
          cpm_amount: finalCpmAmount,
          bonus_amount: finalBonusAmount,
          original_cpm_amount: submissionEarnings,
          original_bonus_amount: submissionBonus,
          created_at: sub.created_at,
        });
        paidCount++;
      } else {
        skippedCount++;
      }
    }

    // Use breakdown totals so credited amount matches adjusted values (not raw totalBonus)
    const totalAmount = breakdown.reduce(
      (sum, b) => sum + b.cpm_amount + b.bonus_amount,
      0,
    );
    const totalCPMPaid = breakdown.reduce((s, b) => s + b.cpm_amount, 0);
    const totalBonusPaid = breakdown.reduce((s, b) => s + b.bonus_amount, 0);

    if (totalAmount === 0) {
      const milestoneHint =
        contest.contest_type === "milestone"
          ? " Milestone: confirm submissions are not already paid, creator max earnings is not exhausted, and view counts qualify for the ladder (pending entries count toward winner limits)."
          : "";
      return NextResponse.json(
        {
          error:
            "No payments to process. All submissions may be already paid or cap reached." +
            milestoneHint,
        },
        { status: 400 },
      );
    }

    // Credit creator wallet
    const creditResult = await creditCreatorWithdrawableBalance(
      creator_id,
      totalAmount,
      `Bulk payment for ${paidCount} submissions in contest: ${
        contest.title || "Contest"
      }`,
      {
        remarks: `Bulk payment: ${payment_type}`,
        metadata: {
          contest_id: contest_id,
          payment_type: payment_type,
          submission_count: paidCount,
          breakdown: breakdown,
          total_cpm: totalCPMPaid,
          total_bonus: totalBonusPaid,
          cap_reached: maxEarnings ? runningTotal >= maxEarnings : false,
        },
      },
    );

    if (!creditResult.success) {
      return NextResponse.json(
        { error: `Failed to credit wallet: ${creditResult.error}` },
        { status: 500 },
      );
    }

    // Update all submissions with earnings and payment status
    const submissionUpdates = breakdown.map((item) => ({
      id: item.submission_id,
      cpm_amount: item.cpm_amount,
      bonus_amount: item.bonus_amount,
      paid: payment_type !== "bonus" ? true : undefined,
      paid_at: payment_type !== "bonus" ? new Date().toISOString() : undefined,
      bonus_paid: payment_type !== "standard" ? true : undefined,
      bonus_paid_at:
        payment_type !== "standard" ? new Date().toISOString() : undefined,
    }));

    // Update each submission
    for (const update of submissionUpdates) {
      const updatePayload: any = {};

      // Always update earnings (CPM amount) and status if paying standard or both
      if (payment_type !== "bonus") {
        updatePayload.earnings = update.cpm_amount;
        updatePayload.paid = update.paid;
        updatePayload.paid_at = update.paid_at;
        updatePayload.status = "paid"; // Update status to 'paid'
      }

      // Update bonus payment status and amount
      if (update.bonus_paid !== undefined) {
        updatePayload.bonus_paid = update.bonus_paid;
        updatePayload.bonus_paid_at = update.bonus_paid_at;
        updatePayload.bonus_amount = update.bonus_amount; // Store actual bonus amount paid
      }

      const { error: updateError } = await supabaseAdmin
        .from("submissions")
        .update(updatePayload)
        .eq("id", update.id);

      if (updateError) {
        console.error(`Failed to update submission ${update.id}:`, updateError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully paid ${paidCount} submissions`,
      data: {
        total_amount: totalAmount,
        total_cpm: totalCPMPaid,
        total_bonus: totalBonusPaid,
        paid_count: paidCount,
        skipped_count: skippedCount,
        breakdown: breakdown,
        transaction_id: creditResult.transactionId,
        cap_reached: maxEarnings ? runningTotal >= maxEarnings : false,
        remaining_cap: maxEarnings
          ? Math.max(0, maxEarnings - runningTotal)
          : null,
      },
    });
  } catch (error: any) {
    console.error("Error processing bulk payment:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 },
    );
  }
}
