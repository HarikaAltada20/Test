"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  isHighestPlatformPayoutOnly,
  type HighestPlatformContest,
} from "@/lib/highest-platform-payout";
import { cn } from "@/lib/utils";
import {
  VIDEO_PLATFORM_LABELS,
  parseVideoContestPlatforms,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";
import { Crown, Info } from "lucide-react";

export const HIGHEST_PLATFORM_BADGE_TEXT = "Best platform paid";

/** Class strings are literal so Tailwind keeps them; `auto` follows the page theme. */
function themeClass(
  isDark: boolean | undefined,
  classes: { light: string; dark: string; auto: string },
): string {
  if (isDark === true) return classes.dark;
  if (isDark === false) return classes.light;
  return classes.auto;
}

const NOTE_CLASSES = {
  light: "border-[#e5e5e5] bg-[#fafafa] text-[#404040]",
  dark: "border-white/10 bg-white/[0.04] text-neutral-200",
  auto: "border-[#e5e5e5] bg-[#fafafa] text-[#404040] dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-200",
};

const BADGE_CLASSES = {
  light: "bg-[#f5f5f5] text-[#404040] border-[#e5e5e5]",
  dark: "bg-white/10 text-neutral-200 border-white/15",
  auto: "bg-[#f5f5f5] text-[#404040] border-[#e5e5e5] dark:bg-white/10 dark:text-neutral-200 dark:border-white/15",
};

const CHIP_CLASSES = {
  light: "border-[#e5e5e5] bg-[#fafafa] text-[#737373]",
  dark: "border-white/10 bg-white/5 text-slate-300",
  auto: "border-[#e5e5e5] bg-[#fafafa] text-[#737373] dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
};

export function highestPlatformNoteText(
  platforms: VideoContestPlatform[],
  audience: "creator" | "brand",
): { title: string; body: string } {
  const tieBreak = platforms[0]
    ? ` Ties go to ${VIDEO_PLATFORM_LABELS[platforms[0]]}.`
    : "";
  if (audience === "brand") {
    return {
      title: "Creators are paid for their best platform only",
      body: `A creator who posts on more than one platform is paid only for the platform that earns them the most (bonuses included). Their other platforms count $0 and stay in your budget.${tieBreak} The leading platform can change until views are locked for payout.`,
    };
  }
  return {
    title: "Paid for your best platform only",
    body: `If you post on more than one platform, you're paid only for the platform that earns you the most (bonuses included). Your other platforms count $0.${tieBreak} Your leading platform can change until views are locked for payout.`,
  };
}

/** Info note shown wherever campaign earnings are explained. */
export function HighestPlatformPayoutNote({
  contest,
  audience = "creator",
  isDark,
  className,
  compact = false,
}: {
  contest: HighestPlatformContest | null | undefined;
  audience?: "creator" | "brand";
  isDark?: boolean;
  className?: string;
  compact?: boolean;
}) {
  if (!isHighestPlatformPayoutOnly(contest)) return null;
  const { title, body } = highestPlatformNoteText(
    parseVideoContestPlatforms(contest?.platform),
    audience,
  );
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border",
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
        themeClass(isDark, NOTE_CLASSES),
        className,
      )}
      role="note"
    >
      <Crown className={cn("mt-0.5 shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      <div className="min-w-0">
        <p
          className={cn(
            "font-semibold",
            themeClass(isDark, {
              light: "text-[#0a0a0a]",
              dark: "text-white",
              auto: "text-[#0a0a0a] dark:text-white",
            }),
          )}
        >
          {title}
        </p>
        <p className={cn("mt-0.5", compact ? "" : "leading-relaxed")}>{body}</p>
      </div>
    </div>
  );
}

/** "Best platform paid" badge for campaign cards and headers. */
export function HighestPlatformBadge({
  contest,
  isDark,
  size = "compact",
  className,
}: {
  contest: HighestPlatformContest | null | undefined;
  isDark?: boolean;
  size?: "compact" | "default";
  className?: string;
}) {
  if (!isHighestPlatformPayoutOnly(contest)) return null;
  const { body } = highestPlatformNoteText(
    parseVideoContestPlatforms(contest?.platform),
    "creator",
  );
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              size === "compact" ? "text-[12px]" : "text-sm px-3 py-1 font-medium",
              themeClass(isDark, BADGE_CLASSES),
              className,
            )}
          >
            <Crown className="h-3 w-3 mr-1 shrink-0" />
            {HIGHEST_PLATFORM_BADGE_TEXT}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{body}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Neutral chip for a submission that does not count (never red). */
export function NotCountedChip({
  label,
  detail,
  isDark,
  className,
}: {
  label: string;
  detail?: string;
  isDark?: boolean;
  className?: string;
}) {
  const chip = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        themeClass(isDark, CHIP_CLASSES),
        className,
      )}
    >
      <Info className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
  if (!detail) return chip;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{detail}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
