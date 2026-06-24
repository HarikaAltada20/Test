"use client";

import { cn } from "@/lib/utils";
import { TRAFFIC_LABELS, trafficBarColor } from "@/lib/youtube-analytics-labels";

export function fmt(n?: number) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function fmtDuration(seconds?: number) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function fmtMinutes(minutes?: number) {
  if (!minutes) return "—";
  if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
  return `${Math.round(minutes)}m`;
}

export function timeAgo(iso?: string | null) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SectionHeader({
  icon,
  title,
  isDark,
}: {
  icon: React.ReactNode;
  title: string;
  isDark?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className={isDark ? "text-purple-400" : "text-purple-500"}>
        {icon}
      </span>
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          isDark ? "text-slate-400" : "text-slate-500",
        )}
      >
        {title}
      </span>
    </div>
  );
}

export function StatRow({
  icon,
  label,
  value,
  sub,
  color,
  isDark,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  isDark?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div
        className={cn(
          "flex items-center gap-2",
          isDark ? "text-slate-400" : "text-slate-500",
        )}
      >
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            color ?? (isDark ? "text-slate-100" : "text-slate-800"),
          )}
        >
          {value}
        </span>
        {sub && (
          <span
            className={cn(
              "text-[10px]",
              isDark ? "text-slate-500" : "text-slate-400",
            )}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

export function PctBar({
  label,
  pct,
  barClass = "bg-purple-400",
  isDark,
  truncateLabel = 130,
}: {
  label: string;
  pct: number;
  barClass?: string;
  isDark?: boolean;
  truncateLabel?: number;
}) {
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[11px] mb-0.5 gap-2">
        <span
          className={cn(
            "truncate",
            isDark ? "text-slate-300" : "text-slate-600",
          )}
          style={{ maxWidth: truncateLabel }}
          title={label}
        >
          {label}
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums shrink-0",
            isDark ? "text-slate-200" : "text-slate-700",
          )}
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <div
        className={cn(
          "h-1.5 rounded-full overflow-hidden",
          isDark ? "bg-slate-800" : "bg-slate-100",
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all", barClass)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function TrafficSourceBar({
  source,
  pct,
  isDark,
}: {
  source: string;
  pct: number;
  isDark?: boolean;
}) {
  const label = TRAFFIC_LABELS[source] ?? source;
  const color = trafficBarColor(source, pct);
  return (
    <PctBar label={label} pct={pct} barClass={color} isDark={isDark} />
  );
}

export function EmptyTabMessage({
  message,
  isDark,
}: {
  message: string;
  isDark?: boolean;
}) {
  return (
    <p
      className={cn(
        "text-[11px] italic py-2",
        isDark ? "text-slate-500" : "text-slate-400",
      )}
    >
      {message}
    </p>
  );
}
