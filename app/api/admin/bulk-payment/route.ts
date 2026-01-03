import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { creditCreatorWithdrawableBalance } from "@/lib/payment-utils";

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
    const {
      submission_ids,
      payment_type,
      contest_id,
      creator_id,
    } = body;

    if (!submission_ids || !Array.isArray(submission_ids) || submission_ids.length === 0) {
      return NextResponse.json({ error: "submission_ids is required and must be a non-empty array" }, { status: 400 });
    }

    if (!["standard", "bonus", "both"].includes(payment_type)) {
      return NextResponse.json({ error: "payment_type must be standard, bonus, or both" }, { status: 400 });
    }

    // Fetch all submissions
    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .in("id", submission_ids)
      .eq("contest_id", contest_id);

    if (submissionsError || !submissions || submissions.length === 0) {
      return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
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
    if (contest.post_contest_status !== 'verification_complete') {
      return NextResponse.json({ 
        error: 'Payments can only be processed when contest status is \'verification_complete\'' 
      }, { status: 400 });
    }

    // Filter to verified submissions only
    const verifiedSubmissions = submissions.filter(s => s.status === "verified");

    if (verifiedSubmissions.length === 0) {
      return NextResponse.json({ error: "No verified submissions found" }, { status: 400 });
    }

    // Sort by submission time (earliest first)
    const sortedSubmissions = verifiedSubmissions.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Get flat fee bonus and total budget
    const contestDetails = contest.contest_type === "cpm"
      ? (contest.contest_based_details as any)?.cpm_contest
      : (contest.contest_based_details as any)?.leaderboard_contest;
    
    const flatFeeBonus = contestDetails?.flat_fee_bonus || 0;
    const totalBudget = contestDetails?.total_budget || null;

    const maxEarnings = contest.max_earnings_per_creator || null;

    // For leaderboard contests with total_budget, check if budget would be exceeded
    if (contest.contest_type === "leaderboard" && totalBudget && (payment_type === "bonus" || payment_type === "both")) {
      // Calculate current bonus spending
      const { data: bonusSpendingData } = await supabaseAdmin
        .from('submissions')
        .select('bonus_amount')
        .eq('contest_id', contest_id)
        .eq('bonus_paid', true);
      
      const currentBonusSpent = (bonusSpendingData || [])
        .reduce((sum, sub) => sum + (sub.bonus_amount || 0), 0);
      
      // Calculate potential bonus spending for this bulk payment
      const potentialBonusSpending = verifiedSubmissions.length * flatFeeBonus;
      
      if (currentBonusSpent + potentialBonusSpending > totalBudget) {
        return NextResponse.json({
          error: 'Total budget would be exceeded',
          details: {
            currentSpent: currentBonusSpent,
            potentialSpending: potentialBonusSpending,
            budgetLimit: totalBudget,
            remaining: totalBudget - currentBonusSpent,
            maxSubmissions: Math.floor((totalBudget - currentBonusSpent) / flatFeeBonus)
          }
        }, { status: 400 });
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

    const alreadyPaidAmount = previousSubmissions?.reduce((sum, s) => sum + (s.earnings || 0), 0) || 0;
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
        // Use stored earnings or calculate from views
        submissionEarnings = sub.earnings || 0;

        // If earnings not stored, calculate dynamically for CPM contests
        if (!submissionEarnings && contest.contest_type === "cpm") {
          const cpmConfig = (contest.contest_based_details as any)?.cpm_contest;
          if (cpmConfig?.cpm_rate_usd) {
            let effectiveViews = sub.views || 0;
            
            // Apply min_views threshold
            if (cpmConfig.min_views != null && effectiveViews < cpmConfig.min_views) {
              effectiveViews = 0;
            }
            
            // Apply max_views cap
            if (cpmConfig.max_views != null && effectiveViews > cpmConfig.max_views) {
              effectiveViews = cpmConfig.max_views;
            }
            
            // Calculate earnings: (views * CPM rate) / 1000, convert to cents
            const calculatedEarnings = (effectiveViews * cpmConfig.cpm_rate_usd * 100) / 1000;
            submissionEarnings = Math.round(calculatedEarnings);
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

        totalCPM += submissionEarnings;
      }

      // Calculate bonus
      let submissionBonus = 0;
      if (payment_type !== "standard" && flatFeeBonus > 0 && !sub.bonus_paid) {
        submissionBonus = flatFeeBonus;
        totalBonus += submissionBonus;
      }

      // Add to breakdown
      if (submissionEarnings > 0 || submissionBonus > 0) {
        breakdown.push({
          submission_id: sub.id,
          video_title: sub.video_title || "Untitled",
          cpm_amount: submissionEarnings,
          bonus_amount: submissionBonus,
          created_at: sub.created_at,
        });
        paidCount++;
      } else {
        skippedCount++;
      }
    }

    const totalAmount = totalCPM + totalBonus;

    if (totalAmount === 0) {
      return NextResponse.json({ 
        error: "No payments to process. All submissions may be already paid or cap reached." 
      }, { status: 400 });
    }

    // Credit creator wallet
    const creditResult = await creditCreatorWithdrawableBalance(
      creator_id,
      totalAmount,
      `Bulk payment for ${paidCount} submissions in contest: ${contest.title || "Contest"}`,
      {
        remarks: `Bulk payment: ${payment_type}`,
        metadata: {
          contest_id: contest_id,
          payment_type: payment_type,
          submission_count: paidCount,
          breakdown: breakdown,
          total_cpm: totalCPM,
          total_bonus: totalBonus,
          cap_reached: maxEarnings ? runningTotal >= maxEarnings : false,
        },
      }
    );

    if (!creditResult.success) {
      return NextResponse.json({ error: `Failed to credit wallet: ${creditResult.error}` }, { status: 500 });
    }

    // Update all submissions with earnings and payment status
    const submissionUpdates = breakdown.map(item => ({
      id: item.submission_id,
      cpm_amount: item.cpm_amount,
      bonus_amount: item.bonus_amount,
      paid: payment_type !== "bonus" ? true : undefined,
      paid_at: payment_type !== "bonus" ? new Date().toISOString() : undefined,
      bonus_paid: payment_type !== "standard" ? true : undefined,
      bonus_paid_at: payment_type !== "standard" ? new Date().toISOString() : undefined,
    }));

    // Update each submission
    for (const update of submissionUpdates) {
      const updatePayload: any = {};
      
      // Always update earnings (CPM amount) and status if paying standard or both
      if (payment_type !== "bonus") {
        updatePayload.earnings = update.cpm_amount;
        updatePayload.paid = update.paid;
        updatePayload.paid_at = update.paid_at;
        updatePayload.status = 'paid';  // Update status to 'paid'
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
        total_cpm: totalCPM,
        total_bonus: totalBonus,
        paid_count: paidCount,
        skipped_count: skippedCount,
        breakdown: breakdown,
        transaction_id: creditResult.transactionId,
        cap_reached: maxEarnings ? runningTotal >= maxEarnings : false,
        remaining_cap: maxEarnings ? Math.max(0, maxEarnings - runningTotal) : null,
      },
    });

  } catch (error: any) {
    console.error("Error processing bulk payment:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

