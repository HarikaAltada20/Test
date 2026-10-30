"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardStatTone = "sky" | "emerald" | "amber" | "violet";

type DashboardStatCardProps = {
  tone: DashboardStatTone;
  icon: LucideIcon;
  label: string;
  value: string;
  /** Second figure shown beside the main value, e.g. Paid next to Spend */
  secondary?: { label: string; value: string };
  description?: string;
  badge?: string;
  footerAction?: { label: string; href: string };
  footerMeta?: string;
  visual?: "sparkline" | "progress" | "line" | "none";
  /** 0–100 for progress visual */
  progress?: number;
  isDark?: boolean;
  className?: string;
};

const TONES: Record<
  DashboardStatTone,
  {
    lightBg: string;
    darkBg: string;
    iconWrap: string;
    iconWrapDark: string;
    icon: string;
    iconDark: string;
    chart: string;
    chartSoft: string;
    watermark: string;
  }
> = {
  sky: {
    lightBg: "from-[#e8f3ff] via-white to-white",
    darkBg: "from-[#0c1a2a] via-[#121212] to-[#121212]",
    iconWrap: "bg-[#dbeafe]",
    iconWrapDark: "bg-sky-500/15",
    icon: "text-[#2563eb]",
    iconDark: "text-sky-300",
    chart: "#3b82f6",
    chartSoft: "rgba(59,130,246,0.22)",
    watermark: "text-sky-500/10 dark:text-sky-300/10",
  },
  emerald: {
    lightBg: "from-[#e9f8ef] via-white to-white",
    darkBg: "from-[#0d2118] via-[#121212] to-[#121212]",
    iconWrap: "bg-[#d1fae5]",
    iconWrapDark: "bg-emerald-500/15",
    icon: "text-[#059669]",
    iconDark: "text-emerald-300",
    chart: "#10b981",
    chartSoft: "rgba(16,185,129,0.22)",
    watermark: "text-emerald-500/10 dark:text-emerald-300/10",
  },
  amber: {
    lightBg: "from-[#fff6e8] via-white to-white",
    darkBg: "from-[#24180a] via-[#121212] to-[#121212]",
    iconWrap: "bg-[#ffedd5]",
    iconWrapDark: "bg-amber-500/15",
    icon: "text-[#d97706]",
    iconDark: "text-amber-300",
    chart: "#f59e0b",
    chartSoft: "rgba(245,158,11,0.22)",
    watermark: "text-amber-500/10 dark:text-amber-300/10",
  },
  violet: {
    lightBg: "from-[#f3edff] via-white to-white",
    darkBg: "from-[#1a1028] via-[#121212] to-[#121212]",
    iconWrap: "bg-[#ede9fe]",
    iconWrapDark: "bg-[#7c3aed]/20",
    icon: "text-[#7c3aed]",
    iconDark: "text-purple-300",
    chart: "#7c3aed",
    chartSoft: "rgba(124,58,237,0.22)",
    watermark: "text-[#7c3aed]/10 dark:text-purple-300/10",
  },
};

function Sparkline({ color, soft }: { color: string; soft: string }) {
  return (
    <svg viewBox="0 0 160 36" className="h-9 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`dash-spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={soft} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M0 28 C18 26, 28 12, 42 16 S68 30, 82 18 S112 6, 128 14 S148 28, 160 20 L160 36 L0 36 Z"
        fill={`url(#dash-spark-${color.replace("#", "")})`}
      />
      <path
        d="M0 28 C18 26, 28 12, 42 16 S68 30, 82 18 S112 6, 128 14 S148 28, 160 20"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DashboardStatCard({
  tone,
  icon: Icon,
  label,
  value,
  secondary,
  description,
  badge = "All time",
  footerAction,
  footerMeta,
  visual = "none",
  progress = 0,
  isDark = false,
  className,
}: DashboardStatCardProps) {
  const t = TONES[tone];
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <article
      className={cn(
        "relative flex min-h-[210px] flex-col overflow-hidden rounded-2xl border bg-gradient-to-b shadow-[0_8px_28px_-18px_rgba(26,26,26,0.35)]",
        isDark ? cn("border-white/10", t.darkBg) : cn("border-[#ececef]", t.lightBg),
        className,
      )}
    >
      <Icon
        className={cn(
          "pointer-events-none absolute -right-3 top-8 h-28 w-28 stroke-[1.25]",
          t.watermark,
        )}
        aria-hidden="true"
      />

      <div className="relative z-[1] flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-xl",
              isDark ? t.iconWrapDark : t.iconWrap,
            )}
          >
            <Icon className={cn("h-5 w-5", isDark ? t.iconDark : t.icon)} aria-hidden="true" />
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium",
              isDark ? "bg-white/10 text-white/70" : "bg-[#f3f3f5] text-[#6d6d75]",
            )}
          >
            <CalendarDays className="h-3 w-3" aria-hidden="true" />
            {badge}
          </span>
        </div>

        <div className="mt-4 space-y-1">
          <div
            className={cn(
              secondary && "grid grid-cols-2 gap-4",
            )}
          >
            <div className="min-w-0 space-y-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-white/70" : "text-[#6d6d75]",
                )}
              >
                {label}
              </p>
              <p
                className={cn(
                  "truncate text-[28px] font-bold leading-none tracking-tight tabular-nums",
                  isDark ? "text-white" : "text-[#1a1a1a]",
                )}
              >
                {value}
              </p>
            </div>
            {secondary ? (
              <div
                className={cn(
                  "min-w-0 space-y-1 border-l pl-4",
                  isDark ? "border-white/10" : "border-[#ececef]",
                )}
              >
                <p
                  className={cn(
                    "text-sm font-medium",
                    isDark ? "text-white/70" : "text-[#6d6d75]",
                  )}
                >
                  {secondary.label}
                </p>
                <p
                  className={cn(
                    "truncate text-[28px] font-bold leading-none tracking-tight tabular-nums",
                    isDark ? "text-white/80" : "text-[#55555E]",
                  )}
                >
                  {secondary.value}
                </p>
              </div>
            ) : null}
          </div>
          {description ? (
            <p className={cn("text-sm", isDark ? "text-white/55" : "text-[#8d8d95]")}>
              {description}
            </p>
          ) : null}
        </div>

        <div className="mt-auto pt-4">
          {visual === "sparkline" && <Sparkline color={t.chart} soft={t.chartSoft} />}
          {visual === "progress" && (
            <div
              className={cn(
                "h-2 w-full overflow-hidden rounded-full",
                isDark ? "bg-white/10" : "bg-[#ececef]",
              )}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${clamped}%`, backgroundColor: t.chart }}
              />
            </div>
          )}
          {visual === "line" && (
            <div className="h-1 w-full rounded-full" style={{ backgroundColor: t.chart }} />
          )}
        </div>
      </div>

      {(footerAction || footerMeta) && (
        <div
          className={cn(
            "relative z-[1] flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5",
            isDark ? "border-white/10" : "border-[#ececef]",
          )}
        >
          {footerAction ? (
            <Link
              href={footerAction.href}
              className={cn(
                "text-sm font-medium transition-colors",
                isDark
                  ? "text-white/75 hover:text-white"
                  : "text-[#55555E] hover:text-[#1a1a1a]",
              )}
            >
              {footerAction.label}
            </Link>
          ) : (
            <span />
          )}
          {footerMeta && (
            <span className={cn("text-xs", isDark ? "text-white/45" : "text-[#8d8d95]")}>
              {footerMeta}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
