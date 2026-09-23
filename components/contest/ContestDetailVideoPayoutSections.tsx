"use client";

import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import {
  ContestDetailPlatformIcons,
  ContestDetailPlatformScopeCard,
} from "@/components/contest/ContestDetailPlatformScopeCard";
import { getPlatformIcon } from "@/lib/platform-icons";
import {
  isCpmContestType,
  isDualRewardsContestType,
  isMilestoneContestType,
} from "@/lib/contest-type";
import type { VideoContestPlatform } from "@/lib/video-platform-campaigns";
import { Eye, Gift, Info, Play, Trophy, Wallet, Zap } from "lucide-react";

type PayoutContestSlice = {
  contest_type?: string | null;
  contest_based_details?: {
    cpm_contest?: {
      cpm_rate_usd?: number | string;
      total_budget?: number;
      min_views?: number | null;
      max_views?: number | null;
      terms_conditions?: string | null;
    } | null;
    milestone_contest?: {
      milestones?: Array<{
        order?: number;
        target_views?: number;
        payout_cents?: number;
        winner_limit?: number | null;
      }>;
      total_budget_cents?: number;
      bonus?: {
        enabled?: boolean;
        most_verified_views?: {
          payout_cents?: number;
          min_total_views?: number;
          min_verified_reels?: number;
        };
        most_verified_reels?: {
          payout_cents?: number;
          min_verified_reels?: number;
          min_total_views?: number;
        };
      };
    } | null;
  } | null;
};

type ContestDetailVideoPayoutSectionsProps = {
  contest: PayoutContestSlice;
  isDark?: boolean;
  platform?: VideoContestPlatform | null;
  /** When several platforms share the same payout config, show them together. */
  platforms?: VideoContestPlatform[];
  showPlatformLabel?: boolean;
  /** Icons next to CPM/Milestone headings when payout is shared on All tab. */
  sharedPlatformIcons?: VideoContestPlatform[];
  isTwitterCpmCampaign?: boolean;
  winnerCountsByMilestone?: Map<number, number>;
};

export function ContestDetailVideoPayoutSections({
  contest,
  isDark = false,
  platform = null,
  platforms,
  showPlatformLabel = false,
  sharedPlatformIcons,
  isTwitterCpmCampaign = false,
  winnerCountsByMilestone,
}: ContestDetailVideoPayoutSectionsProps) {
  const details = contest.contest_based_details;
  const contestType = contest.contest_type;
  const cpm = details?.cpm_contest;
  const milestone = details?.milestone_contest;
  const showCpm = isCpmContestType(contestType) && !!cpm;
  const showMilestone = isMilestoneContestType(contestType) && !!milestone;
  const labelPlatforms =
    platforms && platforms.length > 0
      ? platforms
      : platform
        ? [platform]
        : [];
  const singleLabelPlatform =
    labelPlatforms.length === 1 ? labelPlatforms[0]! : null;

  if (!showCpm && !showMilestone) return null;

  const body = (
    <div className="space-y-6">
      {showCpm && cpm && (
        <div className="space-y-3">
          <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
            CPM Configuration
            {sharedPlatformIcons && sharedPlatformIcons.length >= 2 ? (
              <ContestDetailPlatformIcons platforms={sharedPlatformIcons} />
            ) : null}
          </h3>
          <div className="grid grid-col-1 md:grid-cols-2 gap-4">
            <div
              className={cn(
                "flex justify-between items-center p-3 rounded-md border",
                isDark ? "border-gray-600" : "border-gray-400",
              )}
            >
              <span
                className={cn(
                  "text-md font-medium tracking-wide",
                  isDark ? "text-white" : "text-black",
                )}
              >
                CPM Rate:
              </span>
              <span className="font-semibold text-md text-foreground">
                ${parseFloat(String(cpm.cpm_rate_usd ?? 0)).toFixed(2)} per 1000{" "}
                {isTwitterCpmCampaign ? "points" : "views"}
              </span>
            </div>
            {!isDualRewardsContestType(contestType) && (
              <div
                className={cn(
                  "flex justify-between items-center p-3 rounded-md border",
                  isDark ? "border-gray-600" : "border-gray-400",
                )}
              >
                <span
                  className={cn(
                    "text-md font-medium tracking-wide",
                    isDark ? "text-white" : "text-black",
                  )}
                >
                  Total Budget:
                </span>
                <span className="font-semibold text-md text-foreground">
                  {formatMoney(cpm.total_budget)}
                </span>
              </div>
            )}
            {cpm.min_views != null && (
              <div
                className={cn(
                  "flex justify-between items-center p-3 rounded-md border",
                  isDark ? "border-gray-600" : "border-gray-400",
                )}
              >
                <span
                  className={cn(
                    "text-md font-medium",
                    isDark ? "text-white" : "text-black",
                  )}
                >
                  Min Views:
                </span>
                <span className="font-semibold text-md text-foreground">
                  {cpm.min_views.toLocaleString()}
                </span>
              </div>
            )}
            {cpm.max_views != null && (
              <div
                className={cn(
                  "flex justify-between items-center p-3 rounded-md border",
                  isDark ? "border-gray-600" : "border-gray-400",
                )}
              >
                <span
                  className={cn(
                    "text-md font-medium",
                    isDark ? "text-white" : "text-black",
                  )}
                >
                  Max Views (Cap):
                </span>
                <span className="font-semibold text-md text-foreground">
                  {cpm.max_views.toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <div>
            <h4 className="text-md font-semibold mt-4 mb-2 text-foreground">
              Terms & Conditions
            </h4>
            <div
              className={cn(
                "p-3 border rounded-lg text-[13px] text-black",
                isDark
                  ? "border-gray-600 text-white"
                  : "border-gray-400 text-black",
              )}
            >
              <div className="whitespace-pre-wrap break-words">
                {cpm.terms_conditions || "No specific terms provided."}
              </div>
            </div>
          </div>
        </div>
      )}

      {showMilestone && milestone && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Milestone Rewards Ladder
                {sharedPlatformIcons && sharedPlatformIcons.length >= 2 ? (
                  <ContestDetailPlatformIcons platforms={sharedPlatformIcons} />
                ) : null}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4 min-w-0">
              {(milestone.milestones || [])
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((row, index) => (
                  <div
                    key={`${row.order ?? index}-${row.target_views ?? index}`}
                    className={cn(
                      "relative overflow-hidden rounded-xl border transition-all duration-300 group min-w-0",
                      isDark
                        ? "bg-[#170337] border-gray-600 hover:border-purple-500/50"
                        : "bg-white border-gray-200 hover:border-purple-400 font-bold",
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <CardContent className="p-4 sm:p-5 relative z-10">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
                        <div className="flex items-start gap-3 sm:gap-5 min-w-0 flex-1">
                          <div
                            className={cn(
                              "w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center rounded-2xl shadow-inner",
                              isDark
                                ? "bg-purple-900/40 text-purple-300 border border-purple-500/20"
                                : "bg-purple-50 text-purple-600 border border-purple-100",
                            )}
                          >
                            {showPlatformLabel && singleLabelPlatform ? (
                              getPlatformIcon(singleLabelPlatform)
                            ) : (
                              <Zap className="h-5 w-5 sm:h-6 sm:w-6" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                              <p
                                className={cn(
                                  "text-xs sm:text-sm font-semibold uppercase tracking-wider",
                                  isDark ? "text-purple-400" : "text-purple-600",
                                )}
                              >
                                Milestone {index + 1}
                              </p>
                              {row.winner_limit
                                ? (() => {
                                    const reachedCount =
                                      winnerCountsByMilestone?.get(
                                        Number(row.target_views),
                                      ) || 0;
                                    const isFull =
                                      reachedCount >= row.winner_limit;
                                    return (
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "text-[10px] h-4 px-1.5 shrink-0",
                                          isFull
                                            ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-500/30"
                                            : "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-500/30",
                                        )}
                                      >
                                        Limit: {reachedCount} /{" "}
                                        {row.winner_limit}
                                      </Badge>
                                    );
                                  })()
                                : null}
                            </div>
                            <p
                              className={cn(
                                "text-xl sm:text-2xl font-black break-words",
                                isDark ? "text-white" : "text-gray-900",
                              )}
                            >
                              {(row.target_views || 0).toLocaleString()}{" "}
                              <span className="text-sm font-medium opacity-70">
                                Views
                              </span>
                            </p>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "flex items-center justify-between sm:block sm:text-right shrink-0 w-full sm:w-auto border-t pt-3 sm:border-t-0 sm:pt-0",
                            isDark ? "border-gray-600" : "border-gray-200",
                          )}
                        >
                          <p
                            className={cn(
                              "text-xs font-medium sm:mb-1",
                              isDark ? "text-gray-400" : "text-gray-500",
                            )}
                          >
                            Payout
                          </p>
                          <p
                            className={cn(
                              "text-xl sm:text-2xl font-bold",
                              isDark ? "text-green-400" : "text-green-600",
                            )}
                          >
                            {formatMoney(row.payout_cents)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                ))}
            </div>

            <Alert
              className={cn(
                "mt-4 border-purple-600 shadow-sm",
                isDark
                  ? "bg-purple-900/20 text-purple-200"
                  : "bg-purple-50 text-purple-800",
              )}
            >
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm font-medium mt-0.5">
                Once a submission reaches the target view threshold, the
                corresponding milestone reward will be granted.
              </AlertDescription>
            </Alert>
          </div>

          {milestone.bonus?.enabled && (
            <div className="space-y-4 pt-4">
              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                <Gift className="h-5 w-5 text-pink-500" />
                Competitive Bonus Tracks
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {milestone.bonus.most_verified_views && (
                  <div
                    className={cn(
                      "rounded-xl border p-5 relative overflow-hidden",
                      isDark
                        ? "bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-500/30"
                        : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200",
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          isDark ? "bg-blue-900/40" : "bg-blue-100",
                        )}
                      >
                        <Eye className="h-5 w-5 text-blue-500" />
                      </div>
                      <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-none">
                        {formatMoney(
                          milestone.bonus.most_verified_views.payout_cents,
                        )}
                      </Badge>
                    </div>
                    <h4
                      className={cn(
                        "font-bold text-lg mb-1",
                        isDark ? "text-white" : "text-blue-900",
                      )}
                    >
                      Most Verified Views
                    </h4>
                    <p
                      className={cn(
                        "text-sm",
                        isDark ? "text-blue-200/70" : "text-blue-700",
                      )}
                    >
                      Awarded to the creator with the highest total verified
                      views.
                    </p>
                    <div className="mt-4 pt-4 border-t border-blue-500/20">
                      <div className="flex items-start justify-between gap-3 text-xs font-semibold">
                        <span className="opacity-70 uppercase tracking-tighter">
                          Eligibility Condition
                        </span>
                        <div className="text-blue-500 text-right space-y-1">
                          {typeof milestone.bonus.most_verified_views
                            .min_total_views === "number" && (
                            <div>
                              Min.{" "}
                              {milestone.bonus.most_verified_views.min_total_views.toLocaleString()}{" "}
                              Views
                            </div>
                          )}
                          {typeof milestone.bonus.most_verified_views
                            .min_verified_reels === "number" && (
                            <div>
                              Min.{" "}
                              {milestone.bonus.most_verified_views.min_verified_reels.toLocaleString()}{" "}
                              Reels
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {milestone.bonus.most_verified_reels && (
                  <div
                    className={cn(
                      "rounded-xl border p-5 relative overflow-hidden",
                      isDark
                        ? "bg-gradient-to-br from-pink-900/20 to-purple-900/20 border-pink-500/30"
                        : "bg-gradient-to-br from-pink-50 to-purple-50 border-pink-200",
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          isDark ? "bg-pink-900/40" : "bg-pink-100",
                        )}
                      >
                        <Play className="h-5 w-5 text-pink-500" />
                      </div>
                      <Badge className="bg-pink-500 hover:bg-pink-600 text-white border-none">
                        {formatMoney(
                          milestone.bonus.most_verified_reels.payout_cents,
                        )}
                      </Badge>
                    </div>
                    <h4
                      className={cn(
                        "font-bold text-lg mb-1",
                        isDark ? "text-white" : "text-pink-900",
                      )}
                    >
                      Most Verified Reels
                    </h4>
                    <p
                      className={cn(
                        "text-sm",
                        isDark
                          ? "text-pink-200/70"
                          : "text-pink-700 font-bold",
                      )}
                    >
                      Awarded to the creator with the most reels hitting target
                      views.
                    </p>
                    <div className="mt-4 pt-4 border-t border-pink-500/20">
                      <div className="flex items-start justify-between gap-3 text-xs font-semibold">
                        <span className="opacity-70 uppercase tracking-tighter">
                          Eligibility Condition
                        </span>
                        <div className="text-pink-500 text-right space-y-1">
                          {typeof milestone.bonus.most_verified_reels
                            .min_verified_reels === "number" && (
                            <div>
                              Min.{" "}
                              {milestone.bonus.most_verified_reels.min_verified_reels.toLocaleString()}{" "}
                              Reels
                            </div>
                          )}
                          {typeof milestone.bonus.most_verified_reels
                            .min_total_views === "number" && (
                            <div>
                              Min.{" "}
                              {milestone.bonus.most_verified_reels.min_total_views.toLocaleString()}{" "}
                              Views
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!isDualRewardsContestType(contestType) && (
            <div
              className={cn(
                "mt-6 p-4 rounded-xl border flex items-center justify-between",
                isDark
                  ? "bg-gray-900/30 border-gray-600"
                  : "bg-gray-50 border-gray-200",
              )}
            >
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-emerald-500" />
                <span
                  className={cn(
                    "text-sm font-medium",
                    isDark ? "text-gray-300" : "text-gray-600",
                  )}
                >
                  Total Budget
                </span>
              </div>
              <span
                className={cn(
                  "text-lg font-bold",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                {formatMoney(milestone.total_budget_cents)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (showPlatformLabel && labelPlatforms.length > 0) {
    return (
      <ContestDetailPlatformScopeCard
        platforms={labelPlatforms}
        isDark={isDark}
      >
        {body}
      </ContestDetailPlatformScopeCard>
    );
  }

  return body;
}
