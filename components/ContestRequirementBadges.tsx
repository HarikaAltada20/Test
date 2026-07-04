"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  buildRequirementBadgeItems,
  buildRequirementChecklist,
  parseContestCreatorRequirements,
  type ContestCreatorRequirements,
  type CreatorRequirementsSnapshot,
} from "@/lib/creator-requirements";
import {
  Award,
  DollarSign,
  Eye,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";

const BADGE_ICONS: Record<string, LucideIcon> = {
  "trust-pct": ShieldCheck,
  "trust-number": Award,
  "best-quality": Star,
  "avg-quality": Star,
  "platform-earnings": DollarSign,
  "platform-views": Eye,
};

type ContestRequirementBadgesProps = {
  contest: ContestCreatorRequirements;
  snapshot?: CreatorRequirementsSnapshot | null;
  isDark?: boolean;
  size?: "compact" | "default";
  showEligibility?: boolean;
};

function getBadgeClassName(
  passed: boolean | null,
  isDark: boolean,
  size: "compact" | "default",
): string {
  const sizeClass =
    size === "compact"
      ? "text-[11px] px-1.5 py-0 font-medium"
      : "text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 font-medium";

  if (passed === true) {
    return cn(
      sizeClass,
      isDark
        ? "bg-emerald-900/30 text-emerald-200 border-emerald-700/50"
        : "bg-emerald-50 text-emerald-800 border-emerald-200",
    );
  }

  if (passed === false) {
    return cn(
      sizeClass,
      isDark
        ? "bg-rose-900/25 text-rose-200 border-rose-700/50"
        : "bg-rose-50 text-rose-800 border-rose-200",
    );
  }

  return cn(
    sizeClass,
    isDark
      ? "bg-teal-900/25 text-teal-200 border-teal-700/50"
      : "bg-teal-50 text-teal-800 border-teal-200",
  );
}

export function ContestRequirementBadges({
  contest,
  snapshot = null,
  isDark = false,
  size = "default",
  showEligibility = false,
}: ContestRequirementBadgesProps) {
  const items = buildRequirementBadgeItems(contest);
  if (items.length === 0) return null;

  const checklist =
    showEligibility && snapshot
      ? buildRequirementChecklist({
          requirements: parseContestCreatorRequirements(contest),
          snapshot,
        })
      : null;

  const iconClass = size === "compact" ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <TooltipProvider delayDuration={200}>
      {items.map((item, index) => {
        const Icon = BADGE_ICONS[item.key] ?? ShieldCheck;
        const checklistItem = checklist?.[index] ?? null;
        const passed = checklistItem ? checklistItem.passed : null;

        const tooltip = checklistItem
          ? `${item.fullLabel} · Yours: ${checklistItem.yoursLabel}`
          : item.fullLabel;

        return (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={getBadgeClassName(passed, isDark, size)}
              >
                <Icon className={cn(iconClass, "mr-0.5 shrink-0")} />
                <span className="whitespace-nowrap">
                  {item.shortLabel} {item.valueLabel}
                </span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </TooltipProvider>
  );
}
