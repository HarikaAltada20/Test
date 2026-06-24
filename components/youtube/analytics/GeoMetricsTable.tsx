"use client";

import { cn } from "@/lib/utils";
import type { GeoMetricRow } from "@/lib/youtube-geo-metrics";
import {
  formatAvgDurationShort,
  formatWatchTimeHours,
} from "@/lib/youtube-geo-metrics";
import { fmt } from "./shared";

export type GeoTableRow = {
  key: string;
  label: string;
  metric: GeoMetricRow;
};

export function GeoMetricsTable({
  rows,
  isDark,
  compact,
}: {
  rows: GeoTableRow[];
  isDark?: boolean;
  /** Tighter padding for nested city tables */
  compact?: boolean;
}) {
  const dark = !!isDark;
  if (rows.length === 0) return null;

  const totals = rows.reduce(
    (acc, r) => ({
      views: acc.views + r.metric.views,
      watch_time_minutes: acc.watch_time_minutes + r.metric.watch_time_minutes,
    }),
    { views: 0, watch_time_minutes: 0 },
  );

  const cell = cn(
    "tabular-nums text-[10px] py-1 px-1",
    dark ? "text-slate-300" : "text-slate-600",
  );
  const head = cn(
    "text-[9px] font-semibold uppercase tracking-wide py-1 px-1 text-left",
    dark ? "text-slate-500" : "text-slate-400",
  );

  return (
    <div className="overflow-x-auto -mx-1">
      <table className={cn("w-full min-w-[280px]", compact ? "text-[10px]" : "")}>
        <thead>
          <tr className={cn("border-b", dark ? "border-slate-700" : "border-slate-200")}>
            <th className={cn(head, "min-w-[90px]")}>Location</th>
            <th className={cn(head, "text-right")}>Views</th>
            <th className={cn(head, "text-right w-8")}>%</th>
            <th className={cn(head, "text-right")}>Watch</th>
            <th className={cn(head, "text-right w-8")}>%</th>
            <th className={cn(head, "text-right")}>Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, metric }) => (
            <tr
              key={key}
              className={cn(
                "border-b last:border-0",
                dark ? "border-slate-800" : "border-slate-100",
              )}
            >
              <td
                className={cn(
                  cell,
                  "font-medium truncate max-w-[110px]",
                  dark ? "text-slate-200" : "text-slate-700",
                )}
                title={label}
              >
                {label}
              </td>
              <td className={cn(cell, "text-right font-semibold")}>
                {metric.views > 0 ? fmt(metric.views) : "—"}
              </td>
              <td className={cn(cell, "text-right")}>
                {metric.views_pct > 0 ? `${metric.views_pct.toFixed(1)}` : "—"}
              </td>
              <td className={cn(cell, "text-right")}>
                {metric.watch_time_minutes > 0
                  ? formatWatchTimeHours(metric.watch_time_minutes)
                  : "—"}
              </td>
              <td className={cn(cell, "text-right")}>
                {metric.watch_time_pct > 0
                  ? `${metric.watch_time_pct.toFixed(1)}`
                  : "—"}
              </td>
              <td className={cn(cell, "text-right")}>
                {metric.avg_view_duration_seconds > 0
                  ? formatAvgDurationShort(metric.avg_view_duration_seconds)
                  : "—"}
              </td>
            </tr>
          ))}
          {totals.views > 0 && (
            <tr
              className={cn(
                "font-semibold",
                dark ? "bg-slate-800/50" : "bg-slate-50",
              )}
            >
              <td className={cn(cell, dark ? "text-slate-200" : "text-slate-800")}>
                Total
              </td>
              <td className={cn(cell, "text-right")}>{fmt(totals.views)}</td>
              <td className={cn(cell, "text-right")}>100</td>
              <td className={cn(cell, "text-right")}>
                {formatWatchTimeHours(totals.watch_time_minutes)}
              </td>
              <td className={cn(cell, "text-right")}>100</td>
              <td className={cn(cell, "text-right")}>—</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
