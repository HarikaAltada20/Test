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
  light: "border-[#e5e5e5] bg-[#f5f5f5] text-[#404040]",
  dark: "border-white/15 bg-white/10 text-neutral-200",
  auto: "border-[#e5e5e5] bg-[#f5f5f5] text-[#404040] dark:border-white/15 dark:bg-white/10 dark:text-neutral-200",
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
