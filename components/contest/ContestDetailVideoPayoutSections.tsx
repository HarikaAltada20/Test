"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents as formatMoney } from "@/lib/currency-utils";
import {
  ContestDetailPlatformIcons,
  ContestDetailPlatformScopeCard,
} from "@/components/contest/ContestDetailPlatformScopeCard";
import {
  isCpmContestType,
  isDualRewardsContestType,
  isMilestoneContestType,
} from "@/lib/contest-type";
import type { VideoContestPlatform } from "@/lib/video-platform-campaigns";
import { Eye, Gift, Info, Play, Wallet } from "lucide-react";

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

function PayoutStatTile({
  label,
  value,
  hint,
  isDark,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  isDark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        isDark ? "border-white/10 bg-white/[0.04]" : "border-[#e5e5e5] bg-[#fafafa]",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.66px]",
          isDark ? "text-slate-400" : "text-[#737373]",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-xl font-bold tracking-[-0.3px]",
          isDark ? "text-white" : "text-[#0a0a0a]",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-1 text-xs",
            isDark ? "text-slate-400" : "text-[#737373]",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

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

  if (!showCpm && !showMilestone) return null;

  const body = (
    <div className="space-y-6">
      {showCpm && cpm && (
        <div
          className={cn(
            "overflow-hidden rounded-2xl border shadow-[0px_1px_3px_0px_rgba(10,10,10,0.04)]",
            isDark ? "border-white/10 bg-[#111113]" : "border-[#e5e5e5] bg-white",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3 border-b px-5 py-4",
              isDark ? "border-white/10" : "border-[#e5e5e5]",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
                isDark ? "bg-white/10" : "bg-[#fafafa]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/contest-details/earn-dollar.svg"
                alt=""
                width={16}
                height={16}
                className="h-4 w-4"
              />
            </div>
            <div className="min-w-0">
              <h3
                className={cn(
                  "flex items-center gap-2 text-[15px] font-semibold",
                  isDark ? "text-white" : "text-[#0a0a0a]",
                )}
              >
                {isDualRewardsContestType(contestType)
                  ? "CPM Payout Model"
                  : "CPM Configuration"}
                {sharedPlatformIcons && sharedPlatformIcons.length >= 2 ? (
                  <ContestDetailPlatformIcons platforms={sharedPlatformIcons} />
                ) : null}
              </h3>
              <p
                className={cn(
                  "text-xs",
                  isDark ? "text-slate-400" : "text-[#737373]",
                )}
              >
                Pay creators based on verified views
              </p>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <PayoutStatTile
                isDark={isDark}
                label="Pay rate (CPM)"
                value={`$${parseFloat(String(cpm.cpm_rate_usd ?? 0)).toFixed(2)}`}
                hint={`per 1,000 ${isTwitterCpmCampaign ? "points" : "views"}`}
              />
              {!isDualRewardsContestType(contestType) && (
                <PayoutStatTile
                  isDark={isDark}
                  label="Total Budget"
                  value={formatMoney(cpm.total_budget)}
                />
              )}
              {cpm.min_views != null && (
                <PayoutStatTile
                  isDark={isDark}
                  label="Min. views to qualify"
                  value={cpm.min_views.toLocaleString()}
                  hint="per submission"
                />
              )}
              {cpm.max_views != null && (
                <PayoutStatTile
                  isDark={isDark}
                  label="Max Views (Cap)"
                  value={cpm.max_views.toLocaleString()}
                />
              )}
            </div>

            <div>
              <h4
                className={cn(
                  "mb-2 text-sm font-semibold",
                  isDark ? "text-white" : "text-[#0a0a0a]",
                )}
              >
                Terms & Conditions
              </h4>
              <div
                className={cn(
                  "rounded-xl border p-3 text-[13px]",
                  isDark
                    ? "border-white/10 bg-white/[0.04] text-white"
                    : "border-[#e5e5e5] bg-[#fafafa] text-[#404040]",
                )}
              >
                <div className="whitespace-pre-wrap break-words">
                  {cpm.terms_conditions || "No specific terms provided."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMilestone && milestone && (
        <div
          className={cn(
            "overflow-hidden rounded-2xl border shadow-[0px_1px_3px_0px_rgba(10,10,10,0.04)]",
            isDark ? "border-white/10 bg-[#111113]" : "border-[#e5e5e5] bg-white",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3 border-b px-5 py-4",
              isDark ? "border-white/10" : "border-[#e5e5e5]",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
                isDark ? "bg-white/10" : "bg-[#fafafa]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/contest-details/earn-trophy.svg"
                alt=""
                width={16}
                height={16}
                className="h-4 w-4"
              />
            </div>
            <div className="min-w-0">
              <h3
                className={cn(
                  "flex items-center gap-2 text-[15px] font-semibold",
                  isDark ? "text-white" : "text-[#0a0a0a]",
                )}
              >
                Milestone Rewards Ladder
                {sharedPlatformIcons && sharedPlatformIcons.length >= 2 ? (
                  <ContestDetailPlatformIcons platforms={sharedPlatformIcons} />
                ) : null}
              </h3>
              <p
                className={cn(
                  "text-xs",
                  isDark ? "text-slate-400" : "text-[#737373]",
                )}
              >
                Higher view thresholds unlock higher payouts
              </p>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            {(() => {
              const sortedMilestones = (milestone.milestones || [])
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0));
              return (
                <div className="flex min-w-0 flex-col gap-2.5">
                  {sortedMilestones.map((row, index) => {
                    const isFinal = index === sortedMilestones.length - 1;
                    const target = Number(row.target_views) || 0;
                    const reachedCount =
                      winnerCountsByMilestone?.get(Number(row.target_views)) ||
                      0;
                    const payoutLabel = formatMoney(
                      Number(row.payout_cents) || 0,
                    );
                    return (
                      <div
                        key={`${row.order ?? index}-${row.target_views ?? index}`}
                        className={cn(
                          "grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 overflow-hidden rounded-2xl py-4 pl-5 pr-5 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:pr-6",
                          isFinal
                            ? "bg-[#0a0a0a] text-white shadow-[0px_10px_20px_0px_rgba(10,10,10,0.2)]"
                            : isDark
                              ? "border border-white/10 bg-white/[0.04]"
                              : "border border-[#e5e5e5] bg-white",
                        )}
                      >
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center justify-self-start">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/images/contest-details/milestone-hex.svg"
                            alt=""
                            width={38}
                            height={44}
                            className="pointer-events-none absolute left-1/2 top-0 h-11 w-[38px] -translate-x-1/2"
                          />
                          <span className="relative z-10 text-lg font-extrabold text-white">
                            {index + 1}
                          </span>
                        </div>

                        <div className="min-w-0 space-y-1">
                          <p
                            className={cn(
                              "text-[11px] font-semibold tracking-[1.1px]",
                              isFinal
                                ? "text-[#a3a3a3]"
                                : isDark
                                  ? "text-slate-400"
                                  : "text-[#737373]",
                            )}
                          >
                            MILESTONE {index + 1}
                          </p>
                          <p
                            className={cn(
                              "truncate text-xl font-semibold tracking-[-0.3px]",
                              isFinal
                                ? "text-white"
                                : isDark
                                  ? "text-white"
                                  : "text-[#0a0a0a]",
                            )}
                          >
                            {target.toLocaleString()} Views
                          </p>
                          {row.winner_limit ? (
                            <div
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                isFinal
                                  ? "bg-white/12 text-white"
                                  : reachedCount >= row.winner_limit
                                    ? "bg-red-100 text-red-700"
                                    : isDark
                                      ? "bg-white/10 text-slate-200"
                                      : "bg-[#f5f5f5] text-[#404040]",
                              )}
                            >
                              Winner limit {reachedCount} / {row.winner_limit}
                            </div>
                          ) : null}
                        </div>

                        <div className="col-span-2 flex w-full flex-col items-start sm:col-span-1 sm:w-auto sm:items-end">
                          <p
                            className={cn(
                              "text-xs font-medium",
                              isFinal
                                ? "text-[#a3a3a3]"
                                : isDark
                                  ? "text-slate-400"
                                  : "text-[#737373]",
                            )}
                          >
                            Payout
                          </p>
                          <p
                            className={cn(
                              "whitespace-nowrap text-[26px] font-bold leading-none tracking-[-0.52px]",
                              isFinal
                                ? "text-white"
                                : isDark
                                  ? "text-white"
                                  : "text-[#0a0a0a]",
                            )}
                          >
                            {payoutLabel}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div
              className={cn(
                "flex items-start gap-2.5 rounded-xl border px-4 py-3",
                isDark
                  ? "border-white/10 bg-white/[0.04] text-slate-200"
                  : "border-[#e5e5e5] bg-[#fafafa] text-[#404040]",
              )}
            >
              <Info className="mt-0.5 h-[18px] w-[18px] shrink-0" />
              <p className="text-[13px] leading-relaxed">
                Once a submission reaches the target view threshold, the
                corresponding milestone reward will be granted.
              </p>
            </div>

            {milestone.bonus?.enabled && (
              <div className="space-y-4 pt-2">
                <h3
                  className={cn(
                    "flex items-center gap-2 text-[15px] font-semibold",
                    isDark ? "text-white" : "text-[#0a0a0a]",
                  )}
                >
                  <Gift
                    className={cn(
                      "h-4 w-4",
                      isDark ? "text-slate-300" : "text-[#737373]",
                    )}
                  />
                  Competitive Bonus Tracks
                </h3>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {milestone.bonus.most_verified_views && (
                    <div
                      className={cn(
                        "rounded-xl border p-5",
                        isDark
                          ? "border-white/10 bg-white/[0.04]"
                          : "border-[#e5e5e5] bg-[#fafafa]",
                      )}
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div
                          className={cn(
                            "rounded-[10px] p-2",
                            isDark ? "bg-white/10" : "bg-white border border-[#e5e5e5]",
                          )}
                        >
                          <Eye
                            className={cn(
                              "h-5 w-5",
                              isDark ? "text-white" : "text-[#0a0a0a]",
                            )}
                          />
                        </div>
                        <Badge
                          className={cn(
                            "border-none",
                            isDark
                              ? "bg-white text-[#0a0a0a]"
                              : "bg-[#0a0a0a] text-white",
                          )}
                        >
                          {formatMoney(
                            milestone.bonus.most_verified_views.payout_cents,
                          )}
                        </Badge>
                      </div>
                      <h4
                        className={cn(
                          "mb-1 text-lg font-bold",
                          isDark ? "text-white" : "text-[#0a0a0a]",
                        )}
                      >
                        Most Verified Views
                      </h4>
                      <p
                        className={cn(
                          "text-sm",
                          isDark ? "text-slate-300" : "text-[#404040]",
                        )}
                      >
                        Awarded to the creator with the highest total verified
                        views.
                      </p>
                      <div
                        className={cn(
                          "mt-4 border-t pt-4",
                          isDark ? "border-white/10" : "border-[#e5e5e5]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 text-xs font-semibold">
                          <span
                            className={cn(
                              "uppercase tracking-tighter",
                              isDark ? "text-slate-400" : "text-[#737373]",
                            )}
                          >
                            Eligibility Condition
                          </span>
                          <div
                            className={cn(
                              "space-y-1 text-right",
                              isDark ? "text-slate-200" : "text-[#0a0a0a]",
                            )}
                          >
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
                        "rounded-xl border p-5",
                        isDark
                          ? "border-white/10 bg-white/[0.04]"
                          : "border-[#e5e5e5] bg-[#fafafa]",
                      )}
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div
                          className={cn(
                            "rounded-[10px] p-2",
                            isDark ? "bg-white/10" : "bg-white border border-[#e5e5e5]",
                          )}
                        >
                          <Play
                            className={cn(
                              "h-5 w-5",
                              isDark ? "text-white" : "text-[#0a0a0a]",
                            )}
                          />
                        </div>
                        <Badge
                          className={cn(
                            "border-none",
                            isDark
                              ? "bg-white text-[#0a0a0a]"
                              : "bg-[#0a0a0a] text-white",
                          )}
                        >
                          {formatMoney(
                            milestone.bonus.most_verified_reels.payout_cents,
                          )}
                        </Badge>
                      </div>
                      <h4
                        className={cn(
                          "mb-1 text-lg font-bold",
                          isDark ? "text-white" : "text-[#0a0a0a]",
                        )}
                      >
                        Most Verified Reels
                      </h4>
                      <p
                        className={cn(
                          "text-sm",
                          isDark ? "text-slate-300" : "text-[#404040]",
                        )}
                      >
                        Awarded to the creator with the most reels hitting
                        target views.
                      </p>
                      <div
                        className={cn(
                          "mt-4 border-t pt-4",
                          isDark ? "border-white/10" : "border-[#e5e5e5]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 text-xs font-semibold">
                          <span
                            className={cn(
                              "uppercase tracking-tighter",
                              isDark ? "text-slate-400" : "text-[#737373]",
                            )}
                          >
                            Eligibility Condition
                          </span>
                          <div
                            className={cn(
                              "space-y-1 text-right",
                              isDark ? "text-slate-200" : "text-[#0a0a0a]",
                            )}
                          >
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
                  "flex items-center justify-between rounded-xl border p-4",
                  isDark
                    ? "border-white/10 bg-white/[0.04]"
                    : "border-[#e5e5e5] bg-[#fafafa]",
                )}
              >
                <div className="flex items-center gap-3">
                  <Wallet
                    className={cn(
                      "h-5 w-5",
                      isDark ? "text-slate-300" : "text-[#737373]",
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isDark ? "text-slate-300" : "text-[#404040]",
                    )}
                  >
                    Total Budget
                  </span>
                </div>
                <span
                  className={cn(
                    "text-lg font-bold",
                    isDark ? "text-white" : "text-[#0a0a0a]",
                  )}
                >
                  {formatMoney(milestone.total_budget_cents)}
                </span>
              </div>
            )}
          </div>
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
