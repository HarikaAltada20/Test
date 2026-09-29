"use client";

import { Crown, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatPrize, number } from "./utils";

export type RewardsSummaryView = {
  totalPaidMinorUnits: number;
  dailyPaidMinorUnits: number;
  weeklyPaidMinorUnits: number;
  monthlyPaidMinorUnits: number;
  totalRewardCount: number;
  dailyRewardCount: number;
  weeklyRewardCount: number;
  monthlyRewardCount: number;
  prizeCurrency: string;
};

export type TopCreatorView = {
  rank: number;
  creatorId: string;
  username: string;
  fullName?: string | null;
  profilePictureUrl?: string | null;
  winCount: number;
  totalPaidMinorUnits: number;
  dailyWins?: number;
  weeklyWins?: number;
  monthlyWins?: number;
  prizeCurrency: string;
};

type RewardsOverviewProps = {
  isDark: boolean;
  loading: boolean;
  summary: RewardsSummaryView | null;
  topCreators: TopCreatorView[];
};

function CreatorWinBreakdown({
  creator,
  isDark,
  centered = false,
}: {
  creator: TopCreatorView;
  isDark: boolean;
  centered?: boolean;
}) {
  const wins = [
    { short: "D", label: "Daily", count: creator.dailyWins ?? 0 },
    { short: "W", label: "Weekly", count: creator.weeklyWins ?? 0 },
    { short: "M", label: "Monthly", count: creator.monthlyWins ?? 0 },
  ];

  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums",
        centered && "sm:justify-center",
      )}
      aria-label="Wins by challenge period"
    >
      {wins.map((win) => (
        <span
          key={win.short}
          title={`${win.label} wins: ${number(win.count)}`}
          aria-label={`${win.label}: ${number(win.count)} wins`}
          className={cn("inline-flex items-baseline gap-1", isDark ? "text-slate-400" : "text-slate-500")}
        >
          <span className="font-semibold">{win.short}</span>
          <span className={cn("font-bold", isDark ? "text-white" : "text-slate-900")}>
            {number(win.count)}
          </span>
        </span>
      ))}
    </div>
  );
}

export function RewardsOverview({
  isDark,
  loading,
  summary,
  topCreators,
}: RewardsOverviewProps) {
  const currency = summary?.prizeCurrency || "INR";
  const rewardBreakdown = [
    {
      label: "Daily",
      amount: summary?.dailyPaidMinorUnits ?? 0,
      count: summary?.dailyRewardCount ?? 0,
    },
    {
      label: "Weekly",
      amount: summary?.weeklyPaidMinorUnits ?? 0,
      count: summary?.weeklyRewardCount ?? 0,
    },
    {
      label: "Monthly",
      amount: summary?.monthlyPaidMinorUnits ?? 0,
      count: summary?.monthlyRewardCount ?? 0,
    },
  ];
  const topThree = topCreators.slice(0, 3);
  const remainingCreators = topCreators.slice(3);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border shadow-sm",
        isDark ? "border-white/10 bg-[#14052c]" : "border-slate-200 bg-white",
      )}
      aria-labelledby="rewards-overview-heading"
    >
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div
          className={cn(
            "px-5 py-6 sm:px-7 sm:py-7 lg:border-r",
            isDark ? "border-white/10" : "border-slate-200",
          )}
        >
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" aria-hidden />
            <h2 id="rewards-overview-heading" className="text-lg font-extrabold tracking-tight">
              Rewards paid
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Proof of rewards awarded across completed challenges.
          </p>

          {loading && !summary ? (
            <div className="mt-7 h-28 animate-pulse rounded-xl bg-muted/40" />
          ) : (
            <>
              <div
                className={cn(
                  "relative mt-6 overflow-hidden rounded-xl border p-5",
                  isDark
                    ? "border-amber-300/15 bg-amber-400/[0.08]"
                    : "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60",
                )}
              >
                <Trophy
                  className={cn(
                    "absolute -bottom-4 -right-2 h-24 w-24 rotate-[-10deg]",
                    isDark ? "text-amber-300/[0.08]" : "text-amber-300/25",
                  )}
                  aria-hidden
                />
                <div className="relative">
                  <p
                    className={cn(
                      "text-[11px] font-bold uppercase tracking-[0.14em]",
                      isDark ? "text-amber-300" : "text-amber-700",
                    )}
                  >
                    Total paid
                  </p>
                  <p className="mt-1 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                    {formatPrize(summary?.totalPaidMinorUnits ?? 0, currency)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {`${number(summary?.totalRewardCount ?? 0)} recorded reward${
                      (summary?.totalRewardCount ?? 0) === 1 ? "" : "s"
                    }`}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {rewardBreakdown.map((reward) => (
                  <div
                    key={reward.label}
                    className={cn(
                      "rounded-lg border p-3",
                      isDark
                        ? "border-white/10 bg-white/[0.025]"
                        : "border-slate-200 bg-slate-50/70",
                    )}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {reward.label}
                    </p>
                    <p className="mt-1 text-base font-extrabold tabular-nums sm:text-lg">
                      {formatPrize(reward.amount, currency)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {`${number(reward.count)} reward${reward.count === 1 ? "" : "s"}`}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" aria-hidden />
            <h2 className="text-lg font-extrabold tracking-tight">Top creators</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            The creators earning the most from Daily Challenges.
          </p>

          {loading && topCreators.length === 0 ? (
            <div className="mt-6 grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl bg-muted/40" />
              ))}
            </div>
          ) : topCreators.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No winners recorded yet. Creator rankings appear after the first reward is awarded.
            </p>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {topThree.map((creator) => (
                  <div
                    key={creator.creatorId}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl p-3 sm:flex-col sm:justify-center sm:px-2 sm:py-5 sm:text-center",
                      creator.rank === 1
                        ? isDark
                          ? "bg-amber-500/10 ring-1 ring-amber-400/25"
                          : "bg-amber-50 ring-1 ring-amber-200"
                        : isDark
                          ? "bg-white/[0.035]"
                          : "bg-slate-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black sm:absolute sm:left-2.5 sm:top-2.5",
                        creator.rank === 1
                          ? "bg-amber-200 text-amber-900"
                          : creator.rank === 2
                            ? "bg-slate-200 text-slate-700"
                            : "bg-orange-200 text-orange-900",
                      )}
                    >
                      #{creator.rank}
                    </span>
                    <Avatar className={cn("h-11 w-11 sm:h-14 sm:w-14", creator.rank === 1 && "ring-2 ring-amber-300 ring-offset-2")}>
                      <AvatarImage src={creator.profilePictureUrl || undefined} />
                      <AvatarFallback>
                        {(creator.username || "C").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 sm:w-full sm:flex-none">
                      <p className="truncate text-sm font-bold">{creator.username}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {`${number(creator.winCount)} win${creator.winCount === 1 ? "" : "s"}`}
                      </p>
                      <p className="mt-1 font-extrabold tabular-nums">
                        {formatPrize(
                          creator.totalPaidMinorUnits,
                          creator.prizeCurrency || currency,
                        )}
                      </p>
                      <CreatorWinBreakdown
                        creator={creator}
                        isDark={isDark}
                        centered
                      />
                    </div>
                  </div>
                ))}
              </div>

              {remainingCreators.length > 0 && (
                <div
                  className={cn(
                    "mt-5 divide-y border-t",
                    isDark ? "divide-white/10 border-white/10" : "divide-slate-200 border-slate-200",
                  )}
                >
                  {remainingCreators.map((creator) => (
                    <div
                      key={creator.creatorId}
                      className="flex items-center gap-3 py-3"
                    >
                      <span className="w-7 shrink-0 text-center text-xs font-bold text-muted-foreground">
                        #{creator.rank}
                      </span>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={creator.profilePictureUrl || undefined} />
                        <AvatarFallback>
                          {(creator.username || "C").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{creator.username}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {`${number(creator.winCount)} win${creator.winCount === 1 ? "" : "s"}`}
                        </p>
                        <CreatorWinBreakdown creator={creator} isDark={isDark} />
                      </div>
                      <p className="shrink-0 text-sm font-bold tabular-nums">
                        {formatPrize(
                          creator.totalPaidMinorUnits,
                          creator.prizeCurrency || currency,
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
