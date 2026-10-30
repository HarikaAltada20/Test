"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Square,
  SquareCheck,
  Loader2,
  Lock,
  PenLine,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PREDEFINED_REASONS } from "@/components/RejectionReasonModal";
import { cn } from "@/lib/utils";
import {
  botScoreTone,
  buildPerformanceMetrics,
  formatCompact,
  getCreatorProfileUrl,
  getModerationOptions,
  getReviewOpenUrl,
  isVerticalReviewContent,
  originalLinkLabel,
  platformLabel,
  resolveClipSeconds,
  resolveReviewPlatform,
  type ReviewMetricTone,
  type ReviewPlatform,
} from "./review-metrics";
import { getPlatformIcon } from "@/lib/platform-icons";
import type {
  ReviewMetricsSource,
  ReviewRewardSummary,
  ReviewSubmission,
} from "./types";

/** Predefined reasons offered inline; "Custom" falls back to the full dialog. */
export const QUICK_REJECT_REASONS = PREDEFINED_REASONS.filter(
  (r) => r.value !== "other",
).map((r) => r.label);

const METRICS_OPEN_STORAGE_KEY = "goviral_review_mode_metrics_open_v2";
const CREATOR_OPEN_STORAGE_KEY = "goviral_review_mode_creator_open";

/** Open by default; remembers when the reviewer collapses the section. */
function usePersistedToggle(storageKey: string): [boolean, () => void] {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(storageKey) !== "false");
    } catch (_) {}
  }, [storageKey]);
  const toggle = () => {
    setOpen((prev) => {
      try {
        localStorage.setItem(storageKey, String(!prev));
      } catch (_) {}
      return !prev;
    });
  };
  return [open, toggle];
}

const DARK_TONE_CLASS: Record<ReviewMetricTone, string> = {
  default: "text-white",
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-red-400",
};

const LIGHT_TONE_CLASS: Record<ReviewMetricTone, string> = {
  default: "text-slate-900 font-bold",
  good: "text-emerald-600 font-bold",
  warn: "text-amber-600 font-bold",
  bad: "text-rose-600 font-bold",
};

const TONE_RING: Record<ReviewMetricTone, string> = {
  default: "ring-white/5",
  good: "ring-emerald-500/20",
  warn: "ring-amber-500/40",
  bad: "ring-red-500/50",
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/15 text-amber-300" },
  verified: { label: "Approved", className: "bg-emerald-500/15 text-emerald-300" },
  approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-300" },
  rejected: { label: "Rejected", className: "bg-red-500/15 text-red-300" },
  paid: { label: "Paid", className: "bg-blue-500/15 text-blue-300" },
};

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function platformName(platform: ReviewPlatform): string {
  switch (platform) {
    case "youtube":
      return "YouTube";
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    default:
      return "the platform";
  }
}

function formatHandle(value: string | null | undefined): string | null {
  const handle = String(value || "").trim();
  if (!handle || handle === "Unknown User") return null;
  // Raw YouTube channel ids aren't handles; the profile link still works.
  if (/^UC[\w-]{22}$/.test(handle)) return "YouTube channel";
  return `@${handle.replace(/^@/, "")}`;
}

function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function ToolbarButton({
  label,
  hint,
  onClick,
  disabled,
  active,
  isDark = false,
  children,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  isDark?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${label} (${hint})`}
      aria-label={label}
      className={cn(
        "flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap rounded-xl border px-1.5 sm:px-2 py-2 text-xs font-semibold transition-all shadow-2xs disabled:pointer-events-none disabled:opacity-35",
        active
          ? isDark
            ? "border-violet-500 bg-violet-600 text-white shadow-xs"
            : "border-violet-600 bg-violet-600 text-white shadow-xs"
          : isDark
            ? "border-slate-800 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900",
      )}
    >
      <span className="shrink-0">{children}</span>
      <span className="truncate">{label}</span>
      <span
        className={cn(
          "shrink-0 rounded px-1 text-[10px] font-medium opacity-70",
          active
            ? "bg-white/20 text-white"
            : isDark
              ? "bg-white/10 text-slate-300"
              : "bg-slate-100 text-slate-600 border border-slate-200/60",
        )}
      >
        {hint}
      </span>
    </button>
  );
}

function Kbd({ children, isDark }: { children: ReactNode; isDark?: boolean }) {
  return (
    <kbd
      className={cn(
        "ml-1 hidden rounded border px-1 text-[10px] font-medium md:inline [@media(pointer:coarse)]:hidden",
        isDark !== undefined
          ? isDark
            ? "border-slate-700 bg-slate-800/80 text-slate-300"
            : "border-slate-200 bg-slate-100 text-slate-600"
          : "border-current/30 opacity-70",
      )}
    >
      {children}
    </kbd>
  );
}

type ReviewSidePanelProps = {
  submission: ReviewSubmission;
  metrics: ReviewMetricsSource | null;
  reward: ReviewRewardSummary | null;
  canSeeCore: boolean;
  canModerate: boolean;
  canSelect: boolean;
  selected: boolean;
  busy: boolean;
  isDark?: boolean;
  /** Current playback position as a share of the clip, 0-100. */
  watchedPercent: number;
  /** Clip length reported by the player, used when analytics lack it. */
  playerDurationSeconds: number | null;
  rejectPickerOpen: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onMoveToPending: () => void;
  onPickReason: (reason: string) => void;
  onCustomReason: () => void;
  onCancelReject: () => void;
};

export function ReviewSidePanel({
  isDark = false,
  submission,
  metrics,
  reward,
  canSeeCore,
  canModerate,
  canSelect,
  selected,
  busy,
  watchedPercent,
  playerDurationSeconds,
  rejectPickerOpen,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onToggleSelect,
  onApprove,
  onReject,
  onMoveToPending,
  onPickReason,
  onCustomReason,
  onCancelReject,
}: ReviewSidePanelProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [metricsOpen, toggleMetrics] = usePersistedToggle(METRICS_OPEN_STORAGE_KEY);
  const [creatorOpen, toggleCreator] = usePersistedToggle(CREATOR_OPEN_STORAGE_KEY);

  const platform = resolveReviewPlatform(
    submission.platform,
    submission.contentLink,
  );
  const vertical = isVerticalReviewContent(platform, submission.contentLink, {
    title: submission.videoTitle,
    durationSeconds: metrics?.duration_seconds,
  });
  const openUrl = getReviewOpenUrl(platform, submission.contentLink, vertical);
  const resolvedClipSeconds = resolveClipSeconds(metrics ?? {}, playerDurationSeconds);
  const performance = buildPerformanceMetrics(
    platform,
    metrics ?? {},
    canSeeCore,
    resolvedClipSeconds,
  );
  const options = getModerationOptions(submission.status);
  const statusStyles: Record<string, { label: string; className: string }> = {
    pending: {
      label: "Pending",
      className: isDark
        ? "bg-amber-500/15 text-amber-300"
        : "bg-amber-50 text-amber-700 border border-amber-200/80",
    },
    verified: {
      label: "Approved",
      className: isDark
        ? "bg-emerald-500/15 text-emerald-300"
        : "bg-emerald-50 text-emerald-700 border border-emerald-200/80",
    },
    approved: {
      label: "Approved",
      className: isDark
        ? "bg-emerald-500/15 text-emerald-300"
        : "bg-emerald-50 text-emerald-700 border border-emerald-200/80",
    },
    rejected: {
      label: "Rejected",
      className: isDark
        ? "bg-red-500/15 text-red-300"
        : "bg-rose-50 text-rose-700 border border-rose-200/80",
    },
    paid: {
      label: "Paid",
      className: isDark
        ? "bg-blue-500/15 text-blue-300"
        : "bg-blue-50 text-blue-700 border border-blue-200/80",
    },
  };
  const status =
    statusStyles[submission.status] ?? {
      label: submission.status,
      className: isDark ? "bg-slate-500/15 text-slate-300" : "bg-slate-100 text-slate-700",
    };
  const botScore = canSeeCore ? (metrics?.bot_score ?? null) : null;
  const botFlags = canSeeCore ? (metrics?.bot_flags?.length ?? 0) : 0;
  const botTone: ReviewMetricTone =
    botFlags > 0 && botScoreTone(botScore) === "good" ? "warn" : botScoreTone(botScore);
  const name =
    submission.creatorDisplayName || submission.creatorUsername || "Creator";
  const profileUrl = getCreatorProfileUrl(platform, submission.creatorUsername);
  const profileTitle = `View ${name} on ${platformName(platform)}`;
  const platformHandle = formatHandle(submission.creatorUsername);
  const appHandle = formatHandle(submission.appUsername);
  const performanceAvailable = performance.filter((item) => item.value !== "-");
  const performanceMissing = performance.filter((item) => item.value === "-");
  const updatedAgo = formatRelativeTime(
    submission.metricsUpdatedAt ?? metrics?.last_basic_update ?? null,
  );
  const insightsBlocked = submission.insightsStatus === "permanent_failure";
  const campaign = submission.creatorCampaign;
  const creatorStats = submission.creatorStats;
  const trustTone: ReviewMetricTone =
    creatorStats?.trustScore == null
      ? "default"
      : creatorStats.trustScore >= 70
        ? "good"
        : creatorStats.trustScore >= 40
          ? "warn"
          : "bad";
  const submittedAt = submission.createdAt
    ? new Date(submission.createdAt).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  const muted = isDark ? "text-slate-400" : "text-slate-600";
  const sectionTitle = cn(
    "mb-2 text-[11px] font-bold uppercase tracking-wider transition-colors",
    isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900",
  );
  const getToneClass = (tone: ReviewMetricTone = "default") =>
    isDark ? DARK_TONE_CLASS[tone] : LIGHT_TONE_CLASS[tone];
  const tile = (tone: ReviewMetricTone = "default") =>
    cn(
      "rounded-2xl border p-3.5 transition-colors",
      isDark
        ? cn("bg-slate-900/60 border-white/10 ring-1", TONE_RING[tone])
        : "bg-white border-slate-200/90 shadow-2xs",
    );
  const tileLabel = isDark ? "text-[11px] text-slate-400" : "text-[11px] font-semibold text-slate-500";
  const watchedTone: ReviewMetricTone =
    watchedPercent >= 80 ? "good" : watchedPercent >= 30 ? "default" : "warn";
  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col lg:h-full lg:w-[395px] xl:w-[415px] lg:shrink-0 lg:border-l lg:border-t-0 shadow-sm",
        isDark
          ? "border-t border-slate-800 bg-slate-950 text-white"
          : "border-t border-slate-200 bg-white text-slate-900",
      )}
    >
      <div className="flex items-start gap-2.5 px-3 pb-2 pt-2.5 lg:gap-3 lg:p-5">
        {(() => {
          const avatar = (
            <Avatar className="h-9 w-9 shrink-0 lg:h-12 lg:w-12">
              <AvatarImage src={submission.creatorAvatarUrl || undefined} alt={name} />
              <AvatarFallback className={cn("font-bold", isDark ? "bg-violet-500/20 text-violet-200" : "bg-violet-100 text-violet-700")}>
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          );
          return profileUrl ? (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={profileTitle}
              className="shrink-0 rounded-full ring-violet-400/60 transition hover:ring-2"
            >
              {avatar}
            </a>
          ) : (
            avatar
          );
        })()}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("truncate text-sm font-bold lg:text-base", isDark ? "text-white" : "text-slate-900")} title={name}>
              {name}
            </p>
            {submission.rank != null && (
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                  isDark ? "bg-violet-500/20 text-violet-200" : "bg-violet-100 text-violet-700",
                )}
                title="Rank in the current sort"
              >
                #{submission.rank}
              </span>
            )}
          </div>
          {platformHandle && (
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white shadow-2xs">
                {getPlatformIcon(submission.platform, "sm")}
              </span>
              {profileUrl ? (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={profileTitle}
                  className={cn(
                    "group flex min-w-0 items-center gap-1 font-medium transition-colors",
                    isDark ? "text-slate-200 hover:text-violet-200" : "text-slate-600 hover:text-violet-600",
                  )}
                >
                  <span className="truncate group-hover:underline">{platformHandle}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                </a>
              ) : (
                <span className={cn("truncate font-medium", isDark ? "text-slate-200" : "text-slate-600")}>
                  {platformHandle}
                </span>
              )}
            </div>
          )}
          {appHandle && (
            <div
              className={cn(
                "mt-0.5 min-w-0 items-center gap-1.5 text-xs",
                mobileExpanded ? "flex" : "hidden lg:flex",
              )}
              title="Game of Creators username"
            >
              <span className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-black",
                isDark ? "bg-violet-500/25 text-violet-200" : "bg-violet-100 text-violet-700",
              )}>
                GC
              </span>
              <span className={cn("truncate", isDark ? "text-slate-400" : "text-slate-600")}>
                <span className={isDark ? "text-slate-500" : "text-slate-400"}>Game of Creators · </span>
                {appHandle}
              </span>
            </div>
          )}
          <div
            className={cn(
              "mt-1 flex-wrap items-center gap-1.5 text-[11px]",
              mobileExpanded ? "flex" : "hidden lg:flex",
              muted,
            )}
          >
            <span>{platformLabel(platform, vertical)}</span>
            {submittedAt && <span>· Submitted {submittedAt}</span>}
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold lg:px-2.5 lg:py-1 lg:text-xs",
            status.className,
          )}
        >
          {status.label}
        </span>
        <button
          type="button"
          className={cn("-mr-1 -mt-0.5 rounded-md p-1 lg:hidden", muted)}
          onClick={() => setMobileExpanded((v) => !v)}
          aria-label={mobileExpanded ? "Hide details" : "Show details"}
        >
          <ChevronDown
            className={cn("h-5 w-5 transition-transform", mobileExpanded && "rotate-180")}
          />
        </button>
      </div>

      <div className="flex gap-1.5 px-3 pb-2.5 lg:gap-2 lg:px-4 lg:pb-3.5">
        <ToolbarButton label="Prev" hint="K" onClick={onPrev} disabled={!canPrev} isDark={isDark}>
          <ChevronUp className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Next" hint="J" onClick={onNext} disabled={!canNext} isDark={isDark}>
          <ChevronDown className="h-4 w-4" />
        </ToolbarButton>
        {canSelect && (
          <ToolbarButton
            label={selected ? "Selected" : "Select"}
            hint="S"
            onClick={onToggleSelect}
            active={selected}
            isDark={isDark}
          >
            {selected ? <SquareCheck className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </ToolbarButton>
        )}
        {openUrl && (
          <ToolbarButton
            label="Open"
            hint="O"
            onClick={() => window.open(openUrl, "_blank", "noopener,noreferrer")}
            isDark={isDark}
          >
            <ExternalLink className="h-4 w-4" />
          </ToolbarButton>
        )}
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3 lg:block lg:space-y-5 lg:px-4 lg:pb-4",
          mobileExpanded ? "block max-h-[35vh] lg:max-h-none" : "hidden",
        )}
      >
        <section>
          <h3 className={sectionTitle}>Payout</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className={tile()}>
              <p className={tileLabel}>Expected</p>
              <p className={cn("text-base font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                {reward?.expected ? formatMoney(reward.expected.amount) : "-"}
              </p>
            </div>
            <div className={tile()}>
              <p className={tileLabel}>
                {reward?.granted?.label && reward.granted.label !== "—"
                  ? `Granted · ${reward.granted.label}`
                  : "Granted"}
              </p>
              <p className={cn("text-base font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                {reward?.granted && reward.granted.amount > 0
                  ? formatMoney(reward.granted.amount)
                  : "-"}
              </p>
            </div>
          </div>
          <div className={cn(tile(), "mt-2")}>
            <div className="flex items-center justify-between">
              <p className={tileLabel}>You watched</p>
              <p className={cn("text-xs font-bold tabular-nums", getToneClass(watchedTone))}>
                {watchedPercent}%
              </p>
            </div>
            <div className={cn("mt-1.5 h-1.5 overflow-hidden rounded-full", isDark ? "bg-white/10" : "bg-slate-100 border border-slate-200/50")}>
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300",
                  watchedTone === "good"
                    ? "bg-emerald-500"
                    : watchedTone === "warn"
                      ? "bg-amber-500"
                      : "bg-violet-500",
                )}
                style={{ width: `${watchedPercent}%` }}
              />
            </div>
          </div>
        </section>

        {creatorStats && (
          <section>
            <button
              type="button"
              onClick={toggleCreator}
              aria-expanded={creatorOpen}
              className={cn(sectionTitle, "mb-0 flex w-full items-center justify-between")}
            >
              <span className="flex items-center gap-2">
                Creator
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-[9px] font-bold tracking-normal",
                  isDark ? "bg-violet-500/20 text-violet-200" : "bg-violet-100 text-violet-700",
                )}>
                  Admin only
                </span>
              </span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", creatorOpen && "rotate-180")}
              />
            </button>
            {creatorOpen && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {campaign && (
                <div className={cn(tile(), "col-span-2")}>
                  <p className={tileLabel}>Clips in this campaign</p>
                  <p className={cn("flex flex-wrap items-baseline gap-x-2 text-sm font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                    {campaign.total}
                    <span className={cn("text-xs font-semibold", isDark ? "text-emerald-400" : "text-emerald-600")}>
                      {campaign.approved} approved
                    </span>
                    {campaign.rejected > 0 && (
                      <span className={cn("text-xs font-semibold", isDark ? "text-red-400" : "text-rose-600")}>
                        {campaign.rejected} rejected
                      </span>
                    )}
                    {campaign.pending > 0 && (
                      <span className={cn("text-xs font-semibold", isDark ? "text-amber-300" : "text-amber-600")}>
                        {campaign.pending} pending
                      </span>
                    )}
                  </p>
                </div>
              )}
              {creatorStats?.trustScore != null && (
                <div className={tile(trustTone)}>
                  <p className={tileLabel}>Trust score</p>
                  <p className={cn("text-sm font-bold tabular-nums", getToneClass(trustTone))}>
                    {Math.round(creatorStats.trustScore)}/100
                  </p>
                </div>
              )}
              {creatorStats?.avgQuality != null && (
                <div className={tile()}>
                  <p className={tileLabel}>Avg quality</p>
                  <p className={cn("text-sm font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                    {creatorStats.avgQuality.toFixed(1)}/5
                  </p>
                </div>
              )}
              {creatorStats?.totalEarnedCents != null && creatorStats.totalEarnedCents > 0 && (
                <div className={tile()}>
                  <p className={tileLabel}>Earned on GoC</p>
                  <p className={cn("text-sm font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                    {formatMoney(creatorStats.totalEarnedCents / 100)}
                  </p>
                </div>
              )}
              {creatorStats?.totalViews != null && creatorStats.totalViews > 0 && (
                <div className={tile()}>
                  <p className={tileLabel}>Views on GoC</p>
                  <p className={cn("text-sm font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                    {formatCompact(creatorStats.totalViews)}
                  </p>
                </div>
              )}
            </div>
            )}
          </section>
        )}

        <section>
          <button
            type="button"
            onClick={toggleMetrics}
            aria-expanded={metricsOpen}
            className={cn(sectionTitle, "mb-0 flex w-full items-center justify-between gap-2")}
          >
            Metrics
            <span className="flex items-center gap-2">
              {updatedAgo && (
                <span
                  className={cn("text-[11px] font-normal normal-case tracking-normal", isDark ? "text-slate-500" : "text-slate-500")}
                  title="Analytics last refreshed"
                >
                  Updated {updatedAgo}
                </span>
              )}
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", metricsOpen && "rotate-180")}
              />
            </span>
          </button>
          {metricsOpen && (
            <>
          {insightsBlocked && (
            <p className={cn("mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]", isDark ? "bg-amber-500/10 text-amber-200" : "bg-amber-50 border border-amber-200 text-amber-800")}>
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              Insights can&apos;t be fetched for this post; numbers may be stale.
            </p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {submission.qualityScore != null && (
              <div className={tile()}>
                <p className={tileLabel}>Quality score</p>
                <p className={cn("text-sm font-bold tabular-nums", isDark ? "text-white" : "text-slate-900")}>{submission.qualityScore}/5</p>
              </div>
            )}
            {platform === "youtube" && canSeeCore && (
              <div className={cn(tile(botTone), "col-span-2 flex items-center justify-between")}>
                <div>
                  <p className={tileLabel}>Bot score</p>
                  <p className={cn("text-sm font-bold tabular-nums", getToneClass(botTone))}>
                    {botScore != null ? `${botScore}/100` : "-"}
                  </p>
                </div>
                {botFlags > 0 && (
                  <span className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    isDark ? "bg-amber-500/15 text-amber-300" : "bg-amber-50 border border-amber-200 text-amber-700",
                  )}>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {botFlags} flag{botFlags === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            )}
              {performanceAvailable.map((item) => (
                <div key={item.key} className={tile(item.tone)}>
                  <p className={tileLabel}>{item.label}</p>
                  <p
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      getToneClass(item.tone),
                    )}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            {performanceMissing.length > 0 && (
              <p className={cn("mt-2 text-[11px] leading-relaxed", isDark ? "text-slate-500" : "text-slate-500")}>
                Not available for this clip:{" "}
                {performanceMissing.map((item) => item.label).join(", ")}
              </p>
            )}
            </>
          )}
        </section>
      </div>

      {canModerate && (
      <div className={cn("space-y-3 border-t px-3 py-2.5 lg:p-5", isDark ? "border-slate-800" : "border-slate-200")}>
        {options.locked && (
          <div className="flex items-center gap-2 rounded-xl bg-blue-500/10 px-3 py-2.5 text-xs text-blue-200">
            <Lock className="h-4 w-4 shrink-0" />
            Paid. Reversals are done from the submissions table.
          </div>
        )}

        {canModerate && !options.locked && rejectPickerOpen && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-red-500 dark:text-red-400">Reject because…</p>
              <button
                type="button"
                onClick={onCancelReject}
                className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-1"
              >
                Cancel <Kbd isDark={isDark}>Esc</Kbd>
              </button>
            </div>
            <div className="flex max-h-[40vh] flex-col gap-1.5 overflow-y-auto lg:max-h-none">
              {QUICK_REJECT_REASONS.map((reason, index) => (
                <button
                  key={reason}
                  type="button"
                  disabled={busy}
                  onClick={() => onPickReason(reason)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-medium transition-colors disabled:opacity-50",
                    isDark
                      ? "bg-slate-800/80 text-slate-200 hover:bg-red-500/20"
                      : "bg-[#f8f9fa] text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-100/80 shadow-2xs",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold shadow-2xs",
                      isDark ? "bg-slate-700 text-slate-300" : "bg-white text-slate-600 border border-slate-200/60",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate">{reason}</span>
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={onCustomReason}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs sm:text-sm font-medium transition-colors disabled:opacity-50",
                  isDark
                    ? "border border-dashed border-slate-700 text-slate-300 hover:bg-slate-800"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold shadow-2xs",
                    isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600 border border-slate-200/60",
                  )}
                >
                  {QUICK_REJECT_REASONS.length + 1}
                </span>
                <span className="flex-1 truncate">Custom reason…</span>
              </button>
            </div>
          </div>
        )}

        {canModerate && !options.locked && !rejectPickerOpen && (
          <div className="grid grid-cols-3 gap-2">
            {options.canReject && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={onReject}
                title="Reject (R)"
                className={cn(
                  "h-11 rounded-full border text-sm font-semibold shadow-none gap-1.5 px-3",
                  isDark
                    ? "border-red-500/40 bg-transparent text-red-400 hover:bg-red-500/10"
                    : "border-[#e5e5e5] bg-white text-[#dc2626] hover:bg-[#fef2f2]",
                )}
              >
                <X className="h-4 w-4 shrink-0" />
                <span className="truncate">Reject</span>
              </Button>
            )}
            {options.canMoveToPending && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={onMoveToPending}
                title="Pending (P)"
                className={cn(
                  "h-11 rounded-full border text-sm font-semibold shadow-none gap-1.5 px-3",
                  isDark
                    ? "border-white/10 bg-transparent text-white hover:bg-white/10"
                    : "border-[#e5e5e5] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7]",
                )}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">Pending</span>
              </Button>
            )}
            {options.canApprove && (
              <Button
                disabled={busy}
                onClick={onApprove}
                title="Approve (A)"
                className="h-11 rounded-full bg-[#1a1a1a] px-3 text-sm font-semibold text-white shadow-none hover:bg-black gap-1.5 dark:bg-white dark:text-[#1a1a1a] dark:hover:bg-[#f3f3f5]"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">Approve</span>
              </Button>
            )}
          </div>
        )}
      </div>
      )}
    </aside>
  );
}
