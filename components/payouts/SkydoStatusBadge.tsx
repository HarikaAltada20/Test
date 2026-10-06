import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SKYDO_STATUS_BADGE_CLASSES,
  SKYDO_STATUS_DESCRIPTIONS,
  SKYDO_STATUS_LABELS,
} from "@/lib/skydo-payout";
import type { SkydoStatus } from "@/types/earnings";

const DOT_CLASSES: Record<SkydoStatus, string> = {
  email_pending: "bg-amber-500",
  email_sent: "bg-blue-500",
  verified: "bg-emerald-500",
};

export function SkydoStatusBadge({
  status,
  showDescription = false,
  size = "md",
  label,
  className,
}: {
  status: SkydoStatus;
  showDescription?: boolean;
  size?: "sm" | "md";
  /** Overrides the default label, e.g. a shorter "Verified" in tables. */
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-col gap-0.5", className)}>
      <Badge
        variant="outline"
        className={cn(
          "w-fit gap-1.5 whitespace-nowrap font-medium",
          size === "sm" ? "px-2 py-0 text-[11px]" : "text-xs",
          SKYDO_STATUS_BADGE_CLASSES[status]
        )}
      >
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[status])}
        />
        {label ?? SKYDO_STATUS_LABELS[status]}
      </Badge>
      {showDescription && (
        <span className="text-xs opacity-80">{SKYDO_STATUS_DESCRIPTIONS[status]}</span>
      )}
    </span>
  );
}
