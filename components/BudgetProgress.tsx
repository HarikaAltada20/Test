"use client";

import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

interface Submission {
  paid: boolean;
  earnings: number | null;
  bonus_paid: boolean;
  bonus_amount?: number;
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
}

export function BudgetProgress({
  contest,
  submissions,
  showDetailed = true,
  creatorManualPointsAdjustments,
}: BudgetProgressProps) {
  const [mode, setMode] = useState<"light" | "dark">("light");
  // Get contest config outside useMemo so it's available in the component
  const cpmConfig =
    contest.contest_type === "cpm"
      ? (contest.contest_based_details as any)?.cpm_contest
      : null;
  const leaderboardConfig =
    contest.contest_type === "leaderboard"
      ? (contest.contest_based_details as any)?.leaderboard_contest
      : null;

  const flatFeeBonus =
    cpmConfig?.flat_fee_bonus || leaderboardConfig?.flat_fee_bonus || 0;
  const hasFlatFeeBonus = flatFeeBonus > 0;

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
    // Use total_budget from the contest object (works for both CPM and Leaderboard)
    const totalBudget = contest.total_budget || 0;

    const prizePoolTotal =
      contest.contest_type === "leaderboard"
        ? leaderboardConfig?.total_prize || 0
        : 0;

    // For CPM contests, use flat_fee_bonus_cap if configured, otherwise total_budget
    // For leaderboard contests, use total_budget
    const bonusBudget =
      contest.contest_type === "cpm" && cpmConfig?.flat_fee_bonus_cap
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

    // Filter to verified or paid submissions, but exclude filtered_out ones
    const relevantSubmissions = submissions.filter((s) => {
      const status = (s as any).status?.toLowerCase();
      const filterStatus = (s as any).filter_status?.toLowerCase();
      return (status === "verified" || status === "paid") && filterStatus !== "filtered_out";
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
      } else if (sub.paid && sub.earnings != null) {
        // Use actual paid earnings from database for non-Twitter platforms (YouTube, Instagram)
        submissionEarnings = sub.earnings / 100; // Convert cents to dollars
        console.log(
          `[${
            submissionPlatform || "Unknown"
          } Paid] earnings=${submissionEarnings.toFixed(2)}`
        );
      } else {
        // Calculate expected earnings for verified unpaid (YouTube, Instagram)
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
      } else if (flatFeeBonus > 0) {
        // For both CPM and leaderboard contests, check if we can add this bonus
        const bonusAmount = flatFeeBonus / 100;
        let budgetCap = null;

        if (contest.contest_type === "cpm" && capInDollars !== null) {
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
      contest.contest_type === "cpm" &&
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

    const cpmPaid = Math.round(cpmTotal * 100); // Convert back to cents
    const bonusPaid = Math.round(bonusTotal * 100); // Convert back to cents
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

    const cpmPercentage =
      totalBudget > 0 ? Math.min((cpmPaid / totalBudget) * 100, 100) : 0;
    const bonusPercentage =
      bonusBudget && bonusBudget > 0
        ? Math.min((bonusPaid / bonusBudget) * 100, 100)
        : 0;
    // For display in progress bar, calculate bonus as percentage of totalBudget
    const bonusPercentageOfTotal =
      totalBudget > 0 ? Math.min((bonusPaid / totalBudget) * 100, 100) : 0;
    const totalPercentage =
      totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

    return {
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
      bonusSpent: bonusPaid,
      totalSpent,
    };
  }, [contest, submissions, creatorManualPointsAdjustments]);

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const remaining = Math.max(0, totalBudget - totalSpent);
  const isNearLimit = totalPercentage >= 80;

  // Only show for CPM and leaderboard contests
  if (
    contest.contest_type !== "cpm" &&
    contest.contest_type !== "leaderboard"
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
            ? `${
                contest.contest_type === "cpm" ? "CPM" : "Contest"
              } Earnings: ${formatCurrency(
                cpmPaid
              )} | Flat Fee Bonus: ${formatCurrency(bonusPaid)}${
                contest.contest_type === "cpm" && bonusBudget && bonusBudget > 0
                  ? ` / ${formatCurrency(bonusBudget)} cap`
                  : ""
              } | Total: ${formatCurrency(totalSpent)}`
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
        {/* Flat fee bonus portion */}
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
              {contest.contest_type === "cpm"
                ? "CPM Earnings"
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
                Flat Fee Bonus
              </p>
              <p
                className={cn(
                  "font-semibold",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                {formatCurrency(bonusPaid)}
                {contest.contest_type === "cpm" &&
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
