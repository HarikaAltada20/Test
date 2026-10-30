"use client";

import { Instagram, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
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

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15z" />
    </svg>
  );
}

function PlatformIcon({
  platform,
  className,
}: {
  platform: VideoContestPlatform;
  className?: string;
}) {
  if (platform === "youtube") return <Youtube className={className} />;
  if (platform === "instagram") return <Instagram className={className} />;
  return <TikTokIcon className={className} />;
}

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

  const setScope = (nextScope: PlatformScope) => {
    if (nextScope === "all") {
      if (active !== ALL_PLATFORM_TAB) onChange(ALL_PLATFORM_TAB);
      return;
    }
    if (active === ALL_PLATFORM_TAB) {
      onChange(platforms[0]);
    }
  };

  const pillBase =
    "rounded-full px-3 py-1.5 text-sm font-medium transition-colors inline-flex items-center gap-1.5";
  const pillActive = isDark
    ? "border border-white/30 bg-white/15 text-white"
    : "border border-[#1a1a1a] bg-white text-[#1a1a1a]";
  const pillIdle = isDark
    ? "border border-transparent text-gray-400 hover:text-gray-200"
    : "border border-transparent text-[#6d6d75] hover:text-[#1a1a1a]";

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "inline-flex flex-wrap items-center gap-2 rounded-full border p-1 w-fit",
          isDark ? "border-white/15 bg-white/5" : "border-[#e6e6ea] bg-white",
        )}
      >
        <div
          role="tablist"
          aria-label="Platform content scope"
          className={cn(
            "inline-flex rounded-full p-0.5",
            isDark ? "bg-white/10" : "bg-[#f3f3f5]",
          )}
        >
          <button
            type="button"
            role="tab"
            aria-selected={scope === "all"}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setScope("all");
            }}
            className={cn(pillBase, scope === "all" ? pillActive : pillIdle)}
          >
            Same for all
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "platforms"}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setScope("platforms");
            }}
            className={cn(pillBase, scope === "platforms" ? pillActive : pillIdle)}
          >
            Per platform
          </button>
        </div>

        {scope === "platforms" && (
          <div
            role="tablist"
            aria-label="Selected platforms"
            className={cn(
              "inline-flex flex-wrap items-center gap-0.5 rounded-full p-0.5",
              isDark ? "bg-white/10" : "bg-[#f3f3f5]",
            )}
          >
            {platforms.map((platform) => {
              const isActive = platform === active;
              const isComplete = completeByTab?.[platform];
              return (
                <button
                  key={platform}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onChange(platform);
                  }}
                  className={cn(pillBase, isActive ? pillActive : pillIdle)}
                >
                  <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
                  {VIDEO_PLATFORM_LABELS[platform]}
                  {typeof isComplete === "boolean" && (
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        isComplete ? "bg-emerald-500" : "bg-[#b08a5a]",
                      )}
                      aria-label={isComplete ? "Filled" : "Needs content"}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
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
