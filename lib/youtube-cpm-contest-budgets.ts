import { fetchContestSubmissionsAllPages } from "@/lib/fetch-contest-submissions";

type CpmBudgetSubmissionRow = {
  creator_id: string;
  views?: number | null;
  paid?: boolean | null;
  bonus_paid?: boolean | null;
  earnings?: number | null;
  bonus_amount?: number | null;
};

/**
 * CPM budget rollup for YouTube (and shared contest CPM config). Used by the
 * YouTube metrics cron and the queue processor after a refresh run completes.
 */
export async function updateYouTubeCpmContestBudgets(
  supabaseAdmin: { from: (t: string) => any },
  contestId?: string
): Promise<void> {
  try {
    let contestsQuery = supabaseAdmin
      .from("contests")
      .select("id, contest_based_details, views_locked_at")
      .eq("contest_type", "cpm")
      .not("contest_based_details", "is", null)
      .is("views_locked_at", null);

    if (contestId) {
      contestsQuery = contestsQuery.eq("id", contestId);
    }

    const { data: contests, error } = await contestsQuery;

    if (error || !contests?.length) {
      console.log("No CPM contests to update");
      return;
    }

    for (const contest of contests) {
      const cpmConfig = contest.contest_based_details?.cpm_contest;
      if (!cpmConfig?.cpm_rate_usd) continue;

      const { data: contestDetails } = await supabaseAdmin
        .from("contests")
        .select("max_earnings_per_creator")
        .eq("id", contest.id)
        .single();

      const maxEarningsPerCreator = contestDetails?.max_earnings_per_creator || null;

      const { data: submissions } =
        await fetchContestSubmissionsAllPages<CpmBudgetSubmissionRow>(
          supabaseAdmin,
          contest.id,
          "views, creator_id, created_at, paid, bonus_paid, earnings, bonus_amount",
          {
            statusIn: ["verified", "paid"],
            order: { column: "created_at", ascending: true },
          },
        );

      if (!submissions?.length) continue;

      const creatorEarnings = new Map<string, { cpmTotal: number; bonusTotal: number }>();
      const flatFeeBonus = cpmConfig.flat_fee_bonus || 0;
      const flatFeeBonusCap = cpmConfig.flat_fee_bonus_cap || null;

      let totalBonusSpentSoFar = 0;
      const capInDollars = flatFeeBonusCap ? flatFeeBonusCap / 100 : null;

      for (const sub of submissions) {
        const creatorId = sub.creator_id;
        if (!creatorEarnings.has(creatorId)) {
          creatorEarnings.set(creatorId, { cpmTotal: 0, bonusTotal: 0 });
        }

        const creatorData = creatorEarnings.get(creatorId)!;

        if (sub.paid && sub.earnings != null) {
          creatorData.cpmTotal += sub.earnings / 100;
        } else {
          let views = sub.views || 0;
          if (cpmConfig.min_views && views < cpmConfig.min_views) views = 0;
          if (cpmConfig.max_views && views > cpmConfig.max_views) views = cpmConfig.max_views;

          const submissionEarnings = (views * cpmConfig.cpm_rate_usd) / 1000;

          if (maxEarningsPerCreator) {
            const maxEarningsInDollars = maxEarningsPerCreator / 100;
            const remainingCap = maxEarningsInDollars - creatorData.cpmTotal;
            if (remainingCap > 0) {
              creatorData.cpmTotal += Math.min(submissionEarnings, remainingCap);
            }
          } else {
            creatorData.cpmTotal += submissionEarnings;
          }
        }

        if (sub.bonus_paid && sub.bonus_amount != null) {
          const actualBonus = sub.bonus_amount / 100;
          creatorData.bonusTotal += actualBonus;
          totalBonusSpentSoFar += actualBonus;
        } else if (flatFeeBonus > 0) {
          const bonusAmount = flatFeeBonus / 100;
          if (capInDollars === null || totalBonusSpentSoFar + bonusAmount <= capInDollars) {
            creatorData.bonusTotal += bonusAmount;
            totalBonusSpentSoFar += bonusAmount;
          }
        }
      }

      let totalCPM = 0;
      let totalBonus = 0;
      for (const [, earnings] of creatorEarnings) {
        totalCPM += earnings.cpmTotal;
        totalBonus += earnings.bonusTotal;
      }

      const totalSpent = totalCPM + totalBonus;

      const now = new Date().toISOString();
      await supabaseAdmin
        .from("contests")
        .update({
          contest_based_details: {
            ...contest.contest_based_details,
            cpm_contest: {
              ...cpmConfig,
              budget_spent: Math.round(totalSpent * 100),
            },
          },
          last_metrics_updated: now,
          updated_at: now,
        })
        .eq("id", contest.id);
    }
  } catch (error) {
    console.error("CPM budget update failed:", error);
  }
}
