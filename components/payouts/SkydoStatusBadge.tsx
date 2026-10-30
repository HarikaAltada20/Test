"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getSkydoStatusBadgeClasses,
  SKYDO_STATUS_DESCRIPTIONS,
  SKYDO_STATUS_LABELS,
} from "@/lib/skydo-payout";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import type { SkydoStatus } from "@/types/earnings";

const DOT_CLASSES: Record<SkydoStatus, string> = {
  email_pending: "bg-amber-500",
  email_sent: "bg-blue-500",
  verified: "bg-white",
};

const DOT_CLASSES_DARK: Record<SkydoStatus, string> = {
  email_pending: "bg-amber-400",
  email_sent: "bg-blue-400",
  verified: "bg-emerald-300",
};

export function SkydoStatusBadge({
  status,
  showDescription = false,
  size = "md",
  label,
  className,
  isDark: isDarkProp,
}: {
  status: SkydoStatus;
  showDescription?: boolean;
  size?: "sm" | "md";
  /** Overrides the default label, e.g. a shorter "Verified" in tables. */
  label?: string;
  className?: string;
  /** When omitted, follows the dashboard theme. */
  isDark?: boolean;
}) {
  const dashboardDark = useDashboardDark();
  const isDark = isDarkProp ?? dashboardDark;

  return (
    <span className={cn("inline-flex flex-col gap-0.5", className)}>
      <Badge
        variant="outline"
        className={cn(
          "w-fit gap-1.5 whitespace-nowrap border font-medium",
          size === "sm" ? "px-2 py-0 text-[11px]" : "text-xs",
          getSkydoStatusBadgeClasses(status, isDark)
        )}
      >
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            isDark ? DOT_CLASSES_DARK[status] : DOT_CLASSES[status]
          )}
        />
        {label ?? SKYDO_STATUS_LABELS[status]}
      </Badge>
      {showDescription && (
        <span
          className={cn(
            "text-xs",
            isDark ? "text-white/55" : "text-neutral-600"
          )}
        >
          {SKYDO_STATUS_DESCRIPTIONS[status]}
        </span>
      )}
    </span>
  );
}
