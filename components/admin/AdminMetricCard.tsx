"use client";

import type { ComponentType, ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function adminPanelClass(isDark: boolean) {
  return cn(
    "rounded-2xl border shadow-none",
    isDark
      ? "border-white/10 bg-[#161616] text-white"
      : "border-[#ececef] bg-white text-[#1a1a1a]",
  );
}

export function adminHeadingClass(isDark: boolean) {
  return isDark ? "text-white" : "text-[#1a1a1a]";
}

export function adminMutedClass(isDark: boolean) {
  return isDark ? "text-white/55" : "text-[#6d6d75]";
}

export function adminPopoverClass(isDark: boolean) {
  return isDark ? "border-white/10 bg-[#161616] text-white" : "";
}

export function adminSegmentClass(isDark: boolean) {
  return cn(
    "inline-flex overflow-hidden rounded-full border p-0.5",
    isDark ? "border-white/10 bg-[#161616]" : "border-[#e6e6e8] bg-white",
  );
}

export function adminSegmentItemClass(active: boolean, isDark: boolean) {
  return cn(
    "rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
    active
      ? isDark
        ? "bg-white text-[#1a1a1a]"
        : "bg-[#1a1a1a] text-white"
      : isDark
        ? "text-white/70 hover:text-white"
        : "text-[#6d6d75] hover:text-[#1a1a1a]",
  );
}

export function adminOutlineButtonClass(isDark: boolean) {
  return cn(
    "h-10 rounded-full px-4",
    isDark
      ? "border-white/15 bg-transparent text-white hover:bg-white/10"
      : "border-[#d5d5db] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7]",
  );
}

type AdminMetricCardProps = {
  title: string;
  value: number | string;
  subtitle: string;
  tooltip?: string;
  icon: ComponentType<{ className?: string }>;
  isDark: boolean | null;
};

export function AdminMetricCard({
  title,
  value,
  subtitle,
  tooltip,
  icon: Icon,
  isDark,
}: AdminMetricCardProps) {
  const dark = Boolean(isDark);
  const display = typeof value === "number" ? value.toLocaleString() : value;

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 shadow-none sm:p-5",
        dark ? "border-white/10 bg-[#161616]" : "border-[#ececef] bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p
              className={cn(
                "text-sm font-medium",
                dark ? "text-white/60" : "text-[#737373]",
              )}
            >
              {title}
            </p>
            {tooltip ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 cursor-help",
                        dark
                          ? "text-white/40 hover:text-white/70"
                          : "text-[#737373] hover:text-[#171717]",
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
          <p
            className={cn(
              "mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums",
              dark ? "text-white" : "text-[#171717]",
            )}
          >
            {display}
          </p>
          <p className={cn("mt-2 text-sm", dark ? "text-white/55" : "text-[#737373]")}>
            {subtitle}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            dark ? "bg-white/10 text-white" : "bg-[#f3f3f5] text-[#171717]",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  );
}

export function AdminSectionTitle({
  children,
  isDark,
  className,
}: {
  children: ReactNode;
  isDark: boolean;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-xl font-semibold tracking-tight",
        adminHeadingClass(isDark),
        className,
      )}
    >
      {children}
    </h2>
  );
}
