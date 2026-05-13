import { createHash } from "node:crypto";
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  creditCreatorWithdrawableBalance,
  debitCreatorWithdrawableBalance,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import {
  adjustBonusCents,
  adjustRewardCents,
  parsePayoutAdjustment,
} from "@/lib/payout-rules";
import { allocateFlatFeeBonusCents } from "@/lib/bonus-allocation";
import { buildMilestoneSubmissionPayoutCentsMap } from "@/lib/milestone-contest-expected-spend";
import { countRefundsForCreatorContest } from "@/lib/contest-payout-idempotency";
import { buildFlatFeeBonusExpectedCentsBySubmissionId } from "@/lib/twitter-cpm-bonus-expected";

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

    // Check if user is admin
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (!userData || userData.user_type !== "admin") {
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

    if (typeof contest_id !== "string" || contest_id.trim().length === 0) {
      return NextResponse.json(
        { error: "contest_id is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    if (typeof creator_id !== "string" || creator_id.trim().length === 0) {
      return NextResponse.json(
        { error: "creator_id is required and must be a non-empty string" },
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

    // Financial safety guard:
    // all selected submissions must belong to the same creator we are crediting.
    const mismatchedCreatorSubmission = submissions.find(
      (s) => String(s.creator_id || "") !== creator_id,
    );
    if (mismatchedCreatorSubmission) {
      return NextResponse.json(
        {
          error:
            "creator_id does not match one or more selected submissions. Refusing to process payout.",
        },
        { status: 400 },
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

    // Filter to verified (or legacy "approved") submissions — same notion as verify-submission / UI.
    // For bonus-only payouts, also accept rows whose standard reward was already paid
    // (status="paid" or paid=true) but whose flat-fee bonus is still unpaid. This mirrors
    // the Twitter CPM bulk payout, which already supports paying bonus after standard.
    const verifiedSubmissions = submissions.filter((s) => {
      const st = String(s.status || "").toLowerCase();
      if (st === "verified" || st === "approved") return true;
      if (payment_type === "bonus") {
        const isPaidRow = st === "paid" || s.paid === true;
        return isPaidRow && s.bonus_paid !== true;
      }
      return false;
    });

    if (verifiedSubmissions.length === 0) {
      return NextResponse.json(
        {
          error:
            payment_type === "bonus"
              ? "No eligible submissions found. Bonus can be paid on verified rows, or already-paid rows whose bonus has not been paid yet."
              : "No verified submissions found",
        },
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

    const maxEarnings =
      contest.max_earnings_per_creator ||
      contestDetails?.max_earnings_per_creator ||
      null;

    // Simple contest-level payout adjustment (percentage + mode)
    const payoutAdjustmentPercentage =
      typeof contest.payout_adjustment_percentage === "number"
        ? contest.payout_adjustment_percentage
        : typeof contest.payout_adjustment_percentage === "string"
          ? parseFloat(contest.payout_adjustment_percentage) || 0
          : 0;
    const payoutAdjustmentMode = contest.payout_adjustment_mode as
      | "cpm_only"
      | "milestone_only"
      | "bonus_only"
      | "combined"
      | "dual_rewards_only"
      | null;
    const hasPayoutAdjustment =
      payoutAdjustmentPercentage > 0 && !!payoutAdjustmentMode;
    const shouldAdjustReward =
      hasPayoutAdjustment &&
      (payoutAdjustmentMode === "combined" ||
        payoutAdjustmentMode === "dual_rewards_only" ||
        payoutAdjustmentMode === "cpm_only" ||
        payoutAdjustmentMode === "milestone_only");
    const shouldAdjustBonus =
      hasPayoutAdjustment &&
      (payoutAdjustmentMode === "combined" ||
        payoutAdjustmentMode === "dual_rewards_only" ||
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
    let bonusReasonCounts: Record<string, number> = {};
    let globalExpectedBonusMap = new Map<string, number>();

    const { data: bonusSpendingData } = await supabaseAdmin
      .from("submissions")
      .select("bonus_amount")
      .eq("contest_id", contest_id)
      .eq("bonus_paid", true);
    const currentBonusSpent = (bonusSpendingData || []).reduce(
      (sum, sub) => sum + (sub.bonus_amount || 0),
      0,
    );
    let runningBonusSpent = currentBonusSpent;
    if (payment_type !== "standard" && flatFeeBonus > 0) {
      // Fetch every contest submission and let `buildFlatFeeBonusExpectedCentsBySubmissionId`
      // apply its internal eligibility rule (status in verified/approved/paid OR paid=true).
      // We intentionally avoid pre-filtering with `.or(...)` on Supabase because the
      // PostgREST `.or()` syntax parses commas inside `in.(...)` as top-level filter
      // separators, which yields an empty result and silently breaks the bonus map.
      const { data: contestEligibleSubs } = await supabaseAdmin
        .from("submissions")
        .select("id, created_at, status, paid")
        .eq("contest_id", contest_id);
      globalExpectedBonusMap = buildFlatFeeBonusExpectedCentsBySubmissionId(
        contest as any,
        (contestEligibleSubs || []).map((s: any) => ({
          id: String(s.id),
          created_at: s.created_at,
          status: s.status,
          paid: s.paid === true,
        })),
      );
    }

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
        if (contest.contest_type === "milestone") {
          submissionEarnings =
            milestonePayoutBySubmissionId.get(String(sub.id)) || 0;
        } else {
          // Numeric normalize: DB/JSON may send string "0" which is truthy and would skip CPM math below.
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
          }
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
        const adjustedSubmissionEarnings = adjustRewardCents(submissionEarnings, {
          shouldAdjustReward,
          percentage: payoutAdjustment.percentage,
        });

        totalCPM += adjustedSubmissionEarnings;
      }

      // Calculate bonus
      let submissionBonus = 0;
      if (payment_type !== "standard" && flatFeeBonus > 0 && !sub.bonus_paid) {
        const expectedBonusForSubmission =
          globalExpectedBonusMap.get(String(sub.id)) || 0;
        if (expectedBonusForSubmission <= 0) {
          bonusReasonCounts.not_expected =
            (bonusReasonCounts.not_expected || 0) + 1;
          submissionBonus = 0;
        } else {
        const bonusLimit =
          contest.contest_type === "leaderboard"
            ? totalBudget
            : contest.contest_type === "cpm"
              ? flatFeeBonusCap
              : null;
        const remainingBudget =
          bonusLimit != null ? Math.max(0, bonusLimit - runningBonusSpent) : null;
        const bonusAllocation = allocateFlatFeeBonusCents(
          flatFeeBonus,
          remainingBudget,
        );
        submissionBonus = bonusAllocation.amount;
        bonusReasonCounts[bonusAllocation.reason] =
          (bonusReasonCounts[bonusAllocation.reason] || 0) + 1;
        submissionBonus = Math.min(submissionBonus, expectedBonusForSubmission);
        if (submissionBonus > 0) {
          runningBonusSpent += submissionBonus;
          totalBonus += submissionBonus;
        }
        }
      }

      // Add to breakdown
      const finalCpmAmount =
        payment_type !== "bonus"
          ? adjustRewardCents(submissionEarnings, {
              shouldAdjustReward,
              percentage: payoutAdjustment.percentage,
            })
          : 0;

      const finalBonusAmount =
        payment_type !== "standard"
          ? adjustBonusCents(submissionBonus, {
              shouldAdjustBonus,
              percentage: payoutAdjustment.percentage,
            })
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

      // For bonus payouts, surface the specific reason buckets so admins can
      // tell whether the rows hit the bonus budget cap, fell outside the
      // contest's expected bonus window (FCFS allocation by created_at), or
      // were already bonus_paid. Without this, the generic message is
      // confusing when no bonus has actually been credited yet.
      if (payment_type === "bonus") {
        const alreadyBonusPaid = sortedSubmissions.filter(
          (s) => s.bonus_paid === true,
        ).length;
        const notExpected = bonusReasonCounts.not_expected || 0;
        const capExhausted = bonusReasonCounts.cap_exhausted || 0;
        const partialZero = bonusReasonCounts.partial_remainder || 0;

        // Per-submission diagnostic so admins can compare with the UI's
        // "Expected bonus" column when the buckets above seem to disagree
        // with what's on screen.
        const perSubmissionDiagnostic = sortedSubmissions.map((s) => ({
          submission_id: s.id,
          status: s.status,
          paid: s.paid === true,
          bonus_paid: s.bonus_paid === true,
          in_eligible_map: globalExpectedBonusMap.has(String(s.id)),
          expected_bonus_cents:
            globalExpectedBonusMap.get(String(s.id)) ?? null,
        }));

        const reasonParts: string[] = [];
        if (alreadyBonusPaid > 0) {
          reasonParts.push(
            `${alreadyBonusPaid} already had bonus paid`,
          );
        }
        if (notExpected > 0) {
          reasonParts.push(
            `${notExpected} fall outside this contest's bonus budget allocation`,
          );
        }
        if (capExhausted > 0) {
          reasonParts.push(
            `${capExhausted} hit the bonus cap at runtime`,
          );
        }
        if (partialZero > 0) {
          reasonParts.push(
            `${partialZero} had bonus adjusted to 0 by the payout adjustment`,
          );
        }
        const reasonSummary = reasonParts.length
          ? ` ${reasonParts.join("; ")}.`
          : "";
        const tip =
          notExpected > 0
            ? " Bonus is allocated first-come-first-served by submission date until flat_fee_bonus_cap (or total_budget if no cap is set) is exhausted. To pay these rows, raise the cap/budget or pick earlier submissions."
            : "";

        console.warn("[bulk-payment] bonus payout produced 0 total amount", {
          contest_id,
          creator_id,
          flatFeeBonus,
          flatFeeBonusCap,
          totalBudget,
          currentBonusSpent,
          globalExpectedBonusMapSize: globalExpectedBonusMap.size,
          bonusReasonCounts,
          alreadyBonusPaid,
          perSubmissionDiagnostic,
        });

        return NextResponse.json(
          {
            error: "No bonus payments to process." + reasonSummary + tip,
            bonus_reason_counts: bonusReasonCounts,
            already_bonus_paid: alreadyBonusPaid,
            per_submission_diagnostic: perSubmissionDiagnostic,
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          error:
            "No payments to process. All submissions may be already paid or cap reached." +
            milestoneHint,
        },
        { status: 400 },
      );
    }

    const { count: contestRefundCount, errorMessage: refundCountErr } =
      await countRefundsForCreatorContest(
        supabaseAdmin,
        creator_id,
        contest_id,
      );
    if (refundCountErr) {
      console.error(
        "[bulk-payment] failed to count contest refunds for idempotency:",
        refundCountErr,
      );
      return NextResponse.json(
        {
          error:
            "Cannot verify refund history for safe payout (idempotency). Try again or contact support.",
          details: refundCountErr,
        },
        { status: 500 },
      );
    }

    // Build idempotency from immutable request intent rather than computed payout breakdown.
    // This keeps retries stable even if a prior attempt partially updated submission rows.
    const requestedSubmissionIds = Array.from(
      new Set(
        submission_ids.map((value: unknown) => String(value)).filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    const operationSeed = JSON.stringify({
      contest_id,
      creator_id,
      payment_type,
      requested_submission_ids: requestedSubmissionIds,
      payout_adjustment_percentage: payoutAdjustment.percentage,
      payout_adjustment_mode: payoutAdjustment.mode ?? null,
      contest_refund_count_at_payout: contestRefundCount,
    });
    const bulkPayIdempotencyKey = `bulk_pay_v2:${createHash("sha256")
      .update(operationSeed)
      .digest("hex")
      .slice(0, 48)}`;

    const creditResult = await creditCreatorWithdrawableBalance(
      creator_id,
      totalAmount,
      `Bulk payment for ${paidCount} submissions in contest: ${
        contest.title || "Contest"
      }`,
      {
        idempotencyKey: bulkPayIdempotencyKey,
        remarks: `Bulk payment: ${payment_type}`,
        metadata: {
          contest_id: contest_id,
          payment_type: payment_type,
          submission_count: paidCount,
          breakdown: breakdown,
          total_cpm: totalCPMPaid,
          total_bonus: totalBonusPaid,
          cap_reached: maxEarnings ? runningTotal >= maxEarnings : false,
          bonus_reason_counts: bonusReasonCounts,
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
      bonus_paid:
        payment_type !== "standard" && item.bonus_amount > 0 ? true : undefined,
      bonus_paid_at:
        payment_type !== "standard" && item.bonus_amount > 0
          ? new Date().toISOString()
          : undefined,
    }));

    const updateFailures: { submission_id: string; message: string }[] = [];
    const appliedUpdates: typeof submissionUpdates = [];
    // Update each submission
    for (const update of submissionUpdates) {
      const updatePayload: Record<string, unknown> = {};

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

      let updateQuery = supabaseAdmin
        .from("submissions")
        .update(updatePayload)
        .eq("id", update.id);

      if (payment_type !== "bonus") {
        updateQuery = updateQuery.neq("paid", true);
      }
      if (update.bonus_paid !== undefined) {
        updateQuery = updateQuery.neq("bonus_paid", true);
      }

      const { data: updatedRows, error: updateError } = await updateQuery
        .select("id")
        .limit(1);

      if (updateError) {
        console.error(`Failed to update submission ${update.id}:`, updateError);
        updateFailures.push({
          submission_id: update.id as string,
          message: updateError.message,
        });
      } else if (!updatedRows || updatedRows.length === 0) {
        updateFailures.push({
          submission_id: update.id as string,
          message:
            "Submission was already claimed by another payout request. Wallet credit will be rolled back if this request applied fresh funds.",
        });
      } else {
        appliedUpdates.push(update);
      }
    }

    if (updateFailures.length > 0) {
      if (!creditResult.alreadyApplied) {
        const rollback = await debitCreatorWithdrawableBalance(
          creator_id,
          totalAmount,
        );
        if (rollback.success) {
          await logTransactionAsAdmin(
            creator_id,
            "refund",
            totalAmount,
            "success",
            `Rollback: bulk payment row update failed for ${
              contest.title || "Contest"
            }`,
            {
              remarks: REVERSAL_TRANSACTION_REMARK,
              paymentMethod: "refund",
              metadata: {
                contest_id,
                payout_type: "bulk_payment_rollback",
                original_reward_transaction_id: creditResult.transactionId,
                payout_operation_key: bulkPayIdempotencyKey,
                update_failures: updateFailures,
              },
            },
          );
        } else {
          console.error(
            "[bulk-payment] CRITICAL: wallet rollback failed after submission update failure:",
            rollback.error,
          );
        }

        for (const applied of appliedUpdates) {
          const revertPayload: Record<string, unknown> = {};
          if (payment_type !== "bonus") {
            revertPayload.earnings = null;
            revertPayload.paid = false;
            revertPayload.paid_at = null;
            revertPayload.status = "verified";
          }
          if (applied.bonus_paid !== undefined) {
            revertPayload.bonus_paid = false;
            revertPayload.bonus_paid_at = null;
            revertPayload.bonus_amount = null;
          }
          if (Object.keys(revertPayload).length > 0) {
            await supabaseAdmin
              .from("submissions")
              .update(revertPayload)
              .eq("id", applied.id);
          }
        }
      }

      return NextResponse.json(
        {
          error:
            creditResult.alreadyApplied
              ? "Payout credit was already applied earlier, but one or more submission rows still could not be reconciled. Retry or contact support."
              : "Submission rows could not be marked paid. Fresh wallet credit was rolled back where possible; retry after resolving the listed rows.",
          updateFailures,
          transaction_id: creditResult.transactionId,
          already_applied_idempotent: Boolean(creditResult.alreadyApplied),
          payout_operation_key: bulkPayIdempotencyKey,
        },
        { status: 500 },
      );
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
        payout_idempotent_retry: Boolean(creditResult.alreadyApplied),
        payout_operation_key: bulkPayIdempotencyKey,
        cap_reached: maxEarnings ? runningTotal >= maxEarnings : false,
        bonus_reason_counts: bonusReasonCounts,
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
