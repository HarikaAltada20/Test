"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Gauge,
  Keyboard,
  PartyPopper,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ReviewSlide } from "./ReviewSlide";
import { QUICK_REJECT_REASONS, ReviewSidePanel } from "./ReviewSidePanel";
import {
  ReviewSelectionTray,
  type ReviewSelectionBreakdown,
} from "./ReviewSelectionTray";
import type { ReviewPlayerHandle } from "./ReviewPlayer";
import {
  getModerationOptions,
  getReviewOpenUrl,
  isVerticalReviewContent,
  resolveReviewPlatform,
} from "./review-metrics";
import { useReviewFeed, writeReviewParam } from "./use-review-feed";
import { useReviewKeyboard } from "./use-review-keyboard";
import type {
  ReviewMetricsSource,
  ReviewModerationAction,
  ReviewRewardSummary,
  ReviewSubmission,
} from "./types";

const HINT_STORAGE_KEY = "goviral_review_mode_hint_dismissed_v2";
const AUTO_ADVANCE_STORAGE_KEY = "goviral_review_mode_auto_advance";
const SPEED_STORAGE_KEY = "goviral_review_mode_speed";
const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;
/** Give up waiting for a status change (e.g. quality dialog cancelled). */
const AWAIT_TIMEOUT_MS = 5 * 60 * 1000;

export type ReviewModeProps = {
  /** Ordered submission ids, frozen when Review Mode opens. */
  queueIds: string[];
  initialId: string | null;
  campaignTitle: string;
  contextLabel?: string;
  /** Changes whenever submission data changes, so status updates re-render. */
  dataVersion: unknown;
  getSubmission: (id: string) => ReviewSubmission | undefined;
  getMetrics: (id: string) => ReviewMetricsSource | null;
  getReward: (id: string) => ReviewRewardSummary | null;
  canSeeCore: boolean;
  canModerate: (id: string) => boolean;
  canBulkModerate: boolean;
  canSelect: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onClearSelection: () => void;
  /** Single-clip moderation; must not clear the table selection. */
  onModerate: (action: ReviewModerationAction, ids: string[]) => void;
  /** Reject with a reason picked inline, skipping the rejection dialog. */
  onRejectWithReason: (ids: string[], reason: string) => Promise<void> | void;
  /** Bulk moderation of selected ids (existing bulk flow; paid clips already excluded). */
  onBulkModerate: (action: ReviewModerationAction, ids: string[]) => void;
  onUndo: (ids: string[]) => Promise<void> | void;
  isBusy: (id: string) => boolean;
  bulkBusyAction: ReviewModerationAction | null;
  canDownload: boolean;
  downloading: boolean;
  onDownloadSelected: () => void;
  /** Review Mode is always dark; kept so callers don't need to special-case it. */
  isDark: boolean;
  onExit: () => void;
};

type SessionStats = { approved: number; rejected: number };

export function ReviewMode(props: ReviewModeProps) {
  const { queueIds, initialId, onExit } = props;
  const [mounted, setMounted] = useState(false);
  const [queue, setQueue] = useState<string[]>(queueIds);
  const [startId, setStartId] = useState<string | null>(initialId);
  const [sessionKey, setSessionKey] = useState(0);
  const [focusedOnSelection, setFocusedOnSelection] = useState(false);
  const [unreviewedOnly, setUnreviewedOnly] = useState(false);
  const [muted, setMuted] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [stats, setStats] = useState<SessionStats>({ approved: 0, rejected: 0 });
  const baseQueueRef = useRef(queueIds);

  useEffect(() => {
    setMounted(true);
    // Browsers block autoplay with sound until the user has interacted with the page
    // (e.g. resuming from a ?review= link on a fresh load).
    const activation = (navigator as Navigator & {
      userActivation?: { hasBeenActive: boolean };
    }).userActivation;
    if (activation && !activation.hasBeenActive) setMuted(true);
    try {
      setAutoAdvance(localStorage.getItem(AUTO_ADVANCE_STORAGE_KEY) !== "false");
      const savedRate = Number(localStorage.getItem(SPEED_STORAGE_KEY));
      if ((PLAYBACK_RATES as readonly number[]).includes(savedRate)) {
        setPlaybackRate(savedRate);
      }
    } catch (_) {}
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("review-mode-open");
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.classList.remove("review-mode-open");
      writeReviewParam(null);
    };
  }, []);

  const rebuildQueue = useCallback(
    (next: string[], currentId: string | null) => {
      setQueue(next);
      setStartId(currentId && next.includes(currentId) ? currentId : next[0] ?? null);
      setSessionKey((k) => k + 1);
    },
    [],
  );

  const applyFilters = useCallback(
    (opts: { onlySelected: boolean; unreviewed: boolean }, currentId: string | null) => {
      let next = baseQueueRef.current;
      if (opts.onlySelected) {
        const inQueue = next.filter((id) => props.selectedIds.has(id));
        const extra = Array.from(props.selectedIds).filter(
          (id) => !next.includes(id) && props.getSubmission(id),
        );
        next = [...inQueue, ...extra];
      }
      if (opts.unreviewed) {
        next = next.filter((id) => props.getSubmission(id)?.status === "pending");
      }
      rebuildQueue(next, currentId);
    },
    [props, rebuildQueue],
  );

  const setAutoAdvancePersisted = (value: boolean) => {
    setAutoAdvance(value);
    try {
      localStorage.setItem(AUTO_ADVANCE_STORAGE_KEY, String(value));
    } catch (_) {}
  };

  const setPlaybackRatePersisted = (value: number) => {
    setPlaybackRate(value);
    try {
      localStorage.setItem(SPEED_STORAGE_KEY, String(value));
    } catch (_) {}
  };

  if (!mounted) return null;

  return createPortal(
    <ReviewSession
      key={sessionKey}
      {...props}
      queue={queue}
      startId={startId}
      muted={muted}
      onMutedChange={setMuted}
      playbackRate={playbackRate}
      onPlaybackRateChange={setPlaybackRatePersisted}
      autoAdvance={autoAdvance}
      onAutoAdvanceChange={setAutoAdvancePersisted}
      unreviewedOnly={unreviewedOnly}
      onUnreviewedOnlyChange={(value, currentId) => {
        setUnreviewedOnly(value);
        applyFilters({ onlySelected: focusedOnSelection, unreviewed: value }, currentId);
      }}
      focusedOnSelection={focusedOnSelection}
      onFocusSelection={(value, currentId) => {
        setFocusedOnSelection(value);
        applyFilters({ onlySelected: value, unreviewed: unreviewedOnly }, currentId);
      }}
      stats={stats}
      onStat={(kind) =>
        setStats((s) => ({ ...s, [kind]: s[kind] + 1 }))
      }
      onExit={onExit}
    />,
    document.body,
  );
}

type ReviewSessionProps = ReviewModeProps & {
  queue: string[];
  startId: string | null;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  autoAdvance: boolean;
  onAutoAdvanceChange: (value: boolean) => void;
  unreviewedOnly: boolean;
  onUnreviewedOnlyChange: (value: boolean, currentId: string | null) => void;
  focusedOnSelection: boolean;
  onFocusSelection: (value: boolean, currentId: string | null) => void;
  stats: SessionStats;
  onStat: (kind: keyof SessionStats) => void;
};

function NeighbourCard({
  label,
  submission,
  onClick,
}: {
  label: string;
  submission: ReviewSubmission | undefined;
  onClick: () => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const thumb = submission?.videoThumbnailUrl;
  useEffect(() => setThumbFailed(false), [thumb]);
  if (!submission) return <div className="h-[132px] w-[92px]" />;
  const handle = submission.creatorUsername || submission.creatorDisplayName;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-[92px] flex-col gap-1 text-left"
      title={`${label}: ${handle ?? "submission"}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className="relative block h-[132px] w-[92px] overflow-hidden rounded-xl bg-slate-800 ring-1 ring-white/10 transition-all group-hover:ring-violet-400/60">
        {thumb && !thumbFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setThumbFailed(true)}
            className="h-full w-full object-cover opacity-50 blur-[1px] transition-opacity group-hover:opacity-80"
            decoding="async"
          />
        ) : (
          <span className="block h-full w-full bg-gradient-to-br from-slate-800 to-slate-900" />
        )}
      </span>
      {handle && (
        <span className="truncate text-[11px] text-slate-400 group-hover:text-white">
          @{handle.replace(/^@/, "")}
        </span>
      )}
    </button>
  );
}

function ReviewSession({
  queue,
  startId,
  campaignTitle,
  contextLabel,
  dataVersion,
  getSubmission,
  getMetrics,
  getReward,
  canSeeCore,
  canModerate,
  canBulkModerate,
  canSelect,
  selectedIds,
  onToggleSelect,
  onClearSelection,
  onModerate,
  onRejectWithReason,
  onBulkModerate,
  onUndo,
  isBusy,
  bulkBusyAction,
  canDownload,
  downloading,
  onDownloadSelected,
  onExit,
  muted,
  onMutedChange,
  playbackRate,
  onPlaybackRateChange,
  autoAdvance,
  onAutoAdvanceChange,
  unreviewedOnly,
  onUnreviewedOnlyChange,
  focusedOnSelection,
  onFocusSelection,
  stats,
  onStat,
}: ReviewSessionProps) {
  const { toast } = useToast();
  // One extra slide at the end for the session summary.
  const slideCount = queue.length + 1;
  const initialIndex = Math.max(0, startId ? queue.indexOf(startId) : 0);
  const { containerRef, activeIndex, goTo, next, prev, forwardWheel } =
    useReviewFeed({ count: slideCount, initialIndex });

  const playerRef = useRef<ReviewPlayerHandle | null>(null);
  const isSummary = activeIndex >= queue.length;
  const activeId = isSummary ? null : queue[activeIndex];
  const activeSubmission = activeId ? getSubmission(activeId) : undefined;
  const visitedRef = useRef(new Set<string>());

  const [rejectPickerOpen, setRejectPickerOpen] = useState(false);
  const [watchedPercent, setWatchedPercent] = useState(0);
  const [playerDuration, setPlayerDuration] = useState<number | null>(null);

  useEffect(() => {
    setRejectPickerOpen(false);
    setWatchedPercent(0);
    setPlayerDuration(null);
    if (activeId) {
      visitedRef.current.add(activeId);
      writeReviewParam(activeId);
    }
  }, [activeId]);

  const pendingLeft = useMemo(
    () => queue.filter((id) => getSubmission(id)?.status === "pending").length,
    // getSubmission reads the latest data; dataVersion signals changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queue, dataVersion],
  );

  // Overlays on the video fade after 2s without mouse movement.
  const [overlaysVisible, setOverlaysVisible] = useState(true);
  const idleTimerRef = useRef<number | undefined>(undefined);
  const pokeOverlays = useCallback(() => {
    setOverlaysVisible(true);
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setOverlaysVisible(false), 2000);
  }, []);
  useEffect(() => {
    pokeOverlays();
    return () => window.clearTimeout(idleTimerRef.current);
  }, [activeIndex, pokeOverlays]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  useEffect(() => {
    try {
      setHintVisible(localStorage.getItem(HINT_STORAGE_KEY) !== "true");
    } catch (_) {}
  }, []);
  const dismissHint = () => {
    setHintVisible(false);
    try {
      localStorage.setItem(HINT_STORAGE_KEY, "true");
    } catch (_) {}
  };

  // Track single-clip actions until the submission status actually changes;
  // approve/reject may first open the quality-score or rejection dialogs.
  const awaitingRef = useRef(
    new Map<
      string,
      { action: ReviewModerationAction; prevStatus: string; startedAt: number }
    >(),
  );
  const autoAdvanceRef = useRef(autoAdvance);
  autoAdvanceRef.current = autoAdvance;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  useEffect(() => {
    const now = Date.now();
    awaitingRef.current.forEach((entry, id) => {
      const sub = getSubmission(id);
      if (!sub || now - entry.startedAt > AWAIT_TIMEOUT_MS) {
        awaitingRef.current.delete(id);
        return;
      }
      if (sub.status === entry.prevStatus) return;
      awaitingRef.current.delete(id);
      const name = sub.creatorDisplayName || sub.creatorUsername || "Submission";

      if (entry.action === "pending") {
        if (sub.status === "pending") {
          toast({ title: "Moved to pending", description: name, duration: 3000 });
        }
        return;
      }

      const approved =
        entry.action === "verify" &&
        (sub.status === "verified" || sub.status === "approved");
      const rejected = entry.action === "reject" && sub.status === "rejected";
      if (!approved && !rejected) return;

      onStat(approved ? "approved" : "rejected");
      toast({
        title: approved ? "Approved" : "Rejected",
        description: name,
        duration: 5000,
        action: (
          <ToastAction altText="Undo" onClick={() => void onUndo([id])}>
            Undo
          </ToastAction>
        ),
      });
      if (autoAdvanceRef.current && activeIdRef.current === id) {
        next();
      }
    });
    // Runs when submission data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion]);

  const activeOptions = activeSubmission
    ? getModerationOptions(activeSubmission.status)
    : null;
  const activeCanModerate =
    !!activeId && !!activeSubmission && canModerate(activeId);
  const activeBusy = !!activeId && isBusy(activeId);

  const track = useCallback(
    (action: ReviewModerationAction) => {
      if (!activeId || !activeSubmission) return;
      awaitingRef.current.set(activeId, {
        action,
        prevStatus: activeSubmission.status,
        startedAt: Date.now(),
      });
    },
    [activeId, activeSubmission],
  );

  const moderateActive = useCallback(
    (action: ReviewModerationAction) => {
      if (!activeId || !activeCanModerate || !activeOptions || activeBusy) return;
      if (action === "verify" && !activeOptions.canApprove) return;
      if (action === "reject" && !activeOptions.canReject) return;
      if (action === "pending" && !activeOptions.canMoveToPending) return;
      setRejectPickerOpen(false);
      track(action);
      onModerate(action, [activeId]);
    },
    [activeId, activeCanModerate, activeOptions, activeBusy, track, onModerate],
  );

  const openRejectPicker = useCallback(() => {
    if (!activeCanModerate || !activeOptions?.canReject || activeBusy) return;
    setRejectPickerOpen((open) => !open);
  }, [activeCanModerate, activeOptions, activeBusy]);

  const rejectWithReason = useCallback(
    (reason: string) => {
      if (!activeId || !activeCanModerate || !activeOptions?.canReject || activeBusy) {
        return;
      }
      setRejectPickerOpen(false);
      track("reject");
      void onRejectWithReason([activeId], reason);
    },
    [activeId, activeCanModerate, activeOptions, activeBusy, track, onRejectWithReason],
  );

  const toggleSelectActive = useCallback(() => {
    if (!activeId || !canSelect) return;
    onToggleSelect(activeId, !selectedIds.has(activeId));
  }, [activeId, canSelect, onToggleSelect, selectedIds]);

  const toggleMute = useCallback(() => {
    onMutedChange(!muted);
  }, [muted, onMutedChange]);

  const stepSpeed = useCallback(
    (direction: 1 | -1) => {
      const index = PLAYBACK_RATES.indexOf(playbackRate as (typeof PLAYBACK_RATES)[number]);
      const nextIndex = Math.max(
        0,
        Math.min(PLAYBACK_RATES.length - 1, (index < 0 ? 0 : index) + direction),
      );
      onPlaybackRateChange(PLAYBACK_RATES[nextIndex]);
    },
    [playbackRate, onPlaybackRateChange],
  );

  const cycleSpeed = () => {
    const index = PLAYBACK_RATES.indexOf(playbackRate as (typeof PLAYBACK_RATES)[number]);
    onPlaybackRateChange(PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length]);
  };

  const activePlatform = activeSubmission
    ? resolveReviewPlatform(activeSubmission.platform, activeSubmission.contentLink)
    : null;
  // Landscape videos use the full stage width, leaving no room for neighbour cards.
  const activeIsVertical =
    !!activeSubmission &&
    !!activePlatform &&
    isVerticalReviewContent(activePlatform, activeSubmission.contentLink, {
      title: activeSubmission.videoTitle,
      durationSeconds: activeId ? getMetrics(activeId)?.duration_seconds : null,
    });
  const activeOpenUrl =
    activeSubmission && activePlatform
      ? getReviewOpenUrl(activePlatform, activeSubmission.contentLink, activeIsVertical)
      : null;

  useReviewKeyboard({
    next,
    prev,
    togglePlay: () => playerRef.current?.togglePlay(),
    toggleMute,
    toggleSelect: toggleSelectActive,
    approve: () => moderateActive("verify"),
    reject: openRejectPicker,
    moveToPending: () => moderateActive("pending"),
    speedUp: () => stepSpeed(1),
    speedDown: () => stepSpeed(-1),
    digit: (n) => {
      if (!rejectPickerOpen) return false;
      if (n <= QUICK_REJECT_REASONS.length) {
        rejectWithReason(QUICK_REJECT_REASONS[n - 1]);
      } else if (n === QUICK_REJECT_REASONS.length + 1) {
        moderateActive("reject");
      } else {
        return false;
      }
      return true;
    },
    openOriginal: () => {
      if (activeOpenUrl) window.open(activeOpenUrl, "_blank", "noopener,noreferrer");
    },
    exit: () => {
      if (rejectPickerOpen) setRejectPickerOpen(false);
      else onExit();
    },
  });

  const selectedCount = selectedIds.size;
  const selectionBreakdown = useMemo<ReviewSelectionBreakdown>(() => {
    const result: ReviewSelectionBreakdown = {
      total: selectedIds.size,
      verify: [],
      reject: [],
      pending: [],
      paid: 0,
    };
    selectedIds.forEach((id) => {
      const sub = getSubmission(id);
      if (!sub) return;
      const options = getModerationOptions(sub.status);
      if (options.locked) {
        result.paid += 1;
        return;
      }
      if (!canModerate(id)) return;
      if (options.canApprove) result.verify.push(id);
      if (options.canReject) result.reject.push(id);
      if (options.canMoveToPending) result.pending.push(id);
    });
    return result;
    // getSubmission / canModerate read the latest data; dataVersion signals changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, dataVersion]);
  const position = Math.min(activeIndex + 1, queue.length);
  const progress = queue.length > 0 ? (position / queue.length) * 100 : 0;
  const settingsControls = (
    <>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-200">
        <Switch checked={autoAdvance} onCheckedChange={onAutoAdvanceChange} />
        Auto-advance
      </label>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-200">
        <Switch
          checked={unreviewedOnly}
          onCheckedChange={(v) => onUnreviewedOnlyChange(v, activeId)}
        />
        Unreviewed only
      </label>
      {focusedOnSelection && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onFocusSelection(false, activeId)}
          className="h-8 border-slate-700 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"
        >
          Show all
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={cycleSpeed}
        className={cn(
          "h-8 gap-1 px-2 tabular-nums hover:bg-white/10 hover:text-white",
          playbackRate !== 1 ? "text-violet-300" : "text-slate-200",
        )}
        title="Playback speed (< / >). Applies to YouTube and direct videos."
      >
        <Gauge className="h-4 w-4" />
        {playbackRate}×
      </Button>
    </>
  );
  const prevSubmission =
    !isSummary && activeIndex > 0 ? getSubmission(queue[activeIndex - 1]) : undefined;
  const nextSubmission =
    !isSummary && activeIndex + 1 < queue.length
      ? getSubmission(queue[activeIndex + 1])
      : undefined;

  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col bg-slate-950 text-white"
      role="region"
      aria-label="Review Mode"
    >
      <header className="relative border-b border-slate-800">
        <div className="flex items-center gap-2 px-2 py-1.5 sm:gap-x-4 sm:px-3 sm:py-2 lg:px-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            aria-label="Exit Review Mode"
            className="shrink-0 gap-1.5 px-2 text-slate-200 hover:bg-white/10 hover:text-white sm:px-3"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              <span className="hidden sm:inline">Review Mode · </span>
              {campaignTitle}
            </p>
            {contextLabel && (
              <p className="hidden truncate text-xs text-slate-400 sm:block">{contextLabel}</p>
            )}
          </div>

          <div className="hidden items-center gap-3 text-xs font-semibold tabular-nums md:flex">
            <span className="flex items-center gap-1 text-emerald-400" title="Approved this session">
              <Check className="h-3.5 w-3.5" />
              {stats.approved}
            </span>
            <span className="flex items-center gap-1 text-red-400" title="Rejected this session">
              <X className="h-3.5 w-3.5" />
              {stats.rejected}
            </span>
            <span className="text-slate-400" title="Pending in this queue">
              {pendingLeft} pending
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-xs font-semibold tabular-nums sm:text-sm">
            {queue.length > 0 ? `${position} / ${queue.length}` : "0 / 0"}
            <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-slate-800 sm:block">
              <div
                className="h-full rounded-full bg-violet-500 transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="hidden items-center gap-4 lg:flex">{settingsControls}</div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label="Review settings"
            aria-expanded={settingsOpen}
            className={cn(
              "h-8 w-8 shrink-0 hover:bg-white/10 hover:text-white lg:hidden",
              settingsOpen || autoAdvance || unreviewedOnly || playbackRate !== 1
                ? "text-violet-300"
                : "text-slate-200",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Unmute (M)" : "Mute (M)"}
            className="h-8 w-8 shrink-0 text-slate-200 hover:bg-white/10 hover:text-white sm:h-10 sm:w-10"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </div>

        {settingsOpen && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-800 px-3 py-2 lg:hidden">
            {settingsControls}
            <div className="flex items-center gap-3 text-xs font-semibold tabular-nums md:hidden">
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                {stats.approved}
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <X className="h-3.5 w-3.5" />
                {stats.rejected}
              </span>
              <span className="text-slate-400">{pendingLeft} pending</span>
            </div>
          </div>
        )}

        <div className="h-0.5 bg-slate-800 sm:hidden">
          <div
            className="h-full bg-violet-500 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <ReviewSelectionTray
        breakdown={selectionBreakdown}
        canBulkModerate={canBulkModerate}
        busyAction={bulkBusyAction}
        canDownload={canDownload}
        downloading={downloading}
        isFocusedOnSelection={focusedOnSelection}
        onModerate={onBulkModerate}
        onDownload={onDownloadSelected}
        onReviewOnlySelected={() => onFocusSelection(true, activeId)}
        onClear={onClearSelection}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          className="relative min-h-0 flex-1 bg-neutral-950"
          onMouseMove={pokeOverlays}
        >
          <div
            ref={containerRef}
            className="absolute inset-0 snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {queue.map((id, index) => {
              const distance = Math.abs(index - activeIndex);
              const submission = distance <= 2 ? getSubmission(id) : undefined;
              return (
                <ReviewSlide
                  key={id}
                  ref={distance === 0 ? playerRef : undefined}
                  submission={submission}
                  metrics={distance <= 2 ? getMetrics(id) : null}
                  distance={distance}
                  selected={selectedIds.has(id)}
                  muted={muted}
                  playbackRate={playbackRate}
                  canSeeCore={canSeeCore}
                  overlaysVisible={overlaysVisible}
                  onWheelForward={forwardWheel}
                  onWatchedChange={distance === 0 ? setWatchedPercent : undefined}
                  onDurationChange={distance === 0 ? setPlayerDuration : undefined}
                />
              );
            })}
            <div className="flex h-full w-full snap-start snap-always items-center justify-center p-6">
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 text-center text-white shadow-2xl">
                <PartyPopper className="mx-auto mb-3 h-10 w-10 text-violet-400" />
                <h2 className="text-lg font-bold">You reached the end</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Reviewed {visitedRef.current.size} of {queue.length} clips
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-emerald-500/10 p-3">
                    <p className="text-xl font-bold text-emerald-400">{stats.approved}</p>
                    <p className="text-xs text-slate-400">approved</p>
                  </div>
                  <div className="rounded-xl bg-red-500/10 p-3">
                    <p className="text-xl font-bold text-red-400">{stats.rejected}</p>
                    <p className="text-xs text-slate-400">rejected</p>
                  </div>
                  <div className="rounded-xl bg-violet-500/10 p-3">
                    <p className="text-xl font-bold text-violet-300">{selectedCount}</p>
                    <p className="text-xs text-slate-400">selected</p>
                  </div>
                </div>
                <div className="mt-5 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    onClick={() => goTo(0)}
                  >
                    Back to start
                  </Button>
                  <Button onClick={onExit}>Exit Review Mode</Button>
                </div>
              </div>
            </div>
          </div>

          {queue.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-400">
              No submissions to review with the current filters.
            </div>
          )}

          {!isSummary && queue.length > 0 && activeIsVertical && (
            <div className="pointer-events-none absolute inset-y-0 left-6 z-40 hidden flex-col justify-center gap-6 xl:flex">
              <div className="pointer-events-auto">
                <NeighbourCard label="Previous" submission={prevSubmission} onClick={prev} />
              </div>
              <div className="pointer-events-auto">
                <NeighbourCard label="Up next" submission={nextSubmission} onClick={next} />
              </div>
            </div>
          )}

          {hintVisible && (
            <div className="absolute inset-x-0 top-3 z-50 hidden justify-center px-4 lg:flex [@media(pointer:coarse)]:hidden">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full bg-black/75 px-4 py-2 text-xs text-white shadow-lg backdrop-blur">
                <Keyboard className="h-4 w-4 text-violet-300" />
                <span>↑ ↓ browse</span>
                <span>Click / Space play</span>
                <span>M mute</span>
                <span>&lt; &gt; speed</span>
                <span>S select</span>
                {canBulkModerate && <span>A approve · R reject · P pending</span>}
                <span>Esc exit</span>
                <button
                  type="button"
                  onClick={dismissHint}
                  className="ml-1 rounded-full px-2 py-0.5 font-semibold text-violet-300 hover:bg-white/10"
                >
                  Got it
                </button>
              </div>
            </div>
          )}

        </div>

        {activeSubmission && activeId && (
          <ReviewSidePanel
            submission={activeSubmission}
            metrics={getMetrics(activeId)}
            reward={getReward(activeId)}
            canSeeCore={canSeeCore}
            canModerate={activeCanModerate}
            canSelect={canSelect}
            selected={selectedIds.has(activeId)}
            busy={activeBusy}
            watchedPercent={watchedPercent}
            playerDurationSeconds={playerDuration}
            rejectPickerOpen={rejectPickerOpen}
            canPrev={activeIndex > 0}
            canNext={activeIndex < slideCount - 1}
            onPrev={prev}
            onNext={next}
            onToggleSelect={toggleSelectActive}
            onApprove={() => moderateActive("verify")}
            onReject={openRejectPicker}
            onMoveToPending={() => moderateActive("pending")}
            onPickReason={rejectWithReason}
            onCustomReason={() => moderateActive("reject")}
            onCancelReject={() => setRejectPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
