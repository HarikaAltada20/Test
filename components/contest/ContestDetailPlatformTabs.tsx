"use client";

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getPlatformIcon } from "@/lib/platform-icons";
import {
  ALL_PLATFORM_TAB,
  VIDEO_PLATFORM_LABELS,
  type PlatformTabValue,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

type ContestDetailPlatformTabsProps = {
  platforms: VideoContestPlatform[];
  active: PlatformTabValue;
  onChange: (platform: PlatformTabValue) => void;
  isDark?: boolean;
  /** Match status/eligibility strip: equal-width full row with purple borders. */
  fullWidth?: boolean;
  /** Optional count badges (keyed by tab value, including `"all"`). */
  counts?: Partial<Record<PlatformTabValue, number>>;
};

export function ContestDetailPlatformTabs({
  platforms,
  active,
  onChange,
  isDark = false,
  fullWidth = false,
  counts,
}: ContestDetailPlatformTabsProps) {
  if (platforms.length < 2) return null;

  const tabs: PlatformTabValue[] = [ALL_PLATFORM_TAB, ...platforms];

  if (!fullWidth) {
    return (
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = tab === active;
          const label =
            tab === ALL_PLATFORM_TAB ? "All" : VIDEO_PLATFORM_LABELS[tab];
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className={cn(
                "h-9 px-3 rounded-lg text-sm font-medium border transition-colors inline-flex items-center gap-2",
                isActive
                  ? "bg-[#7F39EC] text-white border-[#7F39EC]"
                  : isDark
                    ? "bg-transparent border-gray-600 text-white hover:bg-[#D9C0FF26]"
                    : "bg-white border-gray-300 text-foreground hover:bg-gray-50",
              )}
            >
              {tab !== ALL_PLATFORM_TAB ? getPlatformIcon(tab, "sm") : null}
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 w-full">
      {tabs.map((tab) => {
        const isActive = tab === active;
        const label =
          tab === ALL_PLATFORM_TAB ? "All" : VIDEO_PLATFORM_LABELS[tab];
        const count = counts?.[tab];
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={cn(
              "flex-1 min-w-[7.5rem] min-h-12 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-medium border transition-colors whitespace-nowrap",
              isActive
                ? "bg-[#7F39EC] text-white border-[#7F39EC] shadow-sm"
                : isDark
                  ? "bg-transparent text-white border-gray-400 hover:bg-[#D9C0FF26]"
                  : "bg-white text-[#7F39EC] border-[#7F39EC] hover:bg-purple-50",
            )}
          >
            <div className="flex items-center gap-1.5">
              {tab === ALL_PLATFORM_TAB ? (
                <Users className="h-4 w-4 shrink-0" />
              ) : (
                <span className="shrink-0 inline-flex [&_svg]:text-current">
                  {getPlatformIcon(tab, "sm", "currentColor")}
                </span>
              )}
              <span className="text-[13px] font-medium">{label}</span>
            </div>
            {typeof count === "number" ? (
              <Badge
                variant="secondary"
                className={cn(
                  "px-1.5 py-0.5 text-xs h-5",
                  isDark
                    ? "text-white bg-[#FFFFFF36]"
                    : "text-[#7F39EC] bg-purple-200",
                )}
              >
                {count}
              </Badge>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
