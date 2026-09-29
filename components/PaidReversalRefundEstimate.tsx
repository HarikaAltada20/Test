"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type PaidReversalRefundLine = {
  id: string;
  label: string;
  description: string;
  cents: number;
  /** When false, amount is shown but excluded from the total. */
  included: boolean;
};

type PaidReversalRefundEstimateProps = {
  isDark: boolean;
  paidSubmissionCount: number;
  lines: PaidReversalRefundLine[];
  totalCents: number;
  formatMoney: (cents: number) => string;
  showMvOptionalToggle?: boolean;
  mvOptionalCents?: number;
  includeMvBonusReversal?: boolean;
  onIncludeMvBonusReversalChange?: (checked: boolean) => void;
};

function RefundLineRow({
  line,
  isDark,
  formatMoney,
}: {
  line: PaidReversalRefundLine;
  isDark: boolean;
  formatMoney: (cents: number) => string;
}) {
  const StatusIcon = line.included ? CheckCircle2 : Circle;
  return (
    <div
      className={cn(
        "flex gap-2.5 py-2",
        !line.included && (isDark ? "opacity-70" : "opacity-75"),
      )}
    >
      <StatusIcon
        className={cn(
          "h-4 w-4 mt-0.5 shrink-0",
          line.included
            ? isDark
              ? "text-emerald-400"
              : "text-emerald-600"
            : isDark
              ? "text-gray-500"
              : "text-slate-400",
        )}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium leading-snug">{line.label}</p>
            <p
              className={cn(
                "text-xs mt-0.5 leading-snug",
                isDark ? "text-gray-400" : "text-slate-500",
              )}
            >
              {line.description}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold tabular-nums">
              {formatMoney(line.cents)}
            </p>
            <p
              className={cn(
                "text-[10px] uppercase tracking-wide font-medium mt-0.5",
                line.included
                  ? isDark
                    ? "text-emerald-400/90"
                    : "text-emerald-700"
                  : isDark
                    ? "text-gray-500"
                    : "text-slate-400",
              )}
            >
              {line.included ? "Included" : "Not included"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PaidReversalRefundEstimate({
  isDark,
  paidSubmissionCount,
  lines,
  totalCents,
  formatMoney,
  showMvOptionalToggle,
  mvOptionalCents = 0,
  includeMvBonusReversal,
  onIncludeMvBonusReversalChange,
}: PaidReversalRefundEstimateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border text-sm overflow-hidden",
        isDark
          ? "border-gray-600 bg-gray-900/50"
          : "border-slate-200 bg-white shadow-sm",
      )}
    >
      <div
        className={cn(
          "px-3.5 py-2.5 border-b",
          isDark
            ? "border-gray-700 bg-gray-900/80"
            : "border-slate-100 bg-slate-50",
        )}
      >
        <p className="font-semibold">Wallet refund estimate</p>
        <p
          className={cn(
            "text-xs mt-0.5",
            isDark ? "text-gray-400" : "text-slate-500",
          )}
        >
          From {paidSubmissionCount} paid submission
          {paidSubmissionCount === 1 ? "" : "s"} in this selection
        </p>
      </div>

      <div className="px-3.5 divide-y divide-inherit">
        {lines.map((line) => (
          <RefundLineRow
            key={line.id}
            line={line}
            isDark={isDark}
            formatMoney={formatMoney}
          />
        ))}
      </div>

      {showMvOptionalToggle && mvOptionalCents > 0 ? (
        <label
          className={cn(
            "flex items-start gap-3 px-3.5 py-3 border-t cursor-pointer",
            isDark
              ? "border-gray-700 bg-gray-900/30 hover:bg-gray-900/50"
              : "border-slate-100 bg-violet-50/60 hover:bg-violet-50",
          )}
        >
          <Checkbox
            checked={Boolean(includeMvBonusReversal)}
            onCheckedChange={(checked) =>
              onIncludeMvBonusReversalChange?.(checked === true)
            }
            className="mt-0.5"
          />
          <span className="leading-snug">
            <span className="font-medium">
              Reverse Most Verified bonus too
            </span>
            <span
              className={cn(
                " block text-xs mt-0.5",
                isDark ? "text-gray-400" : "text-slate-600",
              )}
            >
              Adds {formatMoney(mvOptionalCents)} to the refund total (views
              and/or reels leaderboard bonus).
            </span>
          </span>
        </label>
      ) : null}

      <div
        className={cn(
          "flex items-center justify-between px-3.5 py-3 border-t font-semibold",
          isDark ? "border-gray-700 bg-gray-900/80" : "border-slate-100 bg-slate-50",
        )}
      >
        <span>Total refund</span>
        <span className="text-base tabular-nums">{formatMoney(totalCents)}</span>
      </div>
    </div>
  );
}
