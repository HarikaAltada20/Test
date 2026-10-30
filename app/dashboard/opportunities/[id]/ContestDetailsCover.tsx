"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  Instagram,
  Share2,
  Trophy,
  Users,
  Youtube,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  VIDEO_PLATFORM_LABELS,
  type VideoContestPlatform,
} from "@/lib/video-platform-campaigns";

type ContestDetailsCoverProps = {
  isDark?: boolean;
  title: string;
  thumbnailUrl?: string | null;
  status: string;
  contestType?: string | null;
  contestTypeLabel: string;
  dateRangeLabel: string;
  durationLabel: string;
  durationSubLabel: string;
  budgetLabel: string;
  budgetValue: string;
  budgetSubLabel?: string | null;
  platformLabel: string;
  platformSubLabel?: string | null;
  platforms: VideoContestPlatform[];
  submissionsLabel: string;
  submissionsValue: string | number;
  submissionsSubLabel: string;
  statusChip?: ReactNode;
  extraBadges?: ReactNode;
  cta: ReactNode;
};

function PlatformIcon({
  platform,
  className,
}: {
  platform: VideoContestPlatform | string;
  className?: string;
}) {
  if (platform === "youtube") return <Youtube className={className} />;
  if (platform === "instagram") return <Instagram className={className} />;
  if (platform === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.18z" />
      </svg>
    );
  }
  return <Share2 className={className} />;
}

function ContestTypeIcon({ contestType }: { contestType?: string | null }) {
  if (contestType === "dual_rewards" || contestType === "cpm") {
    return <Zap className="h-[13px] w-[13px] text-[#f97316]" />;
  }
  return <Trophy className="h-[13px] w-[13px] text-[#0a0a0a]" />;
}

export function ContestDetailsCover({
  isDark,
  title,
  thumbnailUrl,
  status,
  contestType,
  contestTypeLabel,
  dateRangeLabel,
  durationLabel,
  durationSubLabel,
  budgetLabel,
  budgetValue,
  budgetSubLabel,
  platformLabel,
  platformSubLabel,
  platforms,
  submissionsLabel,
  submissionsValue,
  submissionsSubLabel,
  statusChip,
  extraBadges,
  cta,
}: ContestDetailsCoverProps) {
  const statusUpper = status?.toUpperCase?.() || status;
  const isLive = status?.toLowerCase() === "active";
  const isUpcoming = status?.toLowerCase() === "upcoming";
  const primaryPlatform = platforms[0];
  const isMultiPlatform = platforms.length > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className={cn(
        "mb-6 overflow-hidden rounded-[20px] border shadow-[0px_2px_12px_0px_rgba(10,10,10,0.04)]",
        isDark
          ? "border-white/10 bg-[#161616]"
          : "border-[#ececef] bg-white",
      )}
    >
      {thumbnailUrl ? (
        <div className="relative w-full">
          <img
            src={thumbnailUrl}
            alt={`${title} thumbnail`}
            className="block h-auto w-full object-contain"
          />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2 sm:left-5 sm:top-5">
            <div className="flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-[6px]">
              {primaryPlatform ? (
                <PlatformIcon platform={primaryPlatform} className="h-3.5 w-3.5" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              <span>{platformLabel}</span>
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-[6px]",
                isLive
                  ? "bg-emerald-600 text-white"
                  : isUpcoming
                    ? "bg-sky-600 text-white"
                    : "bg-white/90 text-[#0a0a0a]",
              )}
            >
              {isLive ? (
                <span className="h-2 w-2 rounded-full bg-white" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
              <span>{isLive ? "LIVE NOW" : statusUpper}</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-6 px-5 py-6 sm:flex-row sm:items-start sm:gap-8 sm:px-7 sm:py-6">
        <div className="min-w-0 flex-1 space-y-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                isDark
                  ? "border-slate-600 bg-transparent text-slate-100"
                  : "border-[#e5e5e5] bg-white text-[#0a0a0a]",
              )}
            >
              <ContestTypeIcon contestType={contestType} />
              {contestTypeLabel}
            </div>
            {statusChip}
            {extraBadges}
          </div>

          <h1
            className={cn(
              "text-[26px] font-semibold leading-[1.15] tracking-[-0.6px] sm:text-[30px]",
              isDark ? "text-white" : "text-[#0a0a0a]",
            )}
          >
            {title}
          </h1>

          {dateRangeLabel ? (
            <p
              className={cn(
                "inline-flex items-center gap-2 text-sm font-medium",
                isDark ? "text-slate-300" : "text-[#737373]",
              )}
            >
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{dateRangeLabel}</span>
            </p>
          ) : null}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2.5 sm:w-[268px]">
          <div
            className={cn(
              "rounded-2xl border px-5 py-4",
              isDark
                ? "border-slate-700 bg-[#161616]"
                : "border-[#ececef] bg-[#f6f6f7]",
            )}
          >
            <p
              className={cn(
                "text-xs font-medium",
                isDark ? "text-slate-300" : "text-[#737373]",
              )}
            >
              {budgetLabel}
            </p>
            <p
              className={cn(
                "mt-1 text-[36px] font-bold leading-none tracking-[-1.08px]",
                isDark ? "text-white" : "text-[#0a0a0a]",
              )}
            >
              {budgetValue}
            </p>
            {budgetSubLabel ? (
              <p
                className={cn(
                  "mt-1 text-xs font-medium",
                  isDark ? "text-slate-300" : "text-[#737373]",
                )}
              >
                {budgetSubLabel}
              </p>
            ) : null}
          </div>
          {cta}
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-px border-t sm:grid-cols-2",
          isMultiPlatform
            ? "lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
            : "lg:grid-cols-4",
          isDark ? "border-white/10 bg-white/10" : "border-[#ececef] bg-[#ececef]",
        )}
      >
        {[
          {
            key: "platform",
            label: "Platform",
            value: platformLabel,
            sub: platformSubLabel,
            icon: primaryPlatform ? (
              <PlatformIcon platform={primaryPlatform} className="h-6 w-6" />
            ) : (
              <Share2 className="h-6 w-6" />
            ),
          },
          {
            key: "duration",
            label: "Duration",
            value: durationLabel,
            sub: durationSubLabel,
            icon: <Calendar className="h-6 w-6" />,
          },
          {
            key: "budget",
            label: budgetLabel,
            value: budgetValue,
            sub:
              contestType === "dual_rewards"
                ? "CPM + milestones"
                : contestType === "cpm"
                  ? "CPM based"
                  : contestType === "milestone"
                    ? "Milestone based"
                    : contestType === "leaderboard"
                      ? "Total prize"
                      : budgetSubLabel || "Total prize",
            icon: <Trophy className="h-6 w-6" />,
          },
          {
            key: "submissions",
            label: submissionsLabel,
            value: String(submissionsValue),
            sub: submissionsSubLabel,
            icon: <Users className="h-6 w-6" />,
          },
        ].map((kpi) => (
          <div
            key={kpi.key}
            className={cn(
              "flex items-center gap-5 bg-white px-6 py-7 sm:px-8 sm:py-8",
              isDark && "bg-[#161616]",
            )}
          >
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                isDark ? "bg-white/10 text-white" : "bg-[#f3f3f5] text-[#171717]",
              )}
            >
              {kpi.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-slate-300" : "text-[#737373]",
                )}
              >
                {kpi.label}
              </p>
              <p
                className={cn(
                  "mt-1 font-semibold tracking-[-0.3px]",
                  kpi.key === "platform" && isMultiPlatform
                    ? "whitespace-normal break-words text-xl leading-snug"
                    : "truncate text-2xl",
                  isDark ? "text-white" : "text-[#0a0a0a]",
                )}
              >
                {kpi.value}
              </p>
              {kpi.sub ? (
                <p
                  className={cn(
                    "mt-1 truncate text-sm",
                    isDark ? "text-slate-400" : "text-[#737373]",
                  )}
                >
                  {kpi.sub}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function contestTypeDisplayLabel(contestType?: string | null) {
  if (contestType === "cpm") return "Performance Based";
  if (contestType === "dual_rewards") return "Dual Rewards";
  if (contestType === "milestone") return "Milestone Based";
  return "Competition Based";
}

export function platformDisplayLabel(
  platforms: VideoContestPlatform[],
  fallback?: string | null,
) {
  if (platforms.length > 0) {
    return platforms.map((p) => VIDEO_PLATFORM_LABELS[p] || p).join(", ");
  }
  return fallback || "Not specified";
}
