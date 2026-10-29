"use client";

import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type PrizeRow = { position: number; amount: number };

type BrandOverviewPrizeStructureProps = {
  isDark?: boolean;
  /** `leaderboard_contest` object (reads `prizes` and `winner_count`). */
  leaderboard: {
    prizes?: unknown;
    winner_count?: number | string | null;
  };
  /** Total prize pool in cents (same value shown in the summary tile). */
  poolCents: number;
  formatMoney: (cents: number) => string;
  keyPrefix: string;
};

const ordinal = (n: number) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  return mod10 === 1
    ? `${n}st`
    : mod10 === 2
      ? `${n}nd`
      : mod10 === 3
        ? `${n}rd`
        : `${n}th`;
};

/**
 * Figma "Contest Details Redesign" brand Overview Prize Structure body:
 * summary tiles + top-3 trophy cards + compact rows for the remaining positions.
 * Visual only — renders exactly the data the previous list rendered.
 */
export function BrandOverviewPrizeStructure({
  isDark = false,
  leaderboard,
  poolCents,
  formatMoney,
  keyPrefix,
}: BrandOverviewPrizeStructureProps) {
  const muted = isDark ? "text-slate-400" : "text-[#737373]";
  const primary = isDark ? "text-white" : "text-[#0a0a0a]";
  const sortedPrizes: PrizeRow[] = Array.isArray(leaderboard.prizes)
    ? ([...(leaderboard.prizes as PrizeRow[])] as PrizeRow[]).sort(
        (a, b) => a.position - b.position,
      )
    : [];
  const topPrizes = sortedPrizes.filter((p) => p.position <= 3);
  const otherPrizes = sortedPrizes.filter((p) => p.position > 3);

  const poolShare = (amount: number) => {
    if (!poolCents) return null;
    const pct = (amount / poolCents) * 100;
    return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
  };

  const trophyTone = (position: number) =>
    position === 1
      ? {
          card: isDark
            ? "border-[#e6d3a3]/40 bg-[#e6d3a3]/10"
            : "border-[#e6d3a3] bg-[#fff6e0]",
          icon: "text-[#d4a017]",
          chip: isDark
            ? "bg-white/10 text-[#fbe7b0]"
            : "border border-[#e6d3a3] bg-white text-[#7a5a1e]",
        }
      : position === 2
        ? {
            card: isDark
              ? "border-white/15 bg-white/[0.04]"
              : "border-[#e5e5e5] bg-[#fafafa]",
            icon: "text-[#a3a3a3]",
            chip: isDark
              ? "bg-white/10 text-slate-200"
              : "bg-[#f5f5f5] text-[#404040]",
          }
        : {
            card: isDark
              ? "border-[#c98b5a]/40 bg-[#c98b5a]/10"
              : "border-[#ecd3bd] bg-[#fdf3ea]",
            icon: "text-[#c98b5a]",
            chip: isDark
              ? "bg-white/10 text-[#f0c9a6]"
              : "border border-[#ecd3bd] bg-white text-[#8a4b1f]",
          };

  const tileClass = cn(
    "rounded-xl border px-4 py-3.5",
    isDark ? "border-white/10 bg-white/[0.04]" : "border-[#e5e5e5] bg-[#fafafa]",
  );
  const sectionLabel = cn(
    "text-[11px] font-semibold uppercase tracking-[0.88px]",
    muted,
  );
  const topCount = Math.min(3, topPrizes.length);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={tileClass}>
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.66px]",
              muted,
            )}
          >
            Total Prize Pool
          </p>
          <p
            className={cn(
              "mt-1 text-xl font-bold tracking-[-0.3px]",
              primary,
            )}
          >
            {formatMoney(poolCents)}
          </p>
        </div>
        <div className={tileClass}>
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.66px]",
              muted,
            )}
          >
            Total Winners
          </p>
          <p
            className={cn(
              "mt-1 text-xl font-bold tracking-[-0.3px]",
              primary,
            )}
          >
            {leaderboard.winner_count}
          </p>
        </div>
      </div>

      <h4 className="sr-only">Prize Distribution</h4>

      {topPrizes.length > 0 ? (
        <div className="space-y-2.5">
          <p className={sectionLabel}>
            {topCount === 1 ? "Top winner" : `Top ${topCount} winners`}
          </p>
          <div
            className={cn(
              "grid grid-cols-1 gap-3",
              topPrizes.length >= 3
                ? "sm:grid-cols-3"
                : topPrizes.length === 2
                  ? "sm:grid-cols-2"
                  : "",
            )}
          >
            {topPrizes.map((prize, index) => {
              const tone = trophyTone(prize.position);
              const share = poolShare(prize.amount);
              return (
                <div
                  key={`${keyPrefix}-top-${prize.position}-${index}`}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border px-4 py-5 text-center",
                    tone.card,
                  )}
                >
                  <Trophy className={cn("h-8 w-8", tone.icon)} />
                  {share ? (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        tone.chip,
                      )}
                    >
                      {share} of pool
                    </span>
                  ) : null}
                  <p className={cn("text-[13px] font-semibold", muted)}>
                    {ordinal(prize.position)} place
                  </p>
                  <p
                    className={cn(
                      "text-2xl font-bold tracking-[-0.36px]",
                      primary,
                    )}
                  >
                    {formatMoney(prize.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {otherPrizes.length > 0 ? (
        <div className="space-y-2.5">
          <p className={sectionLabel}>
            Positions {otherPrizes[0].position}–
            {otherPrizes[otherPrizes.length - 1].position}
          </p>
          <div
            className={cn(
              "overflow-hidden rounded-2xl border",
              isDark ? "border-white/10" : "border-[#e5e5e5]",
            )}
          >
            {otherPrizes.map((prize, index) => {
              const share = poolShare(prize.amount);
              return (
                <div
                  key={`${keyPrefix}-${prize.position}-${index}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    index > 0 &&
                      (isDark
                        ? "border-t border-white/10"
                        : "border-t border-[#e5e5e5]"),
                  )}
                >
                  <Trophy className="h-4 w-4 shrink-0 text-[#a3a3a3]" />
                  <span className={cn("flex-1 text-sm font-medium", primary)}>
                    {ordinal(prize.position)} place
                  </span>
                  {share ? (
                    <span className={cn("text-xs", muted)}>{share}</span>
                  ) : null}
                  <span
                    className={cn(
                      "min-w-[72px] text-right text-sm font-bold",
                      primary,
                    )}
                  >
                    {formatMoney(prize.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
