"use client";

import { useMemo } from "react";

interface Submission {
    paid: boolean;
    earnings: number | null;
    bonus_paid: boolean;
    bonus_amount?: number;
}

interface Contest {
    prize_pool_cents: number | null;
    contest_based_details: any;
    contest_type: string;
    max_earnings_per_creator?: number | null;
}

interface BudgetProgressProps {
    contest: Contest;
    submissions: Submission[];
    showDetailed?: boolean; // Toggle between simple and detailed view
}

export function BudgetProgress({ contest, submissions, showDetailed = true }: BudgetProgressProps) {
    const { cpmPaid, bonusPaid, totalBudget, cpmPercentage, bonusPercentage, totalPercentage } = useMemo(() => {
        const totalBudget = contest.prize_pool_cents || 0;

        // Get contest config
        const cpmConfig = contest.contest_type === 'cpm'
            ? (contest.contest_based_details as any)?.cpm_contest
            : null;
        const flatFeeBonus = cpmConfig?.flat_fee_bonus || 0;
        const maxEarningsPerCreator = (contest as any).max_earnings_per_creator || null;
        const cpmRate = cpmConfig?.cpm_rate_usd || 0;
        const minViews = cpmConfig?.min_views;
        const maxViews = cpmConfig?.max_views;

        // Group submissions by creator to apply cap correctly
        const creatorEarnings = new Map<string, { cpmTotal: number; bonusTotal: number }>();

        // Filter to verified or paid submissions
        const relevantSubmissions = submissions.filter(s => {
            const status = (s as any).status?.toLowerCase();
            return status === 'verified' || status === 'paid';
        });

        // Sort by created_at to respect "first submitted, first paid" logic
        const sortedSubmissions = [...relevantSubmissions].sort((a, b) => {
            const dateA = new Date((a as any).created_at || 0).getTime();
            const dateB = new Date((b as any).created_at || 0).getTime();
            return dateA - dateB;
        });

        for (const sub of sortedSubmissions) {
            const creatorId = (sub as any).creator_id;
            if (!creatorEarnings.has(creatorId)) {
                creatorEarnings.set(creatorId, { cpmTotal: 0, bonusTotal: 0 });
            }

            const creatorData = creatorEarnings.get(creatorId)!;

            // Calculate CPM earnings
            let submissionEarnings = 0;
            if (sub.paid && sub.earnings != null) {
                // Use actual paid earnings from database
                submissionEarnings = sub.earnings / 100; // Convert cents to dollars
            } else {
                // Calculate expected earnings for verified unpaid
                let views = (sub as any).views || 0;
                if (minViews != null && views < minViews) views = 0;
                if (maxViews != null && views > maxViews) views = maxViews;
                submissionEarnings = (views * cpmRate) / 1000;
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

            // Calculate Bonus
            if ((sub as any).bonus_paid && (sub as any).bonus_amount != null) {
                // Use actual bonus amount from database
                creatorData.bonusTotal += (sub as any).bonus_amount / 100;
            } else if (flatFeeBonus > 0) {
                // Add expected bonus for verified unpaid
                creatorData.bonusTotal += flatFeeBonus / 100;
            }
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

        const cpmPercentage = totalBudget > 0 ? Math.min((cpmPaid / totalBudget) * 100, 100) : 0;
        const bonusPercentage = totalBudget > 0 ? Math.min((bonusPaid / totalBudget) * 100, 100) : 0;
        const totalPercentage = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

        return { cpmPaid, bonusPaid, totalBudget, cpmPercentage, bonusPercentage, totalPercentage };
    }, [contest, submissions]);

    const formatCurrency = (cents: number) => {
        return `$${(cents / 100).toFixed(2)}`;
    };

    const totalSpent = cpmPaid + bonusPaid;
    const remaining = Math.max(0, totalBudget - totalSpent);
    const isNearLimit = totalPercentage >= 80;
    const isOverBudget = totalPercentage >= 100;

    // Only show for CPM contests (leaderboard doesn't track budget the same way)
    if (contest.contest_type !== 'cpm') {
        return null;
    }

    if (!showDetailed) {
        // Simple view - just total budget used
        return (
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Budget Used</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
                    </span>
                </div>

                <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`absolute h-full transition-all duration-300 ${isOverBudget ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-blue-500'
                            }`}
                        style={{ width: `${Math.min(totalPercentage, 100)}%` }}
                    />
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400 text-right">
                    {formatCurrency(remaining)} remaining ({(100 - totalPercentage).toFixed(1)}%)
                </p>
            </div>
        );
    }

    // Detailed view with CPM/Leaderboard and Bonus breakdown
    return (
        <div className="space-y-3">
            <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300">Budget Tracker</span>
                <div className="text-right">
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(totalSpent)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400"> / {formatCurrency(totalBudget)}</span>
                </div>
            </div>

            {/* Two-color progress bar */}
            <div
                className="relative w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
                title={bonusPaid > 0
                    ? `CPM Earnings: ${formatCurrency(cpmPaid)} | Flat Fee Bonus: ${formatCurrency(bonusPaid)} | Total: ${formatCurrency(totalSpent)}`
                    : `Total based on views: ${formatCurrency(cpmPaid)}`
                }
            >
                {/* CPM/Leaderboard earnings portion */}
                <div
                    className="absolute h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                    style={{ width: `${Math.min(cpmPercentage, 100)}%` }}
                />
                {/* Flat fee bonus portion */}
                {bonusPaid > 0 && (
                    <div
                        className="absolute h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
                        style={{
                            left: `${Math.min(cpmPercentage, 100)}%`,
                            width: `${Math.min(bonusPercentage, 100 - cpmPercentage)}%`
                        }}
                    />
                )}
                {/* Warning indicator if over budget */}
                {isOverBudget && (
                    <div
                        className="absolute h-full bg-red-500 transition-all duration-300"
                        style={{
                            left: '100%',
                            width: `${totalPercentage - 100}%`,
                            transform: 'translateX(-100%)'
                        }}
                    />
                )}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-sm" />
                    <div className="flex-1">
                        <p className="font-medium text-gray-700 dark:text-gray-300">CPM Earnings</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(cpmPaid)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-green-600 rounded-sm" />
                    <div className="flex-1">
                        <p className="font-medium text-gray-700 dark:text-gray-300">Flat Fee Bonus</p>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(bonusPaid)}</p>
                    </div>
                </div>
            </div>

            {/* Status message */}
            {isOverBudget ? (
                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex-shrink-0 w-1 h-8 bg-red-500 rounded-full" />
                    <div className="flex-1 text-xs">
                        <p className="font-semibold text-red-900 dark:text-red-100">Over Budget</p>
                        <p className="text-red-700 dark:text-red-300">
                            Exceeded by {formatCurrency(totalSpent - totalBudget)}
                        </p>
                    </div>
                </div>
            ) : isNearLimit ? (
                <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex-shrink-0 w-1 h-8 bg-yellow-500 rounded-full" />
                    <div className="flex-1 text-xs">
                        <p className="font-semibold text-yellow-900 dark:text-yellow-100">Near Limit</p>
                        <p className="text-yellow-700 dark:text-yellow-300">
                            {formatCurrency(remaining)} remaining
                        </p>
                    </div>
                </div>
            ) : (
                <p className="text-xs text-gray-600 dark:text-gray-400 text-right">
                    {formatCurrency(remaining)} remaining ({(100 - totalPercentage).toFixed(1)}% available)
                </p>
            )}
        </div>
    );
}

