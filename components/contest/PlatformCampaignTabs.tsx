"use client";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_PLATFORM_TAB,
  VIDEO_PLATFORM_LABELS,
  type PlatformTabValue,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

type PlatformScope = "all" | "platforms";

type PlatformCampaignTabsProps = {
  platforms: VideoContestPlatform[];
  active: PlatformTabValue;
  onChange: (platform: PlatformTabValue) => void;
  isDark?: boolean;
  hint?: string;
  completeByTab?: Partial<Record<PlatformTabValue, boolean>>;
};

export function PlatformCampaignTabs({
  platforms,
  active,
  onChange,
  isDark = false,
  hint,
  completeByTab,
}: PlatformCampaignTabsProps) {
  if (platforms.length < 2) return null;

  const scope: PlatformScope =
    active === ALL_PLATFORM_TAB ? "all" : "platforms";
  const tabs: PlatformTabValue[] =
    scope === "all" ? [ALL_PLATFORM_TAB] : [...platforms];

  const setScope = (nextScope: PlatformScope) => {
    if (nextScope === "all") {
      if (active !== ALL_PLATFORM_TAB) onChange(ALL_PLATFORM_TAB);
      return;
    }
    if (active === ALL_PLATFORM_TAB) {
      onChange(platforms[0]);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={scope}
          onValueChange={(value: PlatformScope) => setScope(value)}
        >
          <SelectTrigger
            isDark={isDark}
            className="h-8 w-[180px] min-w-[180px] px-3 py-1 text-xs rounded-md"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent isDark={isDark}>
            <SelectItem isDark={isDark} value="all">
              All
            </SelectItem>
            <SelectItem isDark={isDark} value="platforms">
              Selected platforms
            </SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => {
            const isActive = tab === active;
            const label =
              tab === ALL_PLATFORM_TAB ? "All" : VIDEO_PLATFORM_LABELS[tab];
            const isComplete = completeByTab?.[tab];
            return (
              <button
                key={tab}
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(tab);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors inline-flex items-center gap-1.5",
                  isActive
                    ? "bg-[#7F39EC] text-white border-[#7F39EC]"
                    : isDark
                      ? "border-gray-600 text-white hover:bg-[#D9C0FF26]"
                      : "border-gray-300 hover:bg-[#D9C0FF26]",
                )}
              >
                {label}
                {typeof isComplete === "boolean" && (
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full",
                      isComplete
                        ? isActive
                          ? "bg-white"
                          : "bg-emerald-500"
                        : isActive
                          ? "bg-white/70"
                          : "bg-amber-500",
                    )}
                    aria-label={isComplete ? "Filled" : "Needs content"}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
      {hint ? (
        <p
          className={cn(
            "text-xs",
            isDark ? "text-gray-300" : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
