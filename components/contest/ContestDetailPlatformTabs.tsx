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
  /** Match status/eligibility strip: equal-width full row with purple borders. */
  fullWidth?: boolean;
  /** Optional count badges (keyed by tab value, including `"all"`). */
  counts?: Partial<Record<PlatformTabValue, number>>;
  /** When true, tab clicks are ignored (e.g. refresh metrics in progress). */
  disabled?: boolean;
  /** Compact pills that sit in a heading row instead of stretching full width. */
  compact?: boolean;
  /** Neutral (Figma brand redesign) pill look: grey segmented group, solid black active pill. */
  neutral?: boolean;
};

const FILTER_ICON = "/images/contest-details/filters";

const PLATFORM_FILTER_ICONS: Partial<Record<VideoContestPlatform, string>> = {
  youtube: `${FILTER_ICON}/youtube.svg`,
  instagram: `${FILTER_ICON}/instagram.svg`,
  tiktok: `${FILTER_ICON}/tiktok.svg`,
};

export function ContestDetailPlatformTabs({
  platforms,
  active,
  onChange,
  isDark = false,
  fullWidth = false,
  counts,
  disabled = false,
  compact = false,
  neutral = false,
}: ContestDetailPlatformTabsProps) {
  if (platforms.length < 2) return null;

  const tabs: PlatformTabValue[] = [ALL_PLATFORM_TAB, ...platforms];

  if (neutral) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "text-xs font-medium",
            isDark ? "text-slate-400" : "text-[#737373]",
          )}
        >
          Platform
        </span>
        {tabs.map((tab) => {
          const isActive = tab === active;
          const label =
            tab === ALL_PLATFORM_TAB
              ? "All platforms"
              : VIDEO_PLATFORM_LABELS[tab];
          const count = counts?.[tab];
          const icon =
            tab === ALL_PLATFORM_TAB ? null : PLATFORM_FILTER_ICONS[tab];
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
                "inline-flex shrink-0 items-center gap-[7px] rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors",
                isActive
                  ? isDark
                    ? "bg-white font-semibold text-[#0a0a0a]"
                    : "bg-[#0a0a0a] font-semibold text-white"
                  : isDark
                    ? "border border-white/10 bg-transparent font-semibold text-slate-200"
                    : "border border-[#e5e5e5] bg-white font-semibold text-[#404040]",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              {icon ? (
                <img src={icon} alt="" className="shrink-0" />
              ) : null}
              <span>{label}</span>
              {typeof count === "number" ? (
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    isActive
                      ? isDark
                        ? "text-[#0a0a0a]/60"
                        : "text-white/60"
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

  const stretch = fullWidth || !compact;

  return (
    <div
      className={cn(
        "items-center rounded-xl p-1",
        neutral ? "gap-1" : "gap-0.5",
        stretch
          ? "flex w-full flex-nowrap"
          : "inline-flex w-max max-w-full flex-wrap",
        isDark ? "bg-white/[0.06]" : "bg-[#f5f5f5]",
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
              "inline-flex items-center justify-center whitespace-nowrap transition-colors",
              stretch
                ? "h-9 min-w-0 flex-1 gap-1.5 rounded-lg px-3 text-[13px]"
                : "min-w-[88px] shrink-0 gap-1.5 rounded-[9px] px-3 py-1.5 text-sm",
              neutral
                ? isActive
                  ? isDark
                    ? "bg-white font-medium text-[#0a0a0a]"
                    : "bg-[#0a0a0a] font-medium text-white"
                  : isDark
                    ? "font-medium text-slate-300 hover:text-white"
                    : "font-medium text-[#404040] hover:text-[#0a0a0a]"
                : isActive
                  ? isDark
                    ? "bg-white/10 font-semibold text-white shadow-[0px_1px_6px_0px_rgba(10,10,10,0.1)]"
                    : "bg-white font-semibold text-[#0a0a0a] shadow-[0px_1px_6px_0px_rgba(10,10,10,0.1)]"
                  : isDark
                    ? "font-medium text-slate-400 hover:text-white"
                    : "font-medium text-[#737373] hover:text-[#0a0a0a]",
              disabled && "cursor-not-allowed opacity-60",
            )}
            title={
              disabled
                ? "Platform tabs are locked while metrics refresh is running"
                : undefined
            }
          >
            {tab !== ALL_PLATFORM_TAB ? (
              <span className="inline-flex shrink-0 [&_svg]:h-3.5 [&_svg]:w-3.5">
                {getPlatformIcon(
                  tab,
                  "sm",
                  neutral && isActive ? "currentColor" : undefined,
                )}
              </span>
            ) : null}
            <span>{label}</span>
            {neutral && typeof count === "number" ? (
              <span
                className={cn(
                  "font-normal tabular-nums",
                  isActive
                    ? isDark
                      ? "text-[#0a0a0a]/60"
                      : "text-white/70"
                    : isDark
                      ? "text-slate-400"
                      : "text-[#737373]",
                )}
              >
                ({count})
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
