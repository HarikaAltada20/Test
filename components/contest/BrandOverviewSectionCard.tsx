"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BrandOverviewSectionCardProps = {
  isDark?: boolean;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
};

/**
 * Figma "Contest Details Redesign" section card chrome for brand Overview.
 * Visual only — does not change section content or behavior.
 */
export function BrandOverviewSectionCard({
  isDark = false,
  title,
  subtitle,
  icon,
  badge,
  children,
  className,
  bodyClassName,
  headerClassName,
}: BrandOverviewSectionCardProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border shadow-[0px_1px_3px_0px_rgba(10,10,10,0.04)]",
        isDark ? "border-white/10 bg-[#111113]" : "border-[#e5e5e5] bg-white",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b px-5 py-4",
          isDark ? "border-white/10" : "border-[#e5e5e5]",
          headerClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          {icon ? (
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
                isDark ? "bg-white/10 text-white" : "bg-[#fafafa] text-[#0a0a0a]",
              )}
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <h3
              className={cn(
                "text-[15px] font-semibold leading-tight",
                isDark ? "text-white" : "text-[#0a0a0a]",
              )}
            >
              {title}
            </h3>
            {subtitle ? (
              <p
                className={cn(
                  "text-sm leading-tight",
                  isDark ? "text-slate-400" : "text-[#737373]",
                )}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      <div className={cn("px-5 py-5", bodyClassName)}>{children}</div>
    </section>
  );
}
