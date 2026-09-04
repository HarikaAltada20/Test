"use client";

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
};

export function ContestDetailPlatformTabs({
  platforms,
  active,
  onChange,
  isDark = false,
}: ContestDetailPlatformTabsProps) {
  if (platforms.length < 2) return null;

  const tabs: PlatformTabValue[] = [ALL_PLATFORM_TAB, ...platforms];

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
