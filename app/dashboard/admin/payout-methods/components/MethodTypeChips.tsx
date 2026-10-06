"use client";

import { cn } from "@/lib/utils";
import type { AdminPayoutMethodsSummary } from "@/lib/admin-payout-methods";
import { METHOD_LABELS, METHOD_ORDER, MethodIcon, palette } from "./shared";

export function MethodTypeChips({
  summary,
  value,
  isDark,
  onChange,
}: {
  summary: AdminPayoutMethodsSummary | null;
  value: string | null;
  isDark: boolean;
  onChange: (methodType: string | null) => void;
}) {
  const p = palette(isDark);
  const byType = summary?.by_method_type ?? {};
  const types = METHOD_ORDER.filter((t) => t !== "phantom" || (byType.phantom ?? 0) > 0);

  const chip = (key: string | null, label: string, count: number, icon?: string) => {
    const active = value === key;
    return (
      <button
        key={key ?? "all"}
        type="button"
        onClick={() => onChange(key)}
        aria-pressed={active}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]",
          active
            ? "border-[#7F39EC] bg-[#7F39EC] text-white"
            : cn(p.surface, p.hover)
        )}
      >
        {icon && <MethodIcon type={icon} className="h-3.5 w-3.5" />}
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "rounded-full px-1.5 text-xs tabular-nums",
            active ? "bg-white/20" : isDark ? "bg-white/10" : "bg-gray-100"
          )}
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {chip(null, "All", summary?.total ?? 0)}
        {types.map((t) => chip(t, METHOD_LABELS[t], byType[t] ?? 0, t))}
      </div>
      {summary && (
        <p className={cn("text-xs", p.muted)}>
          {summary.added_last_24h} added in the last 24 hours, {summary.added_last_7d} this week
        </p>
      )}
    </div>
  );
}
