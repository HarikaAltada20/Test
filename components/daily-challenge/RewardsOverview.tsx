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
  embedded?: boolean;
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
        "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums",
        centered && "sm:justify-center",
      )}
      aria-label="Wins by challenge period"
    >
      {wins.map((win) => (
        <span
          key={win.short}
          title={`${win.label} wins: ${number(win.count)}`}
          aria-label={`${win.label}: ${number(win.count)} wins`}
          className={cn(
            "inline-flex items-baseline gap-1",
            isDark ? "text-neutral-200" : "text-[#292524]",
          )}
        >
          <span className="font-semibold">{win.short}</span>
          <span
            className={cn(
              "font-bold",
              isDark ? "text-white" : "text-neutral-900",
            )}
          >
            {number(win.count)}
          </span>
        </span>
      ))}
    </div>
  );
}

export function RewardsPaidSummary({
  isDark,
  loading,
  summary,
}: {
  isDark: boolean;
  loading: boolean;
  summary: RewardsSummaryView | null;
}) {
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

  if (loading && !summary) {
    return (
      <div className="mt-4 h-16 animate-pulse rounded-xl bg-neutral-100" />
    );
  }

  return (
    <div className="mt-4">
      <p
        className={cn(
          "text-sm font-semibold uppercase tracking-[0.12em]",
          isDark ? "text-neutral-200" : "text-[#292524]",
        )}
      >
        Rewards paid
      </p>
      <p className="mt-1 text-base font-semibold text-emerald-700">
        {formatPrize(summary?.totalPaidMinorUnits ?? 0, currency)} paid in{" "}
        {number(summary?.totalRewardCount ?? 0)} reward
        {(summary?.totalRewardCount ?? 0) === 1 ? "" : "s"} so far
      </p>
      <p
        className={cn(
          "mt-1 text-base",
          isDark ? "text-neutral-200" : "text-[#292524]",
        )}
      >
        Proof of rewards awarded across completed challenges.{" "}
        {number(summary?.totalRewardCount ?? 0)} recorded reward
        {(summary?.totalRewardCount ?? 0) === 1 ? "" : "s"}.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {rewardBreakdown.map((reward) => (
          <div
            key={reward.label}
            className={cn(
              "rounded-xl border px-3 py-2.5",
              isDark
                ? "border-white/10 bg-white/[0.03]"
                : "border-[#f3e6d8] bg-[#fffaf6]",
            )}
          >
            <p
              className={cn(
                "text-sm font-semibold uppercase tracking-wide",
                isDark ? "text-neutral-200" : "text-[#292524]",
              )}
            >
              {reward.label}
            </p>
            <p
              className={cn(
                "mt-1 text-base font-semibold tabular-nums",
                isDark ? "text-white" : "text-[#171717]",
              )}
            >
              {formatPrize(reward.amount, currency)}
            </p>
            <p
              className={cn(
                "text-sm",
                isDark ? "text-neutral-200" : "text-[#292524]",
              )}
            >
              {number(reward.count)} reward{reward.count === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RewardsOverview({
  isDark,
  loading,
  summary,
  topCreators,
  embedded = false,
}: RewardsOverviewProps) {
  const currency = summary?.prizeCurrency || "INR";
  const topThree = topCreators.slice(0, 3);
  const remainingCreators = topCreators.slice(3);

  const creators = (
    <div>
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-amber-500" aria-hidden />
        <h3
          className={cn(
            "text-base font-semibold",
            isDark ? "text-white" : "text-neutral-950",
          )}
        >
          Top creators
        </h3>
      </div>
      <p
        className={cn(
          "mt-1 text-base",
          isDark ? "text-neutral-200" : "text-[#292524]",
        )}
      >
        The creators earning the most from Daily Challenges.
      </p>

      {loading && topCreators.length === 0 ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-xl bg-neutral-100"
            />
          ))}
        </div>
      ) : topCreators.length === 0 ? (
        <p
          className={cn(
            "py-10 text-center text-base",
            isDark ? "text-neutral-200" : "text-[#292524]",
          )}
        >
          No winners recorded yet. Creator rankings appear after the first
          reward is awarded.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {topThree.map((creator) => (
              <div
                key={creator.creatorId}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl border p-3 sm:flex-col sm:justify-center sm:px-2 sm:py-5 sm:text-center",
                  creator.rank === 1
                    ? isDark
                      ? "border-[#c4a15a]/45 bg-[linear-gradient(180deg,rgba(196,161,90,0.28)_0%,rgba(14,14,14,0.4)_46%,#0e0e0e_78%)]"
                      : "border-[#f0d3b0] bg-gradient-to-b from-white to-[#fff6ee]"
                    : isDark
                      ? "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,#0e0e0e_52%)]"
                      : "border-[#f3e6d8] bg-[#fafafa]",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:absolute sm:left-2.5 sm:top-2.5",
                    creator.rank === 1
                      ? "bg-neutral-900 text-white"
                      : creator.rank === 2
                        ? "bg-neutral-200 text-neutral-700"
                        : "bg-orange-200 text-orange-900",
                  )}
                >
                  #{creator.rank}
                </span>
                <Avatar
                  className={cn(
                    "h-11 w-11 sm:h-14 sm:w-14",
                    creator.rank === 1 && "ring-2 ring-orange-200",
                  )}
                >
                  <AvatarImage src={creator.profilePictureUrl || undefined} />
                  <AvatarFallback>
                    {(creator.username || "C").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 sm:w-full sm:flex-none">
                  <p
                    className={cn(
                      "truncate text-base font-semibold",
                      isDark ? "text-white" : "text-[#171717]",
                    )}
                  >
                    {creator.username}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-sm",
                      isDark ? "text-neutral-200" : "text-[#292524]",
                    )}
                  >
                    {number(creator.winCount)} win
                    {creator.winCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 font-semibold tabular-nums">
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
                "mt-4 divide-y border-t",
                isDark
                  ? "divide-white/10 border-white/10"
                  : "divide-neutral-100 border-neutral-200",
              )}
            >
              {remainingCreators.map((creator) => (
                <div
                  key={creator.creatorId}
                  className="flex items-center gap-3 py-3"
                >
                  <span
                    className={cn(
                      "w-7 shrink-0 text-center text-sm font-semibold",
                      isDark ? "text-neutral-200" : "text-[#292524]",
                    )}
                  >
                    #{creator.rank}
                  </span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={creator.profilePictureUrl || undefined} />
                    <AvatarFallback>
                      {(creator.username || "C").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-base font-semibold",
                        isDark ? "text-white" : "text-[#171717]",
                      )}
                    >
                      {creator.username}
                    </p>
                    <p
                      className={cn(
                        "text-sm",
                        isDark ? "text-neutral-200" : "text-[#292524]",
                      )}
                    >
                      {number(creator.winCount)} win
                      {creator.winCount === 1 ? "" : "s"}
                    </p>
                    <CreatorWinBreakdown creator={creator} isDark={isDark} />
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-base font-semibold tabular-nums",
                      isDark ? "text-white" : "text-[#171717]",
                    )}
                  >
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
  );

  if (embedded) return creators;

  return (
    <section
      className={cn(
        "rounded-[22px] border px-5 py-6 shadow-[0_1px_2px_rgba(120,72,20,0.04)] sm:px-6",
        isDark ? "border-white/10 bg-[#161616]" : "border-[#f0e2d2] bg-white",
      )}
      aria-labelledby="rewards-overview-heading"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" aria-hidden />
            <h2
              id="rewards-overview-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Total paid
            </h2>
          </div>
          <RewardsPaidSummary
            isDark={isDark}
            loading={loading}
            summary={summary}
          />
        </div>
        {creators}
      </div>
    </section>
  );
}
