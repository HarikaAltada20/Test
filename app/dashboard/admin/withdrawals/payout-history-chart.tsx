"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCompactCount,
  formatCurrencyFromCents,
} from "@/lib/currency-utils";
import type { WithdrawalPayoutSeriesPoint } from "@/lib/admin-withdrawals-list";

type ChartMode = "daily" | "cumulative";

function PayoutChartTooltip({
  active,
  payload,
  isDark,
  mode,
}: {
  active?: boolean;
  payload?: Array<{ payload?: WithdrawalPayoutSeriesPoint & { value: number } }>;
  isDark: boolean;
  mode: ChartMode;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 shadow-lg text-sm",
        isDark
          ? "border-white/10 bg-[#1a1a1a] text-white"
          : "border-black/10 bg-white text-black",
      )}
    >
      <p className="font-medium mb-1.5">{row.label}</p>
      <p className="text-[#7F39EC] mb-0.5">
        {mode === "cumulative" ? "Cumulative paid" : "Paid"} :{" "}
        {formatCurrencyFromCents(row.value)}
      </p>
      <p className={cn(isDark ? "text-white/55" : "text-black/55")}>
        {row.count} payout{row.count === 1 ? "" : "s"}
        {mode === "cumulative" ? " that day" : ""}
      </p>
    </div>
  );
}

export function PayoutHistoryChart({
  series,
  loading,
  isDark,
}: {
  series: WithdrawalPayoutSeriesPoint[];
  loading?: boolean;
  isDark: boolean;
}) {
  const [mode, setMode] = useState<ChartMode>("daily");

  const chartData = useMemo(() => {
    let running = 0;
    return series.map((point) => {
      running += point.amountCents;
      return {
        ...point,
        value: mode === "cumulative" ? running : point.amountCents,
      };
    });
  }, [series, mode]);

  const totalPaid = useMemo(
    () => series.reduce((sum, p) => sum + p.amountCents, 0),
    [series],
  );

  const hasAnyPaid = series.some((p) => p.amountCents > 0);

  const modeButtonClass = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-[#7F39EC] text-white"
        : isDark
          ? "text-white/60 hover:text-white"
          : "text-black/55 hover:text-black",
    );

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5 min-h-[320px]",
        isDark
          ? "border-white/10 bg-[#121212] text-white"
          : "border-black/5 bg-white text-black shadow-[0px_5px_20px_0px_#0000000D]",
      )}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            className={cn(
              "text-sm font-medium",
              isDark ? "text-white/55" : "text-black/55",
            )}
          >
            Paid to creators
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl tabular-nums">
            {loading ? "…" : formatCurrencyFromCents(totalPaid)}
          </p>
          <p
            className={cn(
              "mt-1 text-xs sm:text-sm",
              isDark ? "text-white/40" : "text-black/40",
            )}
          >
            Withdrawals marked paid in this date range
          </p>
        </div>

        <div
          className={cn(
            "inline-flex flex-wrap gap-1 rounded-full border p-1 self-start",
            isDark
              ? "border-white/10 bg-[#0d0d0d]"
              : "border-black/10 bg-[#f5f5f5]",
          )}
        >
          <button
            type="button"
            onClick={() => setMode("daily")}
            className={modeButtonClass(mode === "daily")}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setMode("cumulative")}
            className={modeButtonClass(mode === "cumulative")}
          >
            Cumulative
          </button>
        </div>
      </div>

      <div className="relative h-[240px] w-full sm:h-[280px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-inherit/40">
            <Loader2 className="h-7 w-7 animate-spin text-[#7F39EC]" />
          </div>
        )}
        {!loading && !hasAnyPaid ? (
          <div
            className={cn(
              "flex h-full items-center justify-center text-sm",
              isDark ? "text-white/40" : "text-black/40",
            )}
          >
            No payouts to creators in this range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
            >
              <defs>
                <linearGradient
                  id="withdrawalPayoutFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#7F39EC" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#7F39EC" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke={
                  isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
                }
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={40}
                tick={{
                  fill: isDark
                    ? "rgba(255,255,255,0.45)"
                    : "rgba(0,0,0,0.45)",
                  fontSize: 12,
                }}
              />
              <YAxis
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) => {
                  const dollars = Number(v) / 100;
                  if (dollars >= 1000) {
                    return `$${formatCompactCount(dollars)}`;
                  }
                  return `$${dollars.toLocaleString("en-US", {
                    maximumFractionDigits: dollars < 10 ? 2 : 0,
                  })}`;
                }}
                tick={{
                  fill: isDark
                    ? "rgba(255,255,255,0.45)"
                    : "rgba(0,0,0,0.45)",
                  fontSize: 12,
                }}
              />
              <Tooltip
                content={<PayoutChartTooltip isDark={isDark} mode={mode} />}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#7F39EC"
                strokeWidth={2.5}
                fill="url(#withdrawalPayoutFill)"
                dot={false}
                activeDot={{ r: 4, fill: "#7F39EC" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
