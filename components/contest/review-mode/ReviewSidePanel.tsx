"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
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

const TONE_CLASS: Record<ReviewMetricTone, string> = {
  default: "text-white",
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-red-400",
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
  children,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
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
        "flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-35 lg:flex-col lg:gap-1 lg:rounded-xl lg:py-2",
        active
          ? "bg-violet-600 text-white hover:bg-violet-500"
          : "bg-slate-800/70 text-slate-200 hover:bg-slate-700 hover:text-white",
      )}
    >
      {children}
      <span className="hidden truncate min-[360px]:inline">{label}</span>
    </button>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="ml-1 hidden rounded border border-current/30 px-1 text-[10px] font-medium opacity-70 md:inline [@media(pointer:coarse)]:hidden">
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
  const status =
    STATUS_STYLES[submission.status] ?? {
      label: submission.status,
      className: "bg-slate-500/15 text-slate-300",
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

  const muted = "text-slate-400";
  const sectionTitle = "mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400";
  const tile = (tone: ReviewMetricTone = "default") =>
    cn("rounded-xl bg-slate-800/70 px-3 py-2 ring-1", TONE_RING[tone]);
  const watchedTone: ReviewMetricTone =
    watchedPercent >= 80 ? "good" : watchedPercent >= 30 ? "default" : "warn";
  return (
    <aside className="flex min-h-0 flex-col border-t border-slate-800 bg-slate-950 text-white lg:h-full lg:w-[380px] lg:shrink-0 lg:border-l lg:border-t-0">
      <div className="flex items-start gap-2.5 px-3 pb-2 pt-2.5 lg:gap-3 lg:p-5">
        {(() => {
          const avatar = (
            <Avatar className="h-9 w-9 shrink-0 lg:h-12 lg:w-12">
              <AvatarImage src={submission.creatorAvatarUrl || undefined} alt={name} />
              <AvatarFallback className="bg-violet-500/20 font-semibold text-violet-200">
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
            <p className="truncate text-sm font-semibold lg:text-base" title={name}>
              {name}
            </p>
            {submission.rank != null && (
              <span
                className="shrink-0 rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[11px] font-bold text-violet-200"
                title="Rank in the current sort"
              >
                #{submission.rank}
              </span>
            )}
          </div>
          {platformHandle && (
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white">
                {getPlatformIcon(submission.platform, "sm")}
              </span>
              {profileUrl ? (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={profileTitle}
                  className="group flex min-w-0 items-center gap-1 text-slate-200 hover:text-violet-200"
                >
                  <span className="truncate group-hover:underline">{platformHandle}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                </a>
              ) : (
                <span className="truncate text-slate-200">{platformHandle}</span>
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
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/25 text-[8px] font-black text-violet-200">
                GC
              </span>
              <span className="truncate text-slate-400">
                <span className="text-slate-500">Game of Creators · </span>
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

      <div className="flex gap-1.5 px-3 pb-2.5 lg:gap-2 lg:px-5 lg:pb-4">
        <ToolbarButton label="Previous" hint="K / Up" onClick={onPrev} disabled={!canPrev}>
          <ChevronUp className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Next" hint="J / Down" onClick={onNext} disabled={!canNext}>
          <ChevronDown className="h-4 w-4" />
        </ToolbarButton>
        {canSelect && (
          <ToolbarButton
            label={selected ? "Selected" : "Select"}
            hint="S"
            onClick={onToggleSelect}
            active={selected}
          >
            {selected ? <SquareCheck className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </ToolbarButton>
        )}
        {openUrl && (
          <ToolbarButton
            label="Open clip"
            hint={`O · ${originalLinkLabel(platform)}`}
            onClick={() => window.open(openUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-4 w-4" />
          </ToolbarButton>
        )}
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3 lg:block lg:space-y-5 lg:px-5 lg:pb-4",
          mobileExpanded ? "block max-h-[35vh] lg:max-h-none" : "hidden",
        )}
      >
        <section>
          <h3 className={sectionTitle}>Payout</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className={tile()}>
              <p className="text-[11px] text-slate-400">Expected</p>
              <p className="text-base font-bold tabular-nums">
                {reward?.expected ? formatMoney(reward.expected.amount) : "-"}
              </p>
            </div>
            <div className={tile()}>
              <p className="text-[11px] text-slate-400">
                {reward?.granted?.label && reward.granted.label !== "—"
                  ? `Granted · ${reward.granted.label}`
                  : "Granted"}
              </p>
              <p className="text-base font-bold tabular-nums">
                {reward?.granted && reward.granted.amount > 0
                  ? formatMoney(reward.granted.amount)
                  : "-"}
              </p>
            </div>
          </div>
          <div className={cn(tile(), "mt-2")}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-slate-400">You watched</p>
              <p className={cn("text-xs font-bold tabular-nums", TONE_CLASS[watchedTone])}>
                {watchedPercent}%
              </p>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300",
                  watchedTone === "good"
                    ? "bg-emerald-400"
                    : watchedTone === "warn"
                      ? "bg-amber-400"
                      : "bg-violet-400",
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
              className={cn(sectionTitle, "mb-0 flex w-full items-center justify-between hover:text-white")}
            >
              <span className="flex items-center gap-2">
                Creator
                <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-violet-200">
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
                  <p className="text-[11px] text-slate-400">Clips in this campaign</p>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-bold tabular-nums">
                    {campaign.total}
                    <span className="text-xs font-semibold text-emerald-400">
                      {campaign.approved} approved
                    </span>
                    {campaign.rejected > 0 && (
                      <span className="text-xs font-semibold text-red-400">
                        {campaign.rejected} rejected
                      </span>
                    )}
                    {campaign.pending > 0 && (
                      <span className="text-xs font-semibold text-amber-300">
                        {campaign.pending} pending
                      </span>
                    )}
                  </p>
                </div>
              )}
              {creatorStats?.trustScore != null && (
                <div className={tile(trustTone)}>
                  <p className="text-[11px] text-slate-400">Trust score</p>
                  <p className={cn("text-sm font-bold tabular-nums", TONE_CLASS[trustTone])}>
                    {Math.round(creatorStats.trustScore)}/100
                  </p>
                </div>
              )}
              {creatorStats?.avgQuality != null && (
                <div className={tile()}>
                  <p className="text-[11px] text-slate-400">Avg quality</p>
                  <p className="text-sm font-bold tabular-nums">
                    {creatorStats.avgQuality.toFixed(1)}/5
                  </p>
                </div>
              )}
              {creatorStats?.totalEarnedCents != null && creatorStats.totalEarnedCents > 0 && (
                <div className={tile()}>
                  <p className="text-[11px] text-slate-400">Earned on GoC</p>
                  <p className="text-sm font-bold tabular-nums">
                    {formatMoney(creatorStats.totalEarnedCents / 100)}
                  </p>
                </div>
              )}
              {creatorStats?.totalViews != null && creatorStats.totalViews > 0 && (
                <div className={tile()}>
                  <p className="text-[11px] text-slate-400">Views on GoC</p>
                  <p className="text-sm font-bold tabular-nums">
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
            className={cn(sectionTitle, "mb-0 flex w-full items-center justify-between gap-2 hover:text-white")}
          >
            Metrics
            <span className="flex items-center gap-2">
              {updatedAgo && (
                <span
                  className="text-[11px] font-normal normal-case tracking-normal text-slate-500"
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
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              Insights can&apos;t be fetched for this post; numbers may be stale.
            </p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {submission.qualityScore != null && (
              <div className={tile()}>
                <p className="text-[11px] text-slate-400">Quality score</p>
                <p className="text-sm font-bold tabular-nums">{submission.qualityScore}/5</p>
              </div>
            )}
            {platform === "youtube" && canSeeCore && (
              <div className={cn(tile(botTone), "col-span-2 flex items-center justify-between")}>
                <div>
                  <p className="text-[11px] text-slate-400">Bot score</p>
                  <p className={cn("text-sm font-bold tabular-nums", TONE_CLASS[botTone])}>
                    {botScore != null ? `${botScore}/100` : "-"}
                  </p>
                </div>
                {botFlags > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {botFlags} flag{botFlags === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            )}
              {performanceAvailable.map((item) => (
                <div key={item.key} className={tile(item.tone)}>
                  <p className="text-[11px] text-slate-400">{item.label}</p>
                  <p
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      TONE_CLASS[item.tone ?? "default"],
                    )}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            {performanceMissing.length > 0 && (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Not available for this clip:{" "}
                {performanceMissing.map((item) => item.label).join(", ")}
              </p>
            )}
            </>
          )}
        </section>
      </div>

      {canModerate && (
      <div className="space-y-3 border-t border-slate-800 px-3 py-2.5 lg:p-5">
        {options.locked && (
          <div className="flex items-center gap-2 rounded-xl bg-blue-500/10 px-3 py-2.5 text-xs text-blue-200">
            <Lock className="h-4 w-4 shrink-0" />
            Paid. Reversals are done from the submissions table.
          </div>
        )}

        {canModerate && !options.locked && rejectPickerOpen && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-red-300">Reject because…</p>
              <button
                type="button"
                onClick={onCancelReject}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel <Kbd>Esc</Kbd>
              </button>
            </div>
            <div className="flex max-h-[40vh] flex-col gap-1.5 overflow-y-auto lg:max-h-none">
              {QUICK_REJECT_REASONS.map((reason, index) => (
                <button
                  key={reason}
                  type="button"
                  disabled={busy}
                  onClick={() => onPickReason(reason)}
                  className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-2 text-left text-sm transition-colors hover:bg-red-500/20 disabled:opacity-50"
                >
                  <kbd className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-700 text-[11px] font-bold">
                    {index + 1}
                  </kbd>
                  {reason}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={onCustomReason}
                className="flex items-center gap-2 rounded-lg border border-dashed border-slate-700 px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                <kbd className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-700 text-[11px] font-bold">
                  {QUICK_REJECT_REASONS.length + 1}
                </kbd>
                <PenLine className="h-3.5 w-3.5" />
                Custom reason…
              </button>
            </div>
          </div>
        )}

        {canModerate && !options.locked && !rejectPickerOpen && (
          <div className="flex gap-2 lg:grid lg:grid-cols-2 [&>*]:flex-1">
            {options.canReject && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={onReject}
                className="gap-1.5 border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/15 hover:text-red-200"
              >
                <X className="h-4 w-4" />
                Reject
                <Kbd>R</Kbd>
              </Button>
            )}
            {options.canMoveToPending && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={onMoveToPending}
                className="gap-1.5 border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Pending
                <Kbd>P</Kbd>
              </Button>
            )}
            {options.canApprove && (
              <Button
                disabled={busy}
                onClick={onApprove}
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve
                <Kbd>A</Kbd>
              </Button>
            )}
          </div>
        )}
      </div>
      )}
    </aside>
  );
}
