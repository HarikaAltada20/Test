"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast as showToast } from "@/hooks/use-toast";
import { formatBulkModerationRefundToast } from "@/lib/bulk-payment-toast";

const STORAGE_KEY = "bulk_moderation_active_job_v2";
const LEGACY_STORAGE_KEY = "bulk_moderation_active_job_v1";
const POLL_MS = 3000;

export type BulkModerationAction = "verified" | "pending" | "rejected";

export type BulkModerationWalletRefundSummary = {
  reward_refunded_cents?: number;
  bonus_refunded_cents?: number;
  total_refunded_cents?: number;
  cpm_refunded_cents?: number;
  milestone_refunded_cents?: number;
  refunded_count?: number;
  skipped_count?: number;
  is_dual_rewards?: boolean;
};

export type BulkModerationJobStatus = {
  id: string;
  action: BulkModerationAction;
  status: "queued" | "running" | "completed" | "failed";
  total_count: number;
  processed_count: number;
  success_count: number;
  failed_count: number;
  quality_score?: number | null;
  error_message?: string | null;
  progressPercent: number;
  wallet_refund_summary?: BulkModerationWalletRefundSummary | null;
};

type TrackedJob = {
  jobId: string;
  submissionIds: string[];
  action: BulkModerationAction;
  qualityScore?: 1 | 2 | 3 | 4 | 5;
  closeCreatorModalOnSuccess?: boolean;
  contestId?: string;
  /** Last known progress — restored immediately on refresh. */
  snapshot?: Omit<BulkModerationJobStatus, "action"> & {
    action?: BulkModerationAction;
  };
};

type BulkModerationProgressContextValue = {
  activeJob: BulkModerationJobStatus | null;
  isBusy: boolean;
  startTracking: (params: TrackedJob) => void;
};

const BulkModerationProgressContext =
  createContext<BulkModerationProgressContextValue | null>(null);

function readStorageRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      localStorage.getItem(STORAGE_KEY) ||
      sessionStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem(LEGACY_STORAGE_KEY) ||
      sessionStorage.getItem(LEGACY_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

function readStoredJob(): TrackedJob | null {
  try {
    const raw = readStorageRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrackedJob;
    if (!parsed?.jobId || !parsed?.action) return null;
    return {
      ...parsed,
      submissionIds: Array.isArray(parsed.submissionIds)
        ? parsed.submissionIds.map(String)
        : [],
    };
  } catch {
    return null;
  }
}

function writeStoredJob(job: TrackedJob | null) {
  if (typeof window === "undefined") return;
  try {
    if (!job) {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      sessionStorage.removeItem(LEGACY_STORAGE_KEY);
      return;
    }
    const payload = JSON.stringify(job);
    localStorage.setItem(STORAGE_KEY, payload);
    sessionStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // ignore quota / private mode
  }
}

function jobFromTracked(tracked: TrackedJob): BulkModerationJobStatus {
  const snap = tracked.snapshot;
  const total =
    Number(snap?.total_count) ||
    tracked.submissionIds.length ||
    0;
  const processed = Number(snap?.processed_count) || 0;
  return {
    id: tracked.jobId,
    action: tracked.action,
    status:
      snap?.status === "running" ||
      snap?.status === "queued" ||
      snap?.status === "completed" ||
      snap?.status === "failed"
        ? snap.status
        : "running",
    total_count: total,
    processed_count: processed,
    success_count: Number(snap?.success_count) || 0,
    failed_count: Number(snap?.failed_count) || 0,
    quality_score: snap?.quality_score ?? tracked.qualityScore ?? null,
    error_message: snap?.error_message ?? null,
    progressPercent:
      typeof snap?.progressPercent === "number"
        ? snap.progressPercent
        : total > 0
          ? (processed / total) * 100
          : 0,
  };
}

function runningTitle(action: BulkModerationAction) {
  if (action === "verified") return "Verifying submissions…";
  if (action === "pending") return "Moving to pending…";
  return "Rejecting submissions…";
}

function panelTone(action: BulkModerationAction) {
  if (action === "rejected") {
    return "border-red-200/90 bg-red-50 text-red-950 border-l-red-600 dark:border-red-950/50 dark:border-l-red-500 dark:bg-[#1c1010] dark:text-red-50";
  }
  if (action === "pending") {
    return "border-amber-200/90 bg-amber-50 text-amber-950 border-l-amber-500 dark:border-amber-950/40 dark:border-l-amber-400 dark:bg-[#18140c] dark:text-amber-50";
  }
  return "border-emerald-200/90 bg-emerald-50 text-emerald-950 border-l-emerald-600 dark:border-emerald-950/45 dark:border-l-emerald-500 dark:bg-[#0c1814] dark:text-emerald-50";
}

function isAuthOrTransientPollError(status: number, message: string): boolean {
  const msg = message.toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes("timeout") ||
    msg.includes("failed to fetch") ||
    msg.includes("network")
  );
}

export function BulkModerationProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const initialTracked = useMemo(() => readStoredJob(), []);
  const [tracked, setTracked] = useState<TrackedJob | null>(initialTracked);
  const [activeJob, setActiveJob] = useState<BulkModerationJobStatus | null>(
    () => (initialTracked ? jobFromTracked(initialTracked) : null),
  );
  const [dismissed, setDismissed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackedRef = useRef<TrackedJob | null>(initialTracked);
  const consecutivePollErrorsRef = useRef(0);

  useEffect(() => {
    trackedRef.current = tracked;
  }, [tracked]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const clearTracking = useCallback(() => {
    stopPolling();
    writeStoredJob(null);
    setTracked(null);
    setActiveJob(null);
    setDismissed(false);
    consecutivePollErrorsRef.current = 0;
  }, [stopPolling]);

  const persistSnapshot = useCallback(
    (meta: TrackedJob, job: BulkModerationJobStatus) => {
      const next: TrackedJob = {
        ...meta,
        snapshot: {
          id: job.id,
          status: job.status,
          total_count: job.total_count,
          processed_count: job.processed_count,
          success_count: job.success_count,
          failed_count: job.failed_count,
          quality_score: job.quality_score,
          error_message: job.error_message,
          progressPercent: job.progressPercent,
          action: job.action,
        },
      };
      writeStoredJob(next);
      setTracked(next);
      trackedRef.current = next;
    },
    [],
  );

  const finishWithToast = useCallback(
    (job: BulkModerationJobStatus, meta: TrackedJob) => {
      const success = Math.max(0, Number(job.success_count) || 0);
      const failed = Math.max(0, Number(job.failed_count) || 0);
      const total = Math.max(0, Number(job.total_count) || 0);
      const countForMessage = success > 0 ? success : total;
      const actionText =
        meta.action === "verified"
          ? "Verified"
          : meta.action === "pending"
            ? "Set to Pending"
            : "Rejected";

      if (job.status === "completed") {
        const refund = job.wallet_refund_summary;
        const totalRefundedCents = Math.max(
          0,
          Number(refund?.total_refunded_cents) || 0,
        );
        const qualityScoreLine =
          meta.action === "verified" &&
          meta.qualityScore != null &&
          totalRefundedCents <= 0
            ? `Quality score set to ${meta.qualityScore}/5.`
            : null;
        const description = formatBulkModerationRefundToast({
          actionText,
          successCount: countForMessage,
          failedCount: failed,
          qualityScoreLine,
          refundedCount:
            refund?.refunded_count == null
              ? null
              : Number(refund.refunded_count) || 0,
          skippedCount:
            refund?.skipped_count == null
              ? null
              : Number(refund.skipped_count) || 0,
          rewardCents: Number(refund?.reward_refunded_cents) || 0,
          bonusCents: Number(refund?.bonus_refunded_cents) || 0,
          totalCents: totalRefundedCents,
          cpmCents: Number(refund?.cpm_refunded_cents) || 0,
          milestoneCents: Number(refund?.milestone_refunded_cents) || 0,
          isDualRewards: refund?.is_dual_rewards === true,
        });
        showToast({
          title:
            meta.action === "rejected"
              ? "Rejected"
              : meta.action === "pending"
                ? "Pending"
                : "✅ Success",
          description,
          variant:
            meta.action === "rejected"
              ? "destructive"
              : meta.action === "pending"
                ? "pending"
                : failed > 0
                  ? "default"
                  : "success",
        });
      } else {
        showToast({
          title: "Bulk moderation failed",
          description:
            job.error_message || "The background moderation job failed.",
          variant: "destructive",
        });
      }

      window.dispatchEvent(
        new CustomEvent("bulk-moderation:completed", {
          detail: {
            job,
            submissionIds: meta.submissionIds,
            action: meta.action,
            qualityScore: meta.qualityScore,
            closeCreatorModalOnSuccess: meta.closeCreatorModalOnSuccess,
            contestId: meta.contestId,
          },
        }),
      );
      setTimeout(() => window.dispatchEvent(new Event("contests:refresh")), 1000);
      clearTracking();
    },
    [clearTracking],
  );

  const pollOnce = useCallback(async () => {
    const meta = trackedRef.current;
    if (!meta?.jobId) return;

    try {
      const res = await fetch(
        `/api/admin/bulk-verify/status?jobId=${encodeURIComponent(meta.jobId)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          (data as { error?: string })?.error ||
          `Failed to load bulk moderation status (HTTP ${res.status})`;

        // Job truly gone — stop tracking.
        if (res.status === 404) {
          clearTracking();
          return;
        }

        // Auth/network blips after refresh must NOT wipe the toast.
        if (isAuthOrTransientPollError(res.status, message)) {
          consecutivePollErrorsRef.current += 1;
          return;
        }

        consecutivePollErrorsRef.current += 1;
        if (consecutivePollErrorsRef.current >= 5) {
          showToast({
            title: "Bulk moderation status unavailable",
            description: message,
            variant: "destructive",
          });
          clearTracking();
        }
        return;
      }

      consecutivePollErrorsRef.current = 0;
      const job = data as BulkModerationJobStatus;
      const progressPercent =
        typeof job.progressPercent === "number"
          ? job.progressPercent
          : job.total_count > 0
            ? (job.processed_count / job.total_count) * 100
            : 0;
      const nextJob: BulkModerationJobStatus = {
        ...job,
        id: job.id || meta.jobId,
        progressPercent,
        action: meta.action,
      };
      setActiveJob(nextJob);
      persistSnapshot(meta, nextJob);

      if (job.status === "queued" || job.status === "running") {
        return;
      }

      finishWithToast(nextJob, meta);
    } catch (error) {
      // Network errors after refresh — keep showing last snapshot and retry.
      consecutivePollErrorsRef.current += 1;
      if (consecutivePollErrorsRef.current >= 8) {
        showToast({
          title: "Bulk moderation status unavailable",
          description:
            error instanceof Error
              ? error.message
              : "Failed to poll bulk moderation progress.",
          variant: "destructive",
        });
        clearTracking();
      }
    }
  }, [clearTracking, finishWithToast, persistSnapshot]);

  const startTracking = useCallback((params: TrackedJob) => {
    const next: TrackedJob = {
      ...params,
      submissionIds: params.submissionIds.map(String),
      snapshot: {
        id: params.jobId,
        status: "queued",
        total_count: params.submissionIds.length,
        processed_count: 0,
        success_count: 0,
        failed_count: 0,
        quality_score: params.qualityScore ?? null,
        error_message: null,
        progressPercent: 0,
        action: params.action,
      },
    };
    writeStoredJob(next);
    setTracked(next);
    trackedRef.current = next;
    setDismissed(false);
    consecutivePollErrorsRef.current = 0;
    setActiveJob(jobFromTracked(next));
  }, []);

  // Re-hydrate on mount (covers SSR → client and full page refresh).
  useEffect(() => {
    const stored = readStoredJob();
    if (!stored) return;
    setTracked(stored);
    trackedRef.current = stored;
    setActiveJob(jobFromTracked(stored));
    setDismissed(false);
  }, []);

  // Single poller for the active tracked job.
  useEffect(() => {
    if (!tracked?.jobId) {
      stopPolling();
      return;
    }
    void pollOnce();
    stopPolling();
    pollRef.current = setInterval(() => {
      void pollOnce();
    }, POLL_MS);
    return () => stopPolling();
  }, [tracked?.jobId, pollOnce, stopPolling]);

  const isBusy =
    !!activeJob &&
    (activeJob.status === "queued" || activeJob.status === "running");

  const value = useMemo(
    () => ({
      activeJob: isBusy ? activeJob : null,
      isBusy,
      startTracking,
    }),
    [activeJob, isBusy, startTracking],
  );

  const showPanel = isBusy && activeJob && !dismissed;
  const total = Math.max(0, Number(activeJob?.total_count) || 0);
  const processed = Math.max(0, Number(activeJob?.processed_count) || 0);
  const pct = Math.round(
    Number.isFinite(activeJob?.progressPercent)
      ? Number(activeJob?.progressPercent)
      : total > 0
        ? (processed / total) * 100
        : 0,
  );

  return (
    <BulkModerationProgressContext.Provider value={value}>
      {children}
      {showPanel && activeJob && (
        <div
          className={cn(
            "pointer-events-auto fixed top-4 right-4 z-[10000] w-full max-w-[min(100vw-1.5rem,22rem)] rounded-2xl border border-l-[3px] p-4 pr-10 shadow-lg sm:top-6 sm:right-6 sm:max-w-[24rem]",
            panelTone(activeJob.action),
          )}
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            aria-label="Hide progress"
            className="absolute right-3 top-3 rounded-sm opacity-60 transition-opacity hover:opacity-100"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold leading-none">
            {runningTitle(activeJob.action)}
          </p>
          <div className="mt-2 space-y-1.5">
            <p className="text-sm">
              {activeJob.status === "queued" ? "Queued" : "In progress"}:{" "}
              {processed} / {total} ({pct}%)
            </p>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total || 1}
              aria-valuenow={processed}
            >
              <div
                className="h-full rounded-full bg-current transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              />
            </div>
            {/* <p className="text-xs opacity-70">
              Continues in the background if you refresh or leave this page.
            </p> */}
          </div>
        </div>
      )}
    </BulkModerationProgressContext.Provider>
  );
}

export function useBulkModerationProgress() {
  const ctx = useContext(BulkModerationProgressContext);
  if (!ctx) {
    throw new Error(
      "useBulkModerationProgress must be used within BulkModerationProgressProvider",
    );
  }
  return ctx;
}
