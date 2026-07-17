"use client";

import { calculateMilestoneBudgetSpent } from "@/lib/contest-utils-client";
import {
  computeBudgetPaidCents,
  getBudgetTileMode,
  type BudgetTileSubmission,
} from "@/lib/contest-budget-tile-metrics";
import { getDualRewardsSubmissionPaidComponents } from "@/lib/dual-rewards-pool-budget";
import {
  getPoolBudgetCentsFromDetails,
  isCpmContestType,
  isMilestoneContestType,
} from "@/lib/contest-type";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

interface Submission {
  id?: string;
  paid: boolean;
  earnings: number | null;
  bonus_paid: boolean;
  bonus_amount?: number;
  paid_at?: string | null;
  status?: string;
}

interface Contest {
  total_budget?: number | null;
  contest_based_details: any;
  contest_type: string;
  max_earnings_per_creator?: number | null;
}

interface BudgetProgressProps {
  contest: Contest;
  submissions: Submission[];
  showDetailed?: boolean; // Toggle between simple and detailed view
  creatorManualPointsAdjustments?: Record<string, number>;
  /** Cents — same sum as creator-wise milestone "expected" (per-submission model). When set, overrides aggregate milestone spend. */
  milestoneExpectedPayoutCents?: number | null;
  /** Cents — creator bonus pools (views + reels) expected, aligned with creator-wise columns */
  milestoneCreatorBonusExpectedCents?: number | null;
  /** Cents — creator bonus actually marked paid on submissions (subset of expected) */
  milestoneCreatorBonusPaidCents?: number | null;
  /** Per-submission expected payout cents for milestone logic */
  milestoneExpectedPayoutBySubmissionId?: Map<string, number> | null;
  /** When payouts_processed, show paid amounts instead of expected fill */
  postContestStatus?: string | null;
}

export function BudgetProgress({
  contest,
  submissions,
  showDetailed = true,
  creatorManualPointsAdjustments,
  milestoneExpectedPayoutCents = null,
  milestoneCreatorBonusExpectedCents = null,
  milestoneCreatorBonusPaidCents = null,
  milestoneExpectedPayoutBySubmissionId = null,
  postContestStatus = null,
}: BudgetProgressProps) {
  const [mode, setMode] = useState<"light" | "dark">("light");
  // Get contest config outside useMemo so it's available in the component
  const cpmConfig = isCpmContestType(contest.contest_type)
    ? (contest.contest_based_details as any)?.cpm_contest
    : null;
  const leaderboardConfig =
    contest.contest_type === "leaderboard"
      ? (contest.contest_based_details as any)?.leaderboard_contest
      : null;

  const flatFeeBonus =
    cpmConfig?.flat_fee_bonus || leaderboardConfig?.flat_fee_bonus || 0;
  const milestoneContestConfig = isMilestoneContestType(
    contest.contest_type,
  )
    ? (contest.contest_based_details as any)?.milestone_contest
    : null;
  const milestoneCreatorBonusConfigured = Boolean(
    milestoneContestConfig?.bonus?.enabled &&
      (milestoneContestConfig?.bonus?.most_verified_views ||
        milestoneContestConfig?.bonus?.most_verified_reels),
  );
  const hasFlatFeeBonus =
    (contest.contest_type !== "dual_rewards" && flatFeeBonus > 0) ||
    (isMilestoneContestType(contest.contest_type) &&
      (milestoneCreatorBonusConfigured ||
        (typeof milestoneCreatorBonusExpectedCents === "number" &&
          milestoneCreatorBonusExpectedCents > 0) ||
        (typeof milestoneCreatorBonusPaidCents === "number" &&
          milestoneCreatorBonusPaidCents > 0)));

  const {
    cpmPaid,
    bonusPaid,
    totalBudget,
    cpmPercentage,
    bonusPercentage,
    bonusPercentageOfTotal,
    totalPercentage,
    prizePoolSpent,
    prizePoolTotal,
    bonusBudget,
    bonusSpent,
    totalSpent,
  } = useMemo(() => {
    // Use contest row total_budget when set; else pool from contest_based_details (dual: root total_budget_cents via helper)
    let totalBudget =
      contest.total_budget && contest.total_budget > 0
        ? contest.total_budget
        : 0;
    if (totalBudget <= 0 && contest.contest_type !== "leaderboard") {
      totalBudget = getPoolBudgetCentsFromDetails(
        contest.contest_type,
        contest.contest_based_details,
      );
    }

    const prizePoolTotal =
      contest.contest_type === "leaderboard"
        ? leaderboardConfig?.total_prize || 0
        : 0;

    // For CPM contests, use flat_fee_bonus_cap if configured, otherwise total_budget
    // For leaderboard contests, use total_budget
    const bonusBudget =
      isCpmContestType(contest.contest_type) && cpmConfig?.flat_fee_bonus_cap
        ? cpmConfig.flat_fee_bonus_cap
        : contest.total_budget || 0;

    const maxEarningsPerCreator =
      (contest as any).max_earnings_per_creator || null;
    const cpmRate = cpmConfig?.cpm_rate_usd || 0;
    const minViews = cpmConfig?.min_views;
    const maxViews = cpmConfig?.max_views;

    // Group submissions by creator to apply cap correctly
    const creatorEarnings = new Map<
      string,
      { cpmTotal: number; bonusTotal: number }
    >();

    const twitterExcluded = (s: any) =>
      s.is_twitter_tweet === true || s.platform === "twitter"
        ? s.is_eligible === false ||
          (s.deleted_at != null && s.deleted_at !== "")
        : false;

    if (contest.contest_type === "milestone") {
      const milestoneContest = (contest.contest_based_details as any)
        ?.milestone_contest;
      const milestones = milestoneContest?.milestones || [];
      const normalizeMilestoneStatus = (raw: unknown) => {
        const st = String(raw || "").toLowerCase();
        return st === "approved" ? "verified" : st;
      };
      const subsForMilestone = submissions.map((s) => ({
        ...(s as object),
        status: normalizeMilestoneStatus((s as any).status),
      }));

      // After payouts are processed: use actual paid amounts only (same as CPM / dual).
      if (getBudgetTileMode(postContestStatus) === "paid") {
        let mainPaid = 0;
        let bonusPaidFromSubmissions = 0;
        for (const s of submissions) {
          if (twitterExcluded(s)) continue;
          const st = normalizeMilestoneStatus((s as any).status).toLowerCase();
          const isPaidSubmission =
            st === "paid" ||
            Boolean((s as any).paid_at) ||
            (s as any).paid === true;
          if (isPaidSubmission && (s as any).earnings != null) {
            mainPaid += Math.max(0, Number((s as any).earnings) || 0);
          }
          if ((s as any).bonus_paid && (s as any).bonus_amount != null) {
            bonusPaidFromSubmissions += Math.max(
              0,
              Number((s as any).bonus_amount) || 0,
            );
          }
        }

        const useDetailBonusPaidMap =
          typeof milestoneCreatorBonusPaidCents === "number" &&
          !Number.isNaN(milestoneCreatorBonusPaidCents) &&
          milestoneCreatorBonusPaidCents >= 0;
        const bonusPaidCents = useDetailBonusPaidMap
          ? Math.round(milestoneCreatorBonusPaidCents)
          : bonusPaidFromSubmissions;

        const totalSpentRaw = mainPaid + bonusPaidCents;
        const totalSpent =
          totalBudget > 0
            ? Math.min(totalSpentRaw, totalBudget)
            : totalSpentRaw;
        const cpmPercentage =
          totalBudget > 0 ? Math.min((mainPaid / totalBudget) * 100, 100) : 0;
        const bonusPercentageOfTotal =
          totalBudget > 0
            ? Math.min((bonusPaidCents / totalBudget) * 100, 100)
            : 0;
        const totalPercentage =
          totalBudget > 0
            ? Math.min((totalSpent / totalBudget) * 100, 100)
            : 0;

        return {
          cpmPaid: mainPaid,
          bonusPaid: bonusPaidCents,
          totalBudget,
          cpmPercentage,
          bonusPercentage: 0,
          bonusPercentageOfTotal,
          totalPercentage,
          prizePoolSpent: 0,
          prizePoolTotal: 0,
          bonusBudget: 0,
          bonusSpent: bonusPaidCents,
          totalSpent,
        };
      }

      const milestoneDollars =
        milestones.length > 0
          ? calculateMilestoneBudgetSpent(subsForMilestone as any, milestones)
          : 0;
      const aggregateMilestoneCents = Math.round(milestoneDollars * 100);
      const expectedBySubmissionMap =
        milestoneExpectedPayoutBySubmissionId instanceof Map
          ? milestoneExpectedPayoutBySubmissionId
          : null;

      // Paid-first model (pre payouts_processed):
      // - If a submission is paid and has stored earnings, use paid amount.
      // - Otherwise use expected payout.
      let blendedMilestonePayoutCents = 0;
      for (const s of submissions) {
        const st = normalizeMilestoneStatus((s as any).status).toLowerCase();
        if (st !== "verified" && st !== "paid") continue;
        if (twitterExcluded(s)) continue;

        const isPaidSubmission =
          st === "paid" ||
          Boolean((s as any).paid_at) ||
          (s as any).paid === true;
        const paidEarningsCents = Number((s as any).earnings || 0);
        const expectedCents =
          expectedBySubmissionMap?.get(String((s as any).id || "")) ?? 0;

        if (isPaidSubmission && paidEarningsCents > 0) {
          blendedMilestonePayoutCents += paidEarningsCents;
        } else {
          blendedMilestonePayoutCents += expectedCents;
        }
      }

      const hasBlendedMilestone =
        expectedBySubmissionMap != null || blendedMilestonePayoutCents > 0;
      const useDetailMilestone =
        typeof milestoneExpectedPayoutCents === "number" &&
        !Number.isNaN(milestoneExpectedPayoutCents) &&
        milestoneExpectedPayoutCents >= 0;
      const cpmPaid = hasBlendedMilestone
        ? blendedMilestonePayoutCents
        : useDetailMilestone
          ? Math.round(milestoneExpectedPayoutCents)
          : aggregateMilestoneCents;

      let bonusPaidFromSubmissions = 0;
      for (const s of submissions) {
        const st = normalizeMilestoneStatus((s as any).status).toLowerCase();
        if (st !== "verified" && st !== "paid") continue;
        if (twitterExcluded(s)) continue;
        if ((s as any).bonus_paid && (s as any).bonus_amount != null) {
          bonusPaidFromSubmissions += Number((s as any).bonus_amount) || 0;
        }
      }

      const useDetailBonusExpected =
        typeof milestoneCreatorBonusExpectedCents === "number" &&
        !Number.isNaN(milestoneCreatorBonusExpectedCents) &&
        milestoneCreatorBonusExpectedCents >= 0;
      const bonusExpectedCents = useDetailBonusExpected
        ? Math.round(milestoneCreatorBonusExpectedCents)
        : 0;

      const useDetailBonusPaidMap =
        typeof milestoneCreatorBonusPaidCents === "number" &&
        !Number.isNaN(milestoneCreatorBonusPaidCents) &&
        milestoneCreatorBonusPaidCents >= 0;
      const bonusPaidFromMap = useDetailBonusPaidMap
        ? Math.round(milestoneCreatorBonusPaidCents)
        : null;

      // Paid-first for bonus as well:
      // actual paid bonus + expected unpaid remainder.
      const actualPaidBonusCents =
        bonusPaidFromMap !== null && bonusPaidFromMap > 0
          ? bonusPaidFromMap
          : bonusPaidFromSubmissions;
      const unpaidExpectedBonusCents = useDetailBonusExpected
        ? Math.max(bonusExpectedCents - actualPaidBonusCents, 0)
        : 0;
      const bonusPaidCents = actualPaidBonusCents + unpaidExpectedBonusCents;

      const totalSpent = cpmPaid + bonusPaidCents;
      const cpmPercentage =
        totalBudget > 0 ? Math.min((cpmPaid / totalBudget) * 100, 100) : 0;
      const bonusPercentage = 0;
      const bonusPercentageOfTotal =
        totalBudget > 0
          ? Math.min((bonusPaidCents / totalBudget) * 100, 100)
          : 0;
      const totalPercentage =
        totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

      return {
        cpmPaid,
        bonusPaid: bonusPaidCents,
        totalBudget,
        cpmPercentage,
        bonusPercentage,
        bonusPercentageOfTotal,
        totalPercentage,
        prizePoolSpent: 0,
        prizePoolTotal: 0,
        bonusBudget: 0,
        bonusSpent: bonusPaidCents,
        totalSpent,
      };
    }

    const relevantSubmissions = submissions.filter((s) => {
      const status = (s as any).status?.toLowerCase();
      return (
        (status === "verified" || status === "paid") && !twitterExcluded(s)
      );
    });

    // Sort by created_at to respect "first submitted, first paid" logic
    const sortedSubmissions = [...relevantSubmissions].sort((a, b) => {
      const dateA = new Date((a as any).created_at || 0).getTime();
      const dateB = new Date((b as any).created_at || 0).getTime();
      return dateA - dateB;
    });

    // Track total bonus spending to apply cap (first-come-first-served)
    const flatFeeBonusCap = cpmConfig?.flat_fee_bonus_cap || null;
    let totalBonusSpentSoFar = 0;
    const capInDollars = flatFeeBonusCap ? flatFeeBonusCap / 100 : null;

    const verifiedCreatorIds = new Set<string>();
    relevantSubmissions.forEach((sub) => {
      const creatorId = (sub as any).creator_id;
      if (creatorId) {
        verifiedCreatorIds.add(creatorId);
      }
    });

    const isDualRewards = contest.contest_type === "dual_rewards";

    for (const sub of sortedSubmissions) {
      const creatorId = (sub as any).creator_id;
      if (!creatorEarnings.has(creatorId)) {
        creatorEarnings.set(creatorId, { cpmTotal: 0, bonusTotal: 0 });
      }

      const creatorData = creatorEarnings.get(creatorId)!;

      // Calculate CPM earnings
      let submissionEarnings = 0;
      const submissionPlatform = (sub as any).platform?.toLowerCase();

      if (submissionPlatform === "twitter") {
        const basePoints = (sub as any).other_stats?.base_points || 0;
        const manualPointsAdjustment =
          (sub as any).manual_points_adjustment || 0;
        const totalPoints = basePoints + manualPointsAdjustment;
        submissionEarnings = (totalPoints * cpmRate) / 1000;
        console.log(
          `[Twitter CPM] basePoints=${basePoints}, manual=${manualPointsAdjustment}, totalPoints=${totalPoints}, cpmRate=${cpmRate}, earnings=${submissionEarnings.toFixed(
            2
          )}`
        );
      } else if (!isDualRewards && sub.paid && sub.earnings != null) {
        // Use actual paid earnings from database for non-Twitter platforms (YouTube, Instagram)
        submissionEarnings = sub.earnings / 100; // Convert cents to dollars
        console.log(
          `[${
            submissionPlatform || "Unknown"
          } Paid] earnings=${submissionEarnings.toFixed(2)}`
        );
      } else {
        // Calculate expected earnings from CPM formula.
        // For dual rewards we intentionally keep CPM contribution formula-based
        // (not from custom paid amount), so CPM + milestone tracker never drops
        // after paying one component.
        let views = (sub as any).views || 0;
        if (minViews != null && views < minViews) views = 0;
        if (maxViews != null && views > maxViews) views = maxViews;
        submissionEarnings = (views * cpmRate) / 1000;
        console.log(
          `[${
            submissionPlatform || "Unknown"
          } Unpaid] views=${views}, cpmRate=${cpmRate}, earnings=${submissionEarnings.toFixed(
            2
          )}`
        );
      }

      // Apply creator cap if configured
      if (maxEarningsPerCreator) {
        const maxInDollars = maxEarningsPerCreator / 100;
        const remainingCap = maxInDollars - creatorData.cpmTotal;
        if (remainingCap > 0) {
          creatorData.cpmTotal += Math.min(submissionEarnings, remainingCap);
        }
        // If cap reached, this submission contributes $0
      } else {
        creatorData.cpmTotal += submissionEarnings;
      }

      // Calculate Bonus - apply cap during calculation (first-come-first-served)
      if ((sub as any).bonus_paid && (sub as any).bonus_amount != null) {
        // Use actual bonus amount from database
        const actualBonus = (sub as any).bonus_amount / 100;
        creatorData.bonusTotal += actualBonus;
        totalBonusSpentSoFar += actualBonus;
      } else if (flatFeeBonus > 0 && contest.contest_type !== "dual_rewards") {
        // For both CPM and leaderboard contests, check if we can add this bonus
        const bonusAmount = flatFeeBonus / 100;
        let budgetCap = null;

        if (isCpmContestType(contest.contest_type) && capInDollars !== null) {
          budgetCap = capInDollars;
        } else if (contest.contest_type === "leaderboard" && totalBudget > 0) {
          // For leaderboard contests, use total_budget as the cap for flat fee bonuses
          budgetCap = totalBudget / 100;
        }

        if (budgetCap !== null) {
          // Calculate remaining budget for bonuses
          const remainingBudget = budgetCap - totalBonusSpentSoFar;

          if (remainingBudget > 0) {
            if (remainingBudget >= bonusAmount) {
              // Full bonus can be granted
              creatorData.bonusTotal += bonusAmount;
              totalBonusSpentSoFar += bonusAmount;
            } else {
              // Only partial bonus remaining - distribute the remaining amount
              creatorData.bonusTotal += remainingBudget;
              totalBonusSpentSoFar += remainingBudget;
            }
          }
          // If no remaining budget, this submission gets $0 bonus (budget exhausted)
        } else {
          // No cap, add full bonus
          creatorData.bonusTotal += bonusAmount;
          totalBonusSpentSoFar += bonusAmount;
        }
      }
    }

    const manualAdjustments = creatorManualPointsAdjustments || {};
    if (
      isCpmContestType(contest.contest_type) &&
      cpmRate > 0 &&
      Object.keys(manualAdjustments).length > 0
    ) {
      Object.entries(manualAdjustments).forEach(([creatorId, manualPoints]) => {
        if (!manualPoints) return;
        if (!verifiedCreatorIds.has(creatorId)) return;

        const manualEarnings = (manualPoints * cpmRate) / 1000;
        if (manualEarnings === 0) return;

        let creatorData = creatorEarnings.get(creatorId);
        if (!creatorData) {
          creatorData = { cpmTotal: 0, bonusTotal: 0 };
          creatorEarnings.set(creatorId, creatorData);
        }

        if (manualEarnings > 0 && maxEarningsPerCreator) {
          const maxInDollars = maxEarningsPerCreator / 100;
          const remainingCap = maxInDollars - creatorData.cpmTotal;

          if (remainingCap <= 0) return;
          creatorData.cpmTotal += Math.min(manualEarnings, remainingCap);
        } else if (manualEarnings > 0) {
          creatorData.cpmTotal += manualEarnings;
        } else {
          creatorData.cpmTotal = Math.max(
            0,
            creatorData.cpmTotal + manualEarnings
          );
        }
      });
    }

    // Sum up all creator earnings
    let cpmTotal = 0;
    let bonusTotal = 0;
    for (const [_, earnings] of creatorEarnings) {
      cpmTotal += earnings.cpmTotal;
      bonusTotal += earnings.bonusTotal;
    }

    let cpmPaid = Math.round(cpmTotal * 100); // Convert back to cents
    let bonusPaid = Math.round(bonusTotal * 100); // Convert back to cents

    if (contest.contest_type === "dual_rewards") {
      const milestoneContest = (contest.contest_based_details as any)
        ?.milestone_contest;
      const milestones = milestoneContest?.milestones || [];
      const normalizeMilestoneStatus = (raw: unknown) => {
        const st = String(raw || "").toLowerCase();
        return st === "approved" ? "verified" : st;
      };
      const subsForMilestone = submissions.map((s) => ({
        ...(s as object),
        status: normalizeMilestoneStatus((s as any).status),
      }));

      const useDetailMilestone =
        typeof milestoneExpectedPayoutCents === "number" &&
        !Number.isNaN(milestoneExpectedPayoutCents) &&
        milestoneExpectedPayoutCents >= 0;
      const aggregateMilestoneCents =
        milestones.length > 0
          ? Math.round(
              calculateMilestoneBudgetSpent(
                subsForMilestone as any,
                milestones,
              ) * 100,
            )
          : 0;
      const milestoneCents = useDetailMilestone
        ? Math.round(milestoneExpectedPayoutCents!)
        : aggregateMilestoneCents;

      let bonusPaidFromSubmissions = 0;
      for (const s of submissions) {
        const st = normalizeMilestoneStatus((s as any).status).toLowerCase();
        if (st !== "verified" && st !== "paid") continue;
        if (twitterExcluded(s)) continue;
        if ((s as any).bonus_paid && (s as any).bonus_amount != null) {
          bonusPaidFromSubmissions += Number((s as any).bonus_amount) || 0;
        }
      }

      const useDetailBonusExpected =
        typeof milestoneCreatorBonusExpectedCents === "number" &&
        !Number.isNaN(milestoneCreatorBonusExpectedCents) &&
        milestoneCreatorBonusExpectedCents >= 0;
      const bonusExpectedCents = useDetailBonusExpected
        ? Math.round(milestoneCreatorBonusExpectedCents)
        : 0;

      const useDetailBonusPaidMap =
        typeof milestoneCreatorBonusPaidCents === "number" &&
        !Number.isNaN(milestoneCreatorBonusPaidCents) &&
        milestoneCreatorBonusPaidCents >= 0;
      const bonusPaidFromMap = useDetailBonusPaidMap
        ? Math.round(milestoneCreatorBonusPaidCents)
        : null;

      const creatorBonusCents = useDetailBonusExpected
        ? bonusExpectedCents
        : bonusPaidFromMap !== null && bonusPaidFromMap > 0
          ? bonusPaidFromMap
          : bonusPaidFromSubmissions;

      cpmPaid = cpmPaid + milestoneCents;
      bonusPaid = creatorBonusCents;
    }

    const totalSpent = cpmPaid + bonusPaid;

    // For leaderboard contests, calculate prize pool spending (from actual paid submissions)
    let prizePoolSpent = 0;
    if (contest.contest_type === "leaderboard") {
      // Calculate how much of the prize pool has been paid out
      const paidSubmissions = relevantSubmissions.filter((s) => s.paid);
      const leaderboardPrizes = leaderboardConfig?.prizes || [];

      // Sort paid submissions by views (descending) to determine ranking
      const sortedPaidSubmissions = paidSubmissions.sort((a, b) => {
        const viewsA = (a as any).views || 0;
        const viewsB = (b as any).views || 0;
        return viewsB - viewsA;
      });

      // Calculate prize pool spending based on actual rankings
      for (let i = 0; i < sortedPaidSubmissions.length; i++) {
        const rank = i + 1;
        const prizeForRank = leaderboardPrizes.find(
          (p: any) => p.position === rank
        );
        if (prizeForRank) {
          prizePoolSpent += prizeForRank.amount;
        }
      }
    }

    let finalCpmPaid = cpmPaid;
    let finalBonusPaid = bonusPaid;
    let finalPrizePoolSpent = prizePoolSpent;
    let finalTotalSpent = totalSpent;

    if (getBudgetTileMode(postContestStatus) === "paid") {
      const tileInput = {
        contest_type: contest.contest_type,
        post_contest_status: postContestStatus,
        contest_based_details: contest.contest_based_details,
        max_earnings_per_creator: (contest as any).max_earnings_per_creator,
      };
      const subs = submissions as BudgetTileSubmission[];
      const paidTotal = computeBudgetPaidCents(tileInput, subs);
      finalTotalSpent =
        totalBudget > 0 ? Math.min(paidTotal, totalBudget) : paidTotal;

      if (contest.contest_type === "dual_rewards") {
        let cpmMilestonePaid = 0;
        let creatorBonusPaid = 0;
        for (const s of subs) {
          const st = String((s as any).status || "").toLowerCase();
          const isPaidSubmission =
            st === "paid" ||
            Boolean((s as any).paid_at) ||
            (s as any).paid === true;
          if (!isPaidSubmission) continue;
          if (twitterExcluded(s)) continue;

          const paid = getDualRewardsSubmissionPaidComponents({
            id: String((s as any).id || ""),
            earnings: (s as any).earnings,
            paid: (s as any).paid,
            bonus_amount: (s as any).bonus_amount,
            bonus_paid: (s as any).bonus_paid,
            dual_rewards_payout: (s as any).dual_rewards_payout,
          });
          cpmMilestonePaid += paid.cpmCents + paid.milestoneCents;
          if ((s as any).bonus_paid && (s as any).bonus_amount != null) {
            creatorBonusPaid += Number((s as any).bonus_amount) || 0;
          }
        }
        finalCpmPaid = cpmMilestonePaid;
        finalBonusPaid = creatorBonusPaid;
      } else if (contest.contest_type === "milestone") {
        let mainPaid = 0;
        let bonusPaidAmt = 0;
        for (const s of subs) {
          const st = String((s as any).status || "").toLowerCase();
          const isPaidSubmission =
            st === "paid" ||
            Boolean((s as any).paid_at) ||
            (s as any).paid === true;
          if (!isPaidSubmission) continue;
          if (twitterExcluded(s)) continue;
          if ((s as any).earnings != null) {
            mainPaid += Number((s as any).earnings) || 0;
          }
          if ((s as any).bonus_paid && (s as any).bonus_amount != null) {
            bonusPaidAmt += Number((s as any).bonus_amount) || 0;
          }
        }
        finalCpmPaid = mainPaid;
        finalBonusPaid = bonusPaidAmt;
      } else if (contest.contest_type === "leaderboard") {
        finalPrizePoolSpent = prizePoolSpent;
        finalBonusPaid = Math.max(0, finalTotalSpent - finalPrizePoolSpent);
        finalCpmPaid = finalPrizePoolSpent;
      } else {
        let mainPaid = 0;
        let bonusPaidAmt = 0;
        for (const s of subs) {
          const st = String((s as any).status || "").toLowerCase();
          const isPaidSubmission =
            st === "paid" ||
            Boolean((s as any).paid_at) ||
            (s as any).paid === true;
          if (!isPaidSubmission) continue;
          if (twitterExcluded(s)) continue;
          if ((s as any).earnings != null) {
            mainPaid += Number((s as any).earnings) || 0;
          }
          if ((s as any).bonus_paid && (s as any).bonus_amount != null) {
            bonusPaidAmt += Number((s as any).bonus_amount) || 0;
          }
        }
        finalCpmPaid = mainPaid;
        finalBonusPaid = bonusPaidAmt;
      }
    }

    const cpmPercentage =
      totalBudget > 0 ? Math.min((finalCpmPaid / totalBudget) * 100, 100) : 0;
    const bonusPercentage =
      bonusBudget && bonusBudget > 0
        ? Math.min((finalBonusPaid / bonusBudget) * 100, 100)
        : 0;
    const bonusPercentageOfTotal =
      totalBudget > 0 ? Math.min((finalBonusPaid / totalBudget) * 100, 100) : 0;
    const totalPercentage =
      totalBudget > 0
        ? Math.min((finalTotalSpent / totalBudget) * 100, 100)
        : 0;

    return {
      cpmPaid: finalCpmPaid,
      bonusPaid: finalBonusPaid,
      totalBudget,
      cpmPercentage,
      bonusPercentage,
      bonusPercentageOfTotal,
      totalPercentage,
      prizePoolSpent: finalPrizePoolSpent,
      prizePoolTotal,
      bonusBudget,
      bonusSpent: finalBonusPaid,
      totalSpent: finalTotalSpent,
    };
  }, [
    contest,
    submissions,
    creatorManualPointsAdjustments,
    milestoneExpectedPayoutCents,
    milestoneCreatorBonusExpectedCents,
    milestoneCreatorBonusPaidCents,
    milestoneExpectedPayoutBySubmissionId,
    postContestStatus,
  ]);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const remaining = Math.max(0, totalBudget - totalSpent);
  const isNearLimit = totalPercentage >= 80;

  // Only show for CPM, leaderboard, milestone, and dual rewards contests
  if (
    contest.contest_type !== "cpm" &&
    contest.contest_type !== "leaderboard" &&
    contest.contest_type !== "milestone" &&
    contest.contest_type !== "dual_rewards"
  ) {
    return null;
  }
  // Read mode from data attribute
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

    checkMode();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  const isDark = mode === "dark";

  if (!showDetailed) {
    // Simple view - just total budget used
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Budget Used
          </span>
          <span className="font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
          </span>
        </div>

        <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`absolute h-full transition-all duration-300 ${
              isNearLimit ? "bg-yellow-500" : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(totalPercentage, 100)}%` }}
          />
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-400 text-right">
          {formatCurrency(remaining)} remaining (
          {(100 - Math.min(totalPercentage, 100)).toFixed(1)}%)
        </p>
      </div>
    );
  }

  // Special handling for leaderboard contests with total budget for bonuses
  if (
    contest.contest_type === "leaderboard" &&
    hasFlatFeeBonus &&
    bonusBudget
  ) {
    const bonusPercentage =
      bonusBudget > 0 ? Math.min((bonusSpent / bonusBudget) * 100, 100) : 0;
    const isNearLimit = bonusPercentage >= 80;
    const remaining = Math.max(0, bonusBudget - bonusSpent);

    return (
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span
            className={cn(
              "font-medium",
              isDark ? "text-gray-300" : "text-gray-700"
            )}
          >
            Budget Tracker
          </span>
          <span className="font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(bonusSpent)} / {formatCurrency(bonusBudget)}
          </span>
        </div>

        {/* Progress bar for Total Budget only */}
        <div
          className={cn(
            "relative w-full h-4 rounded-full overflow-hidden",
            isDark ? "bg-[#FFFFFF42]" : "bg-gray-200"
          )}
        >
          <div
            className={`absolute h-full transition-all duration-300 ${
              isNearLimit ? "bg-yellow-500" : "bg-green-500"
            }`}
            style={{ width: `${Math.min(bonusPercentage, 100)}%` }}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-green-600 rounded-sm" />
          <div className="flex-1">
            <p
              className={cn(
                "font-medium text-xs",
                isDark ? "text-gray-300" : "text-gray-700"
              )}
            >
              Flat Fee Bonus
            </p>
            <p
              className={cn(
                "font-semibold text-xs",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {formatCurrency(bonusSpent)}
            </p>
          </div>
        </div>

        {/* Status message */}
        {isNearLimit ? (
          <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex-shrink-0 w-1 h-8 bg-yellow-500 rounded-full" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                Near Limit
              </p>
              <p className="text-yellow-700 dark:text-yellow-300">
                {formatCurrency(remaining)} remaining
              </p>
            </div>
          </div>
        ) : (
          <p
            className={cn(
              "text-xs text-right",
              isDark ? "text-gray-300" : "text-gray-600"
            )}
          >
            {formatCurrency(remaining)} remaining (
            {(100 - bonusPercentage).toFixed(1)}% available)
          </p>
        )}
      </div>
    );
  }

  // Detailed view with CPM/Leaderboard and Bonus breakdown (for CPM contests or leaderboard without total_budget)
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span
          className={cn(
            "font-medium",
            isDark ? "text-gray-300" : "text-gray-700"
          )}
        >
          Budget Tracker
        </span>
        <div className="text-right">
          <span
            className={cn("font-bold", isDark ? "text-white" : "text-gray-900")}
          >
            {formatCurrency(totalSpent)}
          </span>
          <span className={cn(isDark ? "text-white" : "text-gray-600")}>
            {" "}
            / {formatCurrency(totalBudget)}
          </span>
        </div>
      </div>

      {/* Two-color progress bar */}
      <div
        className={cn(
          "relative w-full h-4 rounded-full overflow-hidden",
          isDark ? "bg-[#FFFFFF42]" : "bg-gray-200"
        )}
        title={
          hasFlatFeeBonus && bonusPaid > 0
            ? contest.contest_type === "milestone"
              ? `Milestone payouts (${
                  getBudgetTileMode(postContestStatus) === "paid"
                    ? "paid"
                    : "expected"
                }): ${formatCurrency(
                  cpmPaid,
                )} | Creator bonus: ${formatCurrency(
                  bonusPaid,
                )} | Total: ${formatCurrency(totalSpent)}`
              : contest.contest_type === "dual_rewards"
                ? `CPM + Milestone (${
                    getBudgetTileMode(postContestStatus) === "paid"
                      ? "paid"
                      : "expected"
                  }): ${formatCurrency(
                    cpmPaid,
                  )} | Creator bonus: ${formatCurrency(
                    bonusPaid,
                  )} | Total: ${formatCurrency(totalSpent)}`
                : `${
                    contest.contest_type === "cpm" ? "CPM" : "Contest"
                  } Earnings: ${formatCurrency(
                    cpmPaid,
                  )} | Flat Fee Bonus: ${formatCurrency(bonusPaid)}${
                    contest.contest_type === "cpm" &&
                    bonusBudget &&
                    bonusBudget > 0
                      ? ` / ${formatCurrency(bonusBudget)} cap`
                      : ""
                  } | Total: ${formatCurrency(totalSpent)}`
            : contest.contest_type === "milestone"
              ? `Milestone payouts (${
                  getBudgetTileMode(postContestStatus) === "paid"
                    ? "paid"
                    : "expected"
                }): ${formatCurrency(cpmPaid)}`
              : contest.contest_type === "dual_rewards"
                ? `CPM + Milestone (${
                    getBudgetTileMode(postContestStatus) === "paid"
                      ? "paid"
                      : "expected"
                  }): ${formatCurrency(cpmPaid)}`
                : `Total ${
                    contest.contest_type === "cpm"
                      ? "CPM earnings (based on platform)"
                      : "contest earnings"
                  }: ${formatCurrency(cpmPaid)}`
        }
      >
        {/* CPM/Leaderboard earnings portion */}
        <div
          className="absolute h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
          style={{ width: `${Math.min(cpmPercentage, 100)}%` }}
        />
        {/* Flat fee bonus (CPM) or creator bonus (milestone / dual) */}
        {hasFlatFeeBonus && bonusPaid > 0 && (
          <div
            className="absolute h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
            style={{
              left: `${Math.min(cpmPercentage, 100)}%`,
              width: `${Math.min(
                bonusPercentageOfTotal,
                Math.max(0, 100 - cpmPercentage)
              )}%`,
            }}
          />
        )}
      </div>

      {/* Legend */}
      <div
        className={`grid gap-2 text-xs ${
          hasFlatFeeBonus ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-sm" />
          <div className="flex-1">
            <p
              className={cn(
                "font-medium",
                isDark ? "text-gray-300" : "text-gray-700"
              )}
            >
              {contest.contest_type === "dual_rewards"
                ? "CPM + Milestone earnings"
                : contest.contest_type === "cpm"
                  ? "CPM Earnings"
                  : contest.contest_type === "milestone"
                    ? "Milestone payouts"
                    : "Contest Earnings"}
            </p>
            <p
              className={cn(
                "font-semibold",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {formatCurrency(cpmPaid)}
            </p>
          </div>
        </div>
        {hasFlatFeeBonus && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-green-600 rounded-sm" />
            <div className="flex-1">
              <p
                className={cn(
                  "font-medium",
                  isDark ? "text-gray-300" : "text-gray-700"
                )}
              >
                {contest.contest_type === "milestone" ||
                contest.contest_type === "dual_rewards"
                  ? "Creator bonus"
                  : "Flat Fee Bonus"}
              </p>
              <p
                className={cn(
                  "font-semibold",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                {formatCurrency(bonusPaid)}
                {isCpmContestType(contest.contest_type) &&
                  contest.contest_type !== "dual_rewards" &&
                  bonusBudget &&
                  bonusBudget > 0 && (
                    <span
                      className={cn(
                        isDark ? "text-gray-400" : "text-gray-600",
                        "font-normal ml-1"
                      )}
                    >
                      / {formatCurrency(bonusBudget)}
                    </span>
                  )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status message */}
      {isNearLimit ? (
        <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex-shrink-0 w-1 h-8 bg-yellow-500 rounded-full" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-yellow-900 dark:text-yellow-100">
              Near Limit
            </p>
            <p className="text-yellow-700 dark:text-yellow-300">
              {formatCurrency(remaining)} remaining
            </p>
          </div>
        </div>
      ) : (
        <p
          className={cn(
            "text-xs text-right",
            isDark ? "text-gray-300" : "text-gray-600"
          )}
        >
          {formatCurrency(remaining)} remaining (
          {(100 - Math.min(totalPercentage, 100)).toFixed(1)}% available)
        </p>
      )}
    </div>
  );
}
