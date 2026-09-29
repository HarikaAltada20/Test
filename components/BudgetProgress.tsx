"use client";

import {
  computeBudgetPaidCents,
  computeDualRewardsCpmMilestoneFilledByPlatform,
  getBudgetTileMode,
  type BudgetTileSubmission,
} from "@/lib/contest-budget-tile-metrics";
import { getDualRewardsSubmissionPaidComponents } from "@/lib/dual-rewards-pool-budget";
import {
  getPoolBudgetCentsFromDetails,
  isCpmContestType,
  isMilestoneContestType,
} from "@/lib/contest-type";
import { computeCpmRawCentsForRow } from "@/lib/cpm-expected-cents";
import { getCpmEligibleViewsFromRow } from "@/lib/cpm-eligible-views";
import {
  isKeyedMaxEarningsMap,
  parseVideoContestPlatforms,
  resolveCpmContestConfigForPlatform,
  resolveContestPoolBudgetCents,
  resolveFlatFeeBonusPlan,
  resolveMaxEarningsCentsForSubmission,
  VIDEO_PLATFORM_LABELS,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";
import {
  buildFlatFeeBonusExpectedCentsBySubmissionId,
  getFlatFeeBonusCentsFromContest,
  getNormalizedSubmissionStatusForFlatFeeBonus,
  toFlatFeeBonusSubmissionInput,
} from "@/lib/twitter-cpm-bonus-expected";
import {
  buildMilestoneSubmissionPayoutCentsMapFromDetails,
  collectMilestoneBonusConfigs,
  computeMilestoneCreatorBonusExpectedCentsFromDetails,
} from "@/lib/milestone-contest-expected-spend";
import { getPlatformIcon } from "@/lib/platform-icons";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState, type ReactNode } from "react";

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
  max_earnings_per_creator?: number | Record<string, unknown> | null;
  platform?: string | null;
  bonus_details?: unknown;
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

  const contestBonusInput = {
    contest_type: contest.contest_type,
    platform: contest.platform,
    contest_based_details:
      contest.contest_based_details &&
      typeof contest.contest_based_details === "object"
        ? (contest.contest_based_details as Record<string, unknown>)
        : null,
  };
  const isCreatorBonusContest =
    contest.contest_type === "dual_rewards" ||
    contest.contest_type === "milestone";
  const bonusLegendLabel = isCreatorBonusContest
    ? "Creators bonus"
    : "Flat Fee Bonus";
  const earningsLegendLabel =
    contest.contest_type === "dual_rewards"
      ? "CPM + Milestone earnings"
      : contest.contest_type === "cpm"
        ? "CPM Earnings"
        : contest.contest_type === "milestone"
          ? "Milestone payouts"
          : "Contest Earnings";

  const contestFlatFeeBonusCents =
    getFlatFeeBonusCentsFromContest(contestBonusInput);
  const flatFeeBonus =
    contestFlatFeeBonusCents ||
    cpmConfig?.flat_fee_bonus ||
    leaderboardConfig?.flat_fee_bonus ||
    0;
  const milestoneCreatorBonusConfigured = collectMilestoneBonusConfigs(
    contest.contest_based_details,
    contest.platform,
  ).some(
    (bonus) =>
      Boolean(bonus?.enabled) &&
      Boolean(bonus.most_verified_views || bonus.most_verified_reels),
  );
  const hasFlatFeeBonus =
    (contest.contest_type !== "dual_rewards" &&
      (contestFlatFeeBonusCents > 0 || flatFeeBonus > 0)) ||
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
    platformBonusRows,
    platformCpmRows,
  } = useMemo(() => {
    // Use contest row total_budget when set; else pool from contest_based_details (dual: root total_budget_cents via helper)
    let totalBudget =
      contest.total_budget && contest.total_budget > 0
        ? contest.total_budget
        : 0;
    if (totalBudget <= 0 && contest.contest_type !== "leaderboard") {
      totalBudget = resolveContestPoolBudgetCents(
        contest.contest_type,
        contest.contest_based_details,
        contest.platform,
      );
      if (totalBudget <= 0) {
        totalBudget = getPoolBudgetCentsFromDetails(
          contest.contest_type,
          contest.contest_based_details,
        );
      }
    }

    const prizePoolTotal =
      contest.contest_type === "leaderboard"
        ? leaderboardConfig?.total_prize || 0
        : 0;

    // For CPM contests, use flat_fee_bonus_cap if configured, otherwise total_budget
    // For leaderboard contests, use total_budget
    // Dual / milestone use creator bonus, not a flat-fee bonus pool.
    let bonusBudget =
      contest.contest_type === "dual_rewards" ||
      contest.contest_type === "milestone"
        ? 0
        : isCpmContestType(contest.contest_type) && cpmConfig?.flat_fee_bonus_cap
          ? cpmConfig.flat_fee_bonus_cap
          : contest.total_budget || 0;

    const maxEarningsKeyed = isKeyedMaxEarningsMap(
      (contest as any).max_earnings_per_creator,
    );
    const maxEarningsPerCreator = maxEarningsKeyed
      ? null
      : resolveMaxEarningsCentsForSubmission(
          contest as any,
          contest.platform,
        ) ||
        (typeof (contest as any).max_earnings_per_creator === "number"
          ? (contest as any).max_earnings_per_creator
          : null);
    const creatorPlatformCpmSpent = new Map<string, number>();
    const platformCpmCents = new Map<VideoContestPlatform, number>();
    const addPlatformCpmCents = (platformRaw: unknown, cents: number) => {
      const key = parseVideoContestPlatforms(String(platformRaw || ""))[0];
      if (!key) return;
      const amount = Math.round(cents);
      if (!Number.isFinite(amount) || amount === 0) return;
      platformCpmCents.set(key, (platformCpmCents.get(key) || 0) + amount);
    };
    const cpmRate = cpmConfig?.cpm_rate_usd || 0;
    const minViews = cpmConfig?.min_views;
    const maxViews = cpmConfig?.max_views;
    const detailsRecord =
      contest.contest_based_details &&
      typeof contest.contest_based_details === "object"
        ? (contest.contest_based_details as Record<string, unknown>)
        : null;
    const videoPlatforms = parseVideoContestPlatforms(contest.platform);
    const buildPlatformCpmRows = () =>
      videoPlatforms.length >= 2
        ? videoPlatforms.map((platform) => ({
            platform,
            spentCents: Math.max(0, platformCpmCents.get(platform) || 0),
          }))
        : [];
    const toBonusSubmission = (s: Submission) => ({
      id: String((s as any).id || ""),
      creator_id: (s as any).creator_id,
      created_at: (s as any).created_at,
      status: (s as any).status,
      paid: s.paid,
      paid_at: s.paid_at,
      earnings: s.earnings,
      deleted_at: (s as any).deleted_at,
      views: (s as any).views,
      platform: (s as any).platform,
      other_stats: (s as any).other_stats,
      bonus_paid: s.bonus_paid,
      bonus_amount: s.bonus_amount,
      metadata: (s as any).metadata,
      milestone_bonus_paid: (s as any).milestone_bonus_paid,
    });
    const buildCreatorBonusPlatformRows = (paidMode: boolean) => {
      if (videoPlatforms.length < 2 || !hasFlatFeeBonus) return [];
      return videoPlatforms.map((platform) => {
        const platformSubs = submissions.filter(
          (s) => parseVideoContestPlatforms((s as any).platform)[0] === platform,
        );
        let spentCents = 0;
        if (paidMode) {
          for (const s of platformSubs) {
            if (s.bonus_paid && s.bonus_amount != null) {
              spentCents += Math.max(0, Number(s.bonus_amount) || 0);
            }
          }
        } else {
          spentCents = computeMilestoneCreatorBonusExpectedCentsFromDetails(
            platformSubs.map(toBonusSubmission),
            detailsRecord,
            platform,
          );
        }
        return {
          platform,
          amountCents: 0,
          budgetCents: 0,
          spentCents,
          showSpend: true,
        };
      });
    };

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
      const normalizeMilestoneStatus = (raw: unknown) => {
        const st = String(raw || "").toLowerCase();
        return st === "approved" ? "verified" : st;
      };

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
            const paidCents = Math.max(0, Number((s as any).earnings) || 0);
            mainPaid += paidCents;
            addPlatformCpmCents((s as any).platform, paidCents);
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
        // Show granted/paid truth even when it exceeds the reserved pool.
        const totalSpent = totalSpentRaw;
        const cpmPercentage =
          totalBudget > 0 ? Math.min((mainPaid / totalBudget) * 100, 100) : 0;
        const bonusPercentageOfTotal =
          totalBudget > 0
            ? Math.min((bonusPaidCents / totalBudget) * 100, 100)
            : 0;
        const totalPercentage =
          totalBudget > 0
            ? Math.min((totalSpentRaw / totalBudget) * 100, 100)
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
          platformBonusRows: buildCreatorBonusPlatformRows(true),
          platformCpmRows: buildPlatformCpmRows(),
        };
      }

      const expectedBySubmissionMap =
        milestoneExpectedPayoutBySubmissionId instanceof Map
          ? milestoneExpectedPayoutBySubmissionId
          : buildMilestoneSubmissionPayoutCentsMapFromDetails(
              submissions.map((s) => ({
                id: String((s as any).id || ""),
                creator_id: (s as any).creator_id,
                created_at: (s as any).created_at,
                status: normalizeMilestoneStatus((s as any).status),
                paid: s.paid,
                paid_at: s.paid_at,
                earnings: s.earnings,
                deleted_at: (s as any).deleted_at,
                views: (s as any).views,
                platform: (s as any).platform,
                other_stats: (s as any).other_stats,
              })),
              detailsRecord,
              contest.platform,
            );

      // Paid-first model (pre payouts_processed):
      // - If a submission is paid and has stored earnings, use paid amount.
      // - Otherwise use expected per-submission payout (multiple entries
      //   from the same creator each count independently).
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
          expectedBySubmissionMap.get(String((s as any).id || "")) ?? 0;

        if (isPaidSubmission && paidEarningsCents > 0) {
          blendedMilestonePayoutCents += paidEarningsCents;
          addPlatformCpmCents((s as any).platform, paidEarningsCents);
        } else {
          blendedMilestonePayoutCents += expectedCents;
          addPlatformCpmCents((s as any).platform, expectedCents);
        }
      }

      const cpmPaid = blendedMilestonePayoutCents;

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
        platformBonusRows: buildCreatorBonusPlatformRows(false),
        platformCpmRows: buildPlatformCpmRows(),
      };
    }

    const relevantSubmissions = submissions.filter((s) => {
      const status = getNormalizedSubmissionStatusForFlatFeeBonus(
        toFlatFeeBonusSubmissionInput(s as any),
      );
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
      const platformCfg = resolveCpmContestConfigForPlatform(
        detailsRecord,
        (sub as any).platform,
        contest.platform,
      );
      const subRate = platformCfg?.cpm_rate_usd || cpmRate;
      const subMin = platformCfg?.min_views ?? minViews;
      const subMax = platformCfg?.max_views ?? maxViews;

      if (submissionPlatform === "twitter") {
        const basePoints = (sub as any).other_stats?.base_points || 0;
        const manualPointsAdjustment =
          (sub as any).manual_points_adjustment || 0;
        const totalPoints = basePoints + manualPointsAdjustment;
        submissionEarnings = (totalPoints * subRate) / 1000;
        console.log(
          `[Twitter CPM] basePoints=${basePoints}, manual=${manualPointsAdjustment}, totalPoints=${totalPoints}, cpmRate=${subRate}, earnings=${submissionEarnings.toFixed(
            2,
          )}`,
        );
      } else if (!isDualRewards && sub.paid && sub.earnings != null) {
        // Use actual paid earnings from database for non-Twitter platforms (YouTube, Instagram)
        submissionEarnings = sub.earnings / 100; // Convert cents to dollars
        console.log(
          `[${
            submissionPlatform || "Unknown"
          } Paid] earnings=${submissionEarnings.toFixed(2)}`,
        );
      } else if (isDualRewards) {
        submissionEarnings =
          computeCpmRawCentsForRow(
            sub as any,
            detailsRecord,
            contest.platform,
          ) / 100;
      } else {
        // Calculate expected earnings from CPM formula.
        let views = getCpmEligibleViewsFromRow(sub as any);
        if (subMin != null && views < subMin) views = 0;
        if (subMax != null && views > subMax) views = subMax;
        submissionEarnings = (views * subRate) / 1000;
        console.log(
          `[${
            submissionPlatform || "Unknown"
          } Unpaid] views=${views}, cpmRate=${subRate}, earnings=${submissionEarnings.toFixed(
            2,
          )}`,
        );
      }

      // Apply creator cap if configured (keyed maps are per-platform).
      const subCapCents = maxEarningsKeyed
        ? resolveMaxEarningsCentsForSubmission(
            contest as any,
            (sub as any).platform,
          )
        : maxEarningsPerCreator;
      if (subCapCents && subCapCents > 0) {
        const maxInDollars = subCapCents / 100;
        const capKey = maxEarningsKeyed
          ? `${creatorId}:${String((sub as any).platform || "").toLowerCase() || "_"}`
          : creatorId;
        const used = creatorPlatformCpmSpent.get(capKey) || 0;
        const remainingCap = maxInDollars - used;
        if (remainingCap > 0) {
          const applied = Math.min(submissionEarnings, remainingCap);
          creatorData.cpmTotal += applied;
          creatorPlatformCpmSpent.set(capKey, used + applied);
          addPlatformCpmCents((sub as any).platform, applied * 100);
        }
      } else {
        creatorData.cpmTotal += submissionEarnings;
        addPlatformCpmCents((sub as any).platform, submissionEarnings * 100);
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
            creatorData.cpmTotal + manualEarnings,
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

    const bonusPlan = resolveFlatFeeBonusPlan(
      contest.contest_based_details,
      contest.platform,
      contest.contest_type,
    );
    const expectedBonusMap = buildFlatFeeBonusExpectedCentsBySubmissionId(
      {
        contest_type: contest.contest_type,
        platform: contest.platform,
        contest_based_details:
          contest.contest_based_details &&
          typeof contest.contest_based_details === "object"
            ? (contest.contest_based_details as Record<string, unknown>)
            : null,
      },
      submissions.map((s) => toFlatFeeBonusSubmissionInput(s as any)),
    );
    if (
      contest.contest_type !== "dual_rewards" &&
      contest.contest_type !== "milestone" &&
      (contestFlatFeeBonusCents > 0 || flatFeeBonus > 0)
    ) {
      let expectedSum = 0;
      for (const cents of expectedBonusMap.values()) expectedSum += cents;
      bonusPaid = expectedSum;
    }

    if (contest.contest_type === "dual_rewards") {
      const normalizeMilestoneStatus = (raw: unknown) => {
        const st = String(raw || "").toLowerCase();
        return st === "approved" ? "verified" : st;
      };

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

      const dualContestInput = {
        contest_type: contest.contest_type,
        post_contest_status: postContestStatus,
        contest_based_details: contest.contest_based_details,
        max_earnings_per_creator: (contest as any).max_earnings_per_creator,
        platform: contest.platform,
        bonus_details: (contest as any).bonus_details,
      };
      const dualByPlatform = computeDualRewardsCpmMilestoneFilledByPlatform(
        dualContestInput,
        submissions as BudgetTileSubmission[],
      );
      platformCpmCents.clear();
      let dualTotal = 0;
      for (const [platform, cents] of dualByPlatform) {
        addPlatformCpmCents(platform, cents);
        dualTotal += cents;
      }
      cpmPaid = dualTotal;
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
          (p: any) => p.position === rank,
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
      // Do not clamp to pool — tracker must show actual paid/granted total.
      finalTotalSpent = paidTotal;

      if (contest.contest_type === "dual_rewards") {
        platformCpmCents.clear();
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
          addPlatformCpmCents(
            (s as any).platform,
            paid.cpmCents + paid.milestoneCents,
          );
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
        platformCpmCents.clear();
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
            const paidCents = Number((s as any).earnings) || 0;
            mainPaid += paidCents;
            addPlatformCpmCents((s as any).platform, paidCents);
          }
          if ((s as any).bonus_paid && (s as any).bonus_amount != null) {
            bonusPaidAmt += Number((s as any).bonus_amount) || 0;
          }
        }
        finalCpmPaid = mainPaid;
        finalBonusPaid = bonusPaidAmt;
      }
    }

    const paidMode = getBudgetTileMode(postContestStatus) === "paid";
    const useFlatFeeBonusPlan =
      contest.contest_type !== "dual_rewards" &&
      contest.contest_type !== "milestone";
    const platformsWithBonus = useFlatFeeBonusPlan
      ? bonusPlan.platforms.filter((platform) => {
          const ladder = bonusPlan.byPlatform[platform];
          return (
            (ladder?.amountCents || 0) > 0 || (ladder?.budgetCents || 0) > 0
          );
        })
      : [];
    const showPerPlatformBonus =
      useFlatFeeBonusPlan &&
      !bonusPlan.shareAcrossAllPlatforms &&
      platformsWithBonus.length >= 2;
    const platformBonusRows: Array<{
      platform: VideoContestPlatform;
      amountCents: number;
      budgetCents: number;
      spentCents: number;
      showSpend: boolean;
    }> = !useFlatFeeBonusPlan
      ? buildCreatorBonusPlatformRows(paidMode)
      : platformsWithBonus.length >= 1
        ? platformsWithBonus.map((platform) => {
            const ladder = bonusPlan.byPlatform[platform];
            let spentCents = 0;
            for (const s of submissions) {
              const key = parseVideoContestPlatforms((s as any).platform)[0];
              if (key !== platform) continue;
              if (paidMode) {
                if (s.bonus_paid && s.bonus_amount != null) {
                  spentCents += Math.max(0, Number(s.bonus_amount) || 0);
                }
              } else {
                spentCents +=
                  expectedBonusMap.get(String((s as any).id || "")) || 0;
              }
            }
            return {
              platform,
              amountCents: ladder?.amountCents || 0,
              budgetCents: ladder?.budgetCents || 0,
              spentCents,
              showSpend: true,
            };
          })
        : [];

    if (useFlatFeeBonusPlan && showPerPlatformBonus) {
      const planBudget = platformBonusRows.reduce(
        (sum, row) => sum + row.budgetCents,
        0,
      );
      if (planBudget > 0) bonusBudget = planBudget;
      const planSpent = platformBonusRows.reduce(
        (sum, row) => sum + row.spentCents,
        0,
      );
      finalBonusPaid = planSpent;
      if (contest.contest_type === "leaderboard" && !paidMode) {
        finalTotalSpent = finalCpmPaid + finalBonusPaid;
      }
    } else if (
      useFlatFeeBonusPlan &&
      bonusPlan.shared.budgetCents != null &&
      bonusPlan.shared.budgetCents > 0 &&
      (contest.contest_type === "leaderboard" ||
        contest.contest_type === "cpm")
    ) {
      bonusBudget = bonusPlan.shared.budgetCents;
    }

    const platformCpmRows: Array<{
      platform: VideoContestPlatform;
      spentCents: number;
    }> = buildPlatformCpmRows();

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
      platformBonusRows,
      platformCpmRows,
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
    contestFlatFeeBonusCents,
    hasFlatFeeBonus,
  ]);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const platformBonusSpentTotal = platformBonusRows.reduce(
    (sum, row) => sum + row.spentCents,
    0,
  );
  const platformBonusBudgetTotal = platformBonusRows.reduce(
    (sum, row) => sum + row.budgetCents,
    0,
  );

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

  const renderFlatFeeBonusTotalColumn = () => {
    const spent =
      platformBonusRows.length > 0 ? platformBonusSpentTotal : bonusPaid;
    const budget =
      platformBonusBudgetTotal > 0
        ? platformBonusBudgetTotal
        : bonusBudget || 0;
    return (
      <div className="flex items-start gap-1.5 min-w-0">
        <div className="w-3 h-3 mt-0.5 shrink-0 bg-gradient-to-r from-green-500 to-green-600 rounded-sm" />
        <div className="min-w-0">
          <p
            className={cn(
              "font-medium",
              isDark ? "text-gray-300" : "text-gray-700",
            )}
          >
            {bonusLegendLabel}
          </p>
          <p
            className={cn(
              "font-semibold tabular-nums",
              isDark ? "text-white" : "text-gray-900",
            )}
          >
            {formatCurrency(spent)}
            {!isCreatorBonusContest && budget > 0 ? (
              <span
                className={cn(
                  "font-normal",
                  isDark ? "text-gray-400" : "text-gray-600",
                )}
              >
                {" "}
                / {formatCurrency(budget)}
              </span>
            ) : null}
          </p>
        </div>
      </div>
    );
  };

  const renderPlatformAmountRow = (row: {
    platform: VideoContestPlatform;
    spentCents: number;
    budgetCents?: number;
  }) => {
    return (
      <div
        key={row.platform}
        className="flex items-center gap-1 min-w-0"
      >
        <span
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden [&_div]:!h-4 [&_div]:!w-4 [&_svg]:!h-4 [&_svg]:!w-4"
          title={VIDEO_PLATFORM_LABELS[row.platform]}
        >
          {getPlatformIcon(row.platform, "sm")}
        </span>
        <span
          className={cn(
            "text-xs font-medium tabular-nums whitespace-nowrap",
            isDark ? "text-white" : "text-gray-900",
          )}
        >
          {formatCurrency(row.spentCents)}
          {(row.budgetCents || 0) > 0 ? (
            <span
              className={cn(
                "font-normal",
                isDark ? "text-gray-400" : "text-gray-600",
              )}
            >
              {" "}
              / {formatCurrency(row.budgetCents || 0)}
            </span>
          ) : null}
        </span>
      </div>
    );
  };

  const renderLegendRow = (
    leading: ReactNode,
    rows: Array<{
      platform: VideoContestPlatform;
      spentCents: number;
      budgetCents?: number;
    }>,
  ) => {
    return (
      <div
        className="grid gap-3 items-center text-sm"
        style={{
          gridTemplateColumns: `minmax(7.5rem, 1.15fr) repeat(${Math.max(
            rows.length,
            1,
          )}, minmax(0, 1fr))`,
        }}
      >
        {leading}
        {rows.map((row) => renderPlatformAmountRow(row))}
      </div>
    );
  };

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
    const remaining = Math.max(0, bonusBudget - bonusSpent);

    return (
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span
            className={cn(
              "font-medium",
              isDark ? "text-gray-300" : "text-gray-700",
            )}
          >
            Budget Tracker
          </span>
          <span className="font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(bonusSpent)} / {formatCurrency(bonusBudget)}
          </span>
        </div>

        <div
          className={cn(
            "relative w-full h-4 rounded-full overflow-hidden",
            isDark ? "bg-[#FFFFFF42]" : "bg-gray-200",
          )}
        >
          <div
            className={`absolute h-full transition-all duration-300 ${
              bonusPercentage >= 80 ? "bg-yellow-500" : "bg-green-500"
            }`}
            style={{ width: `${Math.min(bonusPercentage, 100)}%` }}
          />
        </div>

        {renderLegendRow(
          renderFlatFeeBonusTotalColumn(),
          platformBonusRows,
        )}

        {bonusPercentage >= 80 ? (
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
              isDark ? "text-gray-300" : "text-gray-600",
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
            isDark ? "text-gray-300" : "text-gray-700",
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
          isDark ? "bg-[#FFFFFF42]" : "bg-gray-200",
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
                )} | Creators bonus: ${formatCurrency(
                  bonusPaid,
                )} | Total: ${formatCurrency(totalSpent)}`
              : contest.contest_type === "dual_rewards"
                ? `CPM + Milestone (${
                    getBudgetTileMode(postContestStatus) === "paid"
                      ? "paid"
                      : "expected"
                  }): ${formatCurrency(
                    cpmPaid,
                  )} | Creators bonus: ${formatCurrency(
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
                Math.max(0, 100 - cpmPercentage),
              )}%`,
            }}
          />
        )}
      </div>

      {/* Legend */}
      {platformCpmRows.length > 0 || platformBonusRows.length > 0 ? (
        <div className="space-y-3 text-sm">
          {renderLegendRow(
            <div className="flex items-start gap-1.5 min-w-0">
              <div className="w-3 h-3 mt-0.5 shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-sm" />
              <div className="min-w-0">
                <p
                  className={cn(
                    "font-medium",
                    isDark ? "text-gray-300" : "text-gray-700",
                  )}
                >
                  {earningsLegendLabel}
                </p>
                <p
                  className={cn(
                    "font-semibold tabular-nums",
                    isDark ? "text-white" : "text-gray-900",
                  )}
                >
                  {formatCurrency(cpmPaid)}
                </p>
              </div>
            </div>,
            platformCpmRows,
          )}
          {(hasFlatFeeBonus || platformBonusRows.length > 0) &&
            renderLegendRow(
              renderFlatFeeBonusTotalColumn(),
              platformBonusRows,
            )}
        </div>
      ) : (
        <div
          className={`grid gap-2 text-sm ${
            hasFlatFeeBonus ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-sm" />
            <div className="flex-1">
              <p
                className={cn(
                  "font-medium",
                  isDark ? "text-gray-300" : "text-gray-700",
                )}
              >
                {earningsLegendLabel}
              </p>
              <p
                className={cn(
                  "font-semibold",
                  isDark ? "text-white" : "text-gray-900",
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
                    isDark ? "text-gray-300" : "text-gray-700",
                  )}
                >
                  {bonusLegendLabel}
                </p>
                <p
                  className={cn(
                    "font-semibold",
                    isDark ? "text-white" : "text-gray-900",
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
                          "font-normal ml-1",
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
      )}

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
            isDark ? "text-gray-300" : "text-gray-600",
          )}
        >
          {formatCurrency(remaining)} remaining (
          {(100 - Math.min(totalPercentage, 100)).toFixed(1)}% available)
        </p>
      )}
    </div>
  );
}
