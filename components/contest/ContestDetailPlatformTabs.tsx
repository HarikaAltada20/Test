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
  /** When true, tab clicks are ignored (e.g. refresh metrics in progress). */
  disabled?: boolean;
  /** Neutral (Figma brand redesign) pill look: grey segmented group, solid black active pill. */
  neutral?: boolean;
};

export function ContestDetailPlatformTabs({
  platforms,
  active,
  onChange,
  isDark = false,
  fullWidth = false,
  counts,
  disabled = false,
  neutral = false,
}: ContestDetailPlatformTabsProps) {
  if (platforms.length < 2) return null;

  const tabs: PlatformTabValue[] = [ALL_PLATFORM_TAB, ...platforms];

  if (fullWidth && neutral) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-1 w-full rounded-xl p-1",
          isDark ? "bg-white/5" : "bg-[#f5f5f5]",
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab === active;
          const label =
            tab === ALL_PLATFORM_TAB ? "All" : VIDEO_PLATFORM_LABELS[tab];
          const count = counts?.[tab];
          return (
            <button
              key={tab}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onChange(tab);
              }}
              className={cn(
                "flex-1 min-w-[7.5rem] h-9 inline-flex items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors whitespace-nowrap",
                isActive
                  ? isDark
                    ? "bg-white text-[#0a0a0a]"
                    : "bg-[#0a0a0a] text-white"
                  : isDark
                    ? "text-slate-300 hover:text-white"
                    : "text-[#404040] hover:text-[#0a0a0a]",
                disabled && "opacity-60 cursor-not-allowed",
              )}
              title={
                disabled
                  ? "Platform tabs are locked while metrics refresh is running"
                  : undefined
              }
            >
              <div className="flex items-center gap-1.5">
                {tab === ALL_PLATFORM_TAB ? (
                  <Users className="h-4 w-4 shrink-0" />
                ) : (
                  <span className="shrink-0 inline-flex [&_svg]:text-current">
                    {getPlatformIcon(tab, "sm", "currentColor")}
                  </span>
                )}
                <span>{label}</span>
              </div>
              {typeof count === "number" ? (
                <span
                  className={cn(
                    "text-[13px] font-normal tabular-nums",
                    isActive
                      ? isDark
                        ? "text-[#0a0a0a]/60"
                        : "text-white/70"
                      : isDark
                        ? "text-slate-400"
                        : "text-[#737373]",
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

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
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onChange(tab);
              }}
              className={cn(
                "h-9 px-3 rounded-lg text-sm font-medium border transition-colors inline-flex items-center gap-2",
                isActive
                  ? "bg-[#7F39EC] text-white border-[#7F39EC]"
                  : isDark
                    ? "bg-transparent border-gray-600 text-white hover:bg-[#D9C0FF26]"
                    : "bg-white border-gray-300 text-foreground hover:bg-gray-50",
                disabled && "opacity-60 cursor-not-allowed hover:bg-transparent",
              )}
              title={
                disabled
                  ? "Platform tabs are locked while metrics refresh is running"
                  : undefined
              }
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
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onChange(tab);
            }}
            className={cn(
              "flex-1 min-w-[7.5rem] min-h-12 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-medium border transition-colors whitespace-nowrap",
              isActive
                ? "bg-[#7F39EC] text-white border-[#7F39EC] shadow-sm"
                : isDark
                  ? "bg-transparent text-white border-gray-400 hover:bg-[#D9C0FF26]"
                  : "bg-white text-[#7F39EC] border-[#7F39EC] hover:bg-purple-50",
              disabled && "opacity-60 cursor-not-allowed",
            )}
            title={
              disabled
                ? "Platform tabs are locked while metrics refresh is running"
                : undefined
            }
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
