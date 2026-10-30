"use client";

import { NotCountedChip } from "@/components/contest/HighestPlatformPayoutNote";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CreatorSubmissionPayoutTag } from "@/lib/highest-platform-payout-creator";
import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";

const COUNTED_CLASSES = {
  light: "border-amber-200 bg-amber-50 text-amber-800",
  dark: "border-amber-700/50 bg-amber-900/30 text-amber-200",
  auto: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-200",
};

/**
 * Per-submission tag on "best platform paid" campaigns: neutral "Not counted"
 * chip on a losing platform, small "Leading" / "Paid platform" tag on the
 * winning one.
 */
export function HighestPlatformSubmissionTag({
  tag,
  isDark,
  className,
}: {
  tag: CreatorSubmissionPayoutTag | null | undefined;
  isDark?: boolean;
  className?: string;
}) {
  if (!tag) return null;
  if (!tag.counted) {
    return (
      <NotCountedChip
        label={tag.label}
        detail={tag.detail}
        isDark={isDark}
        className={className}
      />
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              isDark === true
                ? COUNTED_CLASSES.dark
                : isDark === false
                  ? COUNTED_CLASSES.light
                  : COUNTED_CLASSES.auto,
              className,
            )}
          >
            <Crown className="h-3 w-3 shrink-0" />
            {tag.label}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{tag.detail}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
