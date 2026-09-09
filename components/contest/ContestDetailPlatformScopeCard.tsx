"use client";

import type { ReactNode } from "react";
import { getPlatformIcon } from "@/lib/platform-icons";
import { cn } from "@/lib/utils";
import {
  VIDEO_PLATFORM_LABELS,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

type ContestDetailPlatformIconsProps = {
  platforms: VideoContestPlatform[];
  className?: string;
  size?: "sm" | "md";
  /** When true, show platform name next to each icon (YouTube, Instagram, …). */
  showLabels?: boolean;
  isDark?: boolean;
};

/** Inline platform icons; optional name labels for card headers. */
export function ContestDetailPlatformIcons({
  platforms,
  className,
  size = "sm",
  showLabels = false,
  isDark = false,
}: ContestDetailPlatformIconsProps) {
  if (platforms.length === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-2 shrink-0 align-middle",
        className,
      )}
    >
      {platforms.map((platform) => (
        <span
          key={platform}
          className={cn(
            "inline-flex items-center gap-1.5",
            showLabels &&
              (isDark
                ? "text-sm font-medium text-slate-200"
                : "text-sm font-medium text-slate-700"),
          )}
          title={VIDEO_PLATFORM_LABELS[platform]}
        >
          {getPlatformIcon(platform, size)}
          {showLabels ? <span>{VIDEO_PLATFORM_LABELS[platform]}</span> : null}
        </span>
      ))}
    </span>
  );
}

type ContestDetailPlatformScopeHeaderProps = {
  platforms: VideoContestPlatform[];
  isDark?: boolean;
  className?: string;
  variant?: "default" | "subtle";
};

export function ContestDetailPlatformScopeHeader({
  platforms,
  isDark = false,
  className,
}: ContestDetailPlatformScopeHeaderProps) {
  if (platforms.length === 0) return null;

  return (
    <ContestDetailPlatformIcons
      platforms={platforms}
      className={className}
      showLabels
      isDark={isDark}
    />
  );
}

type ContestDetailPlatformScopeCardProps = {
  platforms: VideoContestPlatform[];
  isDark?: boolean;
  children: ReactNode;
  className?: string;
  variant?: "default" | "subtle";
};

/**
 * Clear platform-scoped frame for multi-platform All-tab splits.
 * Use only when content differs (or groups differ) across platforms.
 * Single-platform / scoped tabs should not wrap with this component.
 */
export function ContestDetailPlatformScopeCard({
  platforms,
  isDark = false,
  children,
  className,
  variant = "default",
}: ContestDetailPlatformScopeCardProps) {
  if (platforms.length === 0) return <>{children}</>;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border",
        variant === "subtle"
          ? isDark
            ? "border-white/20 bg-black/20"
            : "border-purple-200/80 bg-white/70"
          : isDark
            ? "border-gray-600 bg-[#120528]"
            : "border-gray-300 bg-white",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 border-b px-3 py-2",
          variant === "subtle"
            ? isDark
              ? "border-white/15 bg-white/5"
              : "border-purple-100 bg-purple-50/80"
            : isDark
              ? "border-gray-600 bg-[#1a0a3a]"
              : "border-gray-200 bg-slate-50",
        )}
      >
        <ContestDetailPlatformIcons
          platforms={platforms}
          showLabels
          isDark={isDark}
        />
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

type ContestDetailSharedAcrossPlatformsHintProps = {
  platforms: VideoContestPlatform[];
  isDark?: boolean;
  className?: string;
};

/**
 * Platform icons for multi-platform All tab when content is identical.
 * Place next to the section heading — icons only, no text badge.
 */
export function ContestDetailSharedAcrossPlatformsHint({
  platforms,
  className,
}: ContestDetailSharedAcrossPlatformsHintProps) {
  if (platforms.length < 2) return null;
  return (
    <ContestDetailPlatformIcons platforms={platforms} className={className} />
  );
}
