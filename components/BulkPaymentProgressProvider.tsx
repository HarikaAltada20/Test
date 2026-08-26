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

const STORAGE_KEY = "bulk_payment_active_job_v2";
const POLL_MS = 3000;

export type BulkPaymentType = "standard" | "bonus" | "both";

export type BulkPaymentJobStatus = {
  id: string;
  payment_type: BulkPaymentType;
  status: "queued" | "running" | "completed" | "failed";
  total_count: number;
  processed_count: number;
  success_count: number;
  failed_count: number;
  total_amount_cents?: number;
  total_cpm_cents?: number;
  total_bonus_cents?: number;
  total_milestone_cents?: number;
  error_message?: string | null;
  progressPercent: number;
};

type TrackedJob = {
  jobId: string;
  paymentType: BulkPaymentType;
  contestId?: string;
  isDual?: boolean;
  /** Total submissions in this job (progress denominator). */
  submissionCount: number;
  /** @deprecated kept for older localStorage snapshots */
  creatorCount?: number;
  snapshot?: Omit<BulkPaymentJobStatus, "payment_type"> & {
    payment_type?: BulkPaymentType;
  };
};

type BulkPaymentProgressContextValue = {
  activeJob: BulkPaymentJobStatus | null;
  isBusy: boolean;
  startTracking: (params: TrackedJob) => void;
};

const BulkPaymentProgressContext =
  createContext<BulkPaymentProgressContextValue | null>(null);

function readStorageRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY)
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
    if (!parsed?.jobId || !parsed?.paymentType) return null;
    return {
      ...parsed,
      submissionCount:
        Number(parsed.submissionCount) ||
        Number(parsed.creatorCount) ||
        0,
      creatorCount: Number(parsed.creatorCount) || 0,
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
      return;
    }
    const payload = JSON.stringify(job);
    localStorage.setItem(STORAGE_KEY, payload);
    sessionStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // ignore quota / private mode
  }
}

function formatMoney(cents: number) {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

function jobFromTracked(tracked: TrackedJob): BulkPaymentJobStatus {
  const snap = tracked.snapshot;
  const total =
    Number(snap?.total_count) ||
    tracked.submissionCount ||
    tracked.creatorCount ||
    0;
  const processed = Number(snap?.processed_count) || 0;
  return {
    id: tracked.jobId,
    payment_type: tracked.paymentType,
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
    total_amount_cents: Number(snap?.total_amount_cents) || 0,
    total_cpm_cents: Number(snap?.total_cpm_cents) || 0,
    total_bonus_cents: Number(snap?.total_bonus_cents) || 0,
    total_milestone_cents: Number(snap?.total_milestone_cents) || 0,
    error_message: snap?.error_message ?? null,
    progressPercent:
      typeof snap?.progressPercent === "number"
        ? snap.progressPercent
        : total > 0
          ? (processed / total) * 100
          : 0,
  };
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

export function BulkPaymentProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const initialTracked = useMemo(() => readStoredJob(), []);
  const [tracked, setTracked] = useState<TrackedJob | null>(initialTracked);
  const [activeJob, setActiveJob] = useState<BulkPaymentJobStatus | null>(() =>
    initialTracked ? jobFromTracked(initialTracked) : null,
  );
  const [dismissed, setDismissed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackedRef = useRef<TrackedJob | null>(initialTracked);
  const activeJobRef = useRef<BulkPaymentJobStatus | null>(
    initialTracked ? jobFromTracked(initialTracked) : null,
  );
  const pollInFlightRef = useRef(false);
  const consecutivePollErrorsRef = useRef(0);

  useEffect(() => {
    trackedRef.current = tracked;
  }, [tracked]);

  useEffect(() => {
    activeJobRef.current = activeJob;
  }, [activeJob]);

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
    activeJobRef.current = null;
    pollInFlightRef.current = false;
    setDismissed(false);
    consecutivePollErrorsRef.current = 0;
  }, [stopPolling]);

  /** Merge server status with last UI snapshot so progress never jumps backward. */
  const mergeMonotonicJob = useCallback(
    (incoming: BulkPaymentJobStatus): BulkPaymentJobStatus => {
      const prev = activeJobRef.current;
      if (!prev || prev.id !== incoming.id) return incoming;

      const processed = Math.max(
        Number(prev.processed_count) || 0,
        Number(incoming.processed_count) || 0,
      );
      const success = Math.max(
        Number(prev.success_count) || 0,
        Number(incoming.success_count) || 0,
      );
      const failed = Math.max(
        Number(prev.failed_count) || 0,
        Number(incoming.failed_count) || 0,
      );
      const total = Math.max(
        Number(prev.total_count) || 0,
        Number(incoming.total_count) || 0,
      );
      const amount = Math.max(
        Number(prev.total_amount_cents) || 0,
        Number(incoming.total_amount_cents) || 0,
      );
      const progressPercent =
        total > 0
          ? Math.max(
              Number(prev.progressPercent) || 0,
              Number(incoming.progressPercent) || 0,
              (processed / total) * 100,
            )
          : Math.max(
              Number(prev.progressPercent) || 0,
              Number(incoming.progressPercent) || 0,
            );

      return {
        ...incoming,
        total_count: total,
        processed_count: processed,
        success_count: success,
        failed_count: failed,
        total_amount_cents: amount,
        total_cpm_cents: Math.max(
          Number(prev.total_cpm_cents) || 0,
          Number(incoming.total_cpm_cents) || 0,
        ),
        total_bonus_cents: Math.max(
          Number(prev.total_bonus_cents) || 0,
          Number(incoming.total_bonus_cents) || 0,
        ),
        total_milestone_cents: Math.max(
          Number(prev.total_milestone_cents) || 0,
          Number(incoming.total_milestone_cents) || 0,
        ),
        progressPercent: Math.min(100, progressPercent),
      };
    },
    [],
  );

  const persistSnapshot = useCallback(
    (meta: TrackedJob, job: BulkPaymentJobStatus) => {
      const next: TrackedJob = {
        ...meta,
        snapshot: {
          id: job.id,
          status: job.status,
          total_count: job.total_count,
          processed_count: job.processed_count,
          success_count: job.success_count,
          failed_count: job.failed_count,
          total_amount_cents: job.total_amount_cents,
          total_cpm_cents: job.total_cpm_cents,
          total_bonus_cents: job.total_bonus_cents,
          total_milestone_cents: job.total_milestone_cents,
          error_message: job.error_message,
          progressPercent: job.progressPercent,
          payment_type: job.payment_type,
        },
      };
      writeStoredJob(next);
      // Update ref only — avoid setTracked on every poll (restarts / races).
      trackedRef.current = next;
    },
    [],
  );

  const finishWithToast = useCallback(
    (job: BulkPaymentJobStatus, meta: TrackedJob) => {
      const total = Math.max(0, Number(job.total_count) || 0);
      const processed = Math.max(0, Number(job.processed_count) || 0);
      const success = Math.max(0, Number(job.success_count) || 0);
      const failed = Math.max(0, Number(job.failed_count) || 0);
      const skipped = Math.max(0, total - success - failed);
      const amount = Number(job.total_amount_cents) || 0;
      const paymentLabel =
        meta.paymentType === "bonus"
          ? "bonus-paid"
          : meta.paymentType === "both"
            ? "paid (reward + bonus)"
            : "paid";

      if (job.status === "completed") {
        let description = `${success} of ${total} submission(s) were ${paymentLabel}. Processed ${processed} · Success ${success} · Failed ${failed}.`;
        if (skipped > 0) {
          description += ` Skipped ${skipped}.`;
        }
        if (meta.isDual) {
          description += ` CPM ${formatMoney(Number(job.total_cpm_cents) || 0)} · Milestone ${formatMoney(Number(job.total_milestone_cents) || 0)}.`;
        } else if (amount > 0) {
          description += ` Total paid ${formatMoney(amount)}.`;
        }
        showToast({
          title:
            success === 0 && (failed > 0 || skipped > 0)
              ? "Bulk payment completed — nothing paid"
              : failed > 0
                ? "Bulk payment completed with failures"
                : skipped > 0
                  ? "Bulk payment completed with skips"
                  : "Bulk payment complete",
          description,
          variant:
            success === 0 && (failed > 0 || skipped > 0)
              ? "destructive"
              : failed > 0
                ? "default"
                : "payment",
        });
      } else {
        showToast({
          title: "Bulk payment failed",
          description:
            job.error_message ||
            `The background payment job failed. Processed ${processed} · Success ${success} · Failed ${failed}.`,
          variant: "destructive",
        });
      }

      window.dispatchEvent(
        new CustomEvent("bulk-payment:completed", {
          detail: {
            job,
            paymentType: meta.paymentType,
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
    if (!meta?.jobId || pollInFlightRef.current) return;

    pollInFlightRef.current = true;
    try {
      const res = await fetch(
        `/api/admin/bulk-payment/status?jobId=${encodeURIComponent(meta.jobId)}`,
        { cache: "no-store" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          (data as { error?: string })?.error ||
          `Failed to load bulk payment status (HTTP ${res.status})`;

        if (res.status === 404) {
          clearTracking();
          return;
        }

        if (isAuthOrTransientPollError(res.status, message)) {
          consecutivePollErrorsRef.current += 1;
          return;
        }

        consecutivePollErrorsRef.current += 1;
        if (consecutivePollErrorsRef.current >= 5) {
          showToast({
            title: "Bulk payment status unavailable",
            description: message,
            variant: "destructive",
          });
          clearTracking();
        }
        return;
      }

      consecutivePollErrorsRef.current = 0;
      const job = data as BulkPaymentJobStatus;
      const progressPercent =
        typeof job.progressPercent === "number"
          ? job.progressPercent
          : job.total_count > 0
            ? (job.processed_count / job.total_count) * 100
            : 0;
      const nextJob = mergeMonotonicJob({
        ...job,
        id: job.id || meta.jobId,
        progressPercent,
        payment_type: meta.paymentType,
      });
      activeJobRef.current = nextJob;
      setActiveJob(nextJob);
      setDismissed(false);
      persistSnapshot(meta, nextJob);

      if (job.status === "queued" || job.status === "running") {
        return;
      }

      finishWithToast(nextJob, meta);
    } catch (error) {
      consecutivePollErrorsRef.current += 1;
      if (consecutivePollErrorsRef.current >= 8) {
        showToast({
          title: "Bulk payment status unavailable",
          description:
            error instanceof Error
              ? error.message
              : "Failed to poll bulk payment progress.",
          variant: "destructive",
        });
        clearTracking();
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }, [clearTracking, finishWithToast, mergeMonotonicJob, persistSnapshot]);

  const startTracking = useCallback((params: TrackedJob) => {
    const submissionCount =
      Number(params.submissionCount) || Number(params.creatorCount) || 0;
    const next: TrackedJob = {
      ...params,
      submissionCount,
      creatorCount: Number(params.creatorCount) || 0,
      snapshot: {
        id: params.jobId,
        status: "queued",
        total_count: submissionCount,
        processed_count: 0,
        success_count: 0,
        failed_count: 0,
        total_amount_cents: 0,
        total_cpm_cents: 0,
        total_bonus_cents: 0,
        total_milestone_cents: 0,
        error_message: null,
        progressPercent: 0,
        payment_type: params.paymentType,
      },
    };
    writeStoredJob(next);
    setTracked(next);
    trackedRef.current = next;
    const initialJob = jobFromTracked(next);
    activeJobRef.current = initialJob;
    setDismissed(false);
    consecutivePollErrorsRef.current = 0;
    pollInFlightRef.current = false;
    setActiveJob(initialJob);
  }, []);

  useEffect(() => {
    const stored = readStoredJob();
    if (!stored) return;
    setTracked(stored);
    trackedRef.current = stored;
    const restored = jobFromTracked(stored);
    activeJobRef.current = restored;
    setActiveJob(restored);
    setDismissed(false);
  }, []);

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
  const success = Math.max(0, Number(activeJob?.success_count) || 0);
  const failed = Math.max(0, Number(activeJob?.failed_count) || 0);
  const skipped = Math.max(0, processed - success - failed);
  const pct = Math.round(
    Number.isFinite(activeJob?.progressPercent)
      ? Number(activeJob?.progressPercent)
      : total > 0
        ? (processed / total) * 100
        : 0,
  );

  return (
    <BulkPaymentProgressContext.Provider value={value}>
      {children}
      {showPanel && activeJob && (
        <div
          className={cn(
            "pointer-events-auto fixed top-4 right-4 z-[10000] w-full max-w-[min(100vw-1.5rem,22rem)] rounded-2xl border border-l-[3px] p-4 pr-10 shadow-lg sm:top-6 sm:right-6 sm:max-w-[24rem]",
            "border-sky-200/90 bg-sky-50 text-sky-950 border-l-sky-600 dark:border-sky-950/45 dark:border-l-sky-500 dark:bg-[#0c1418] dark:text-sky-50",
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
            Processing bulk payments…
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
            <p className="text-xs opacity-80">
              {success} succeeded · {skipped} skipped
              {Number(activeJob.total_amount_cents) > 0
                ? ` · ${formatMoney(Number(activeJob.total_amount_cents) || 0)}`
                : ""}
            </p>
          </div>
        </div>
      )}
    </BulkPaymentProgressContext.Provider>
  );
}

export function useBulkPaymentProgress() {
  const ctx = useContext(BulkPaymentProgressContext);
  if (!ctx) {
    throw new Error(
      "useBulkPaymentProgress must be used within BulkPaymentProgressProvider",
    );
  }
  return ctx;
}
