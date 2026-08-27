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
import { toast as showToast } from "@/hooks/use-toast";
import type { BulkVideoDownloadProgressState } from "@/components/BulkVideoDownloadProgress";
import {
  DEFAULT_VIDEO_FILENAME_PATTERN,
  isVideoFilenamePattern,
  type VideoFilenamePattern,
} from "@/lib/video-download-filename";
import {
  downloadSubmissionVideosInChunks,
  parseVideosPerZip,
  type BulkVideoDownloadResultRow,
  type BulkVideoDownloadSubmissionMeta,
} from "@/lib/video-download-ui";

const LEGACY_SESSION_STORAGE_KEY = "goc-bulk-video-download-session-v1";
const LEGACY_PATTERN_STORAGE_KEY = "goc-bulk-video-naming-pattern";
const LEGACY_VIDEOS_PER_ZIP_STORAGE_KEY = "goc-bulk-videos-per-zip";
const SUPABASE_PROGRESS_DEBOUNCE_MS = 1200;
/** Survives React Strict Mode remounts so the same session is not started twice. */
const activeDownloadRuns = new Set<number>();
const hydratedContests = new Set<string>();

export type BulkVideoDownloadZipPartRef = {
  jobId: string;
  zipPartIndex: number;
  zipPartTotal: number;
  submissionIds: string[];
  zipFilename: string;
};

export type BulkVideoDownloadSession = {
  contestId: string;
  creatorId?: string | null;
  submissionIds: string[];
  namingPattern: VideoFilenamePattern;
  videosPerZip: number;
  fileNamePrefix: string;
  metaById: Record<string, BulkVideoDownloadSubmissionMeta>;
  progress: BulkVideoDownloadProgressState;
  startedAt: number;
  status: "running" | "finished" | "failed";
  /** Supabase `bulk_video_download_jobs.id` (usually the Redis batchId). */
  supabaseJobId?: string | null;
  /** ZIP parts from Supabase — used to resume without localStorage. */
  zipParts?: BulkVideoDownloadZipPartRef[];
  /** True after the user opened Download summary (hides floating button). */
  summaryViewed?: boolean;
  summaryViewedAt?: string | null;
};

type StartBulkVideoDownloadParams = {
  contestId: string;
  creatorId?: string | null;
  submissionIds: string[];
  namingPattern: VideoFilenamePattern;
  videosPerZip: number;
  fileNamePrefix: string;
  metaById: Map<string, BulkVideoDownloadSubmissionMeta>;
};

type BulkVideoDownloadProgressContextValue = {
  session: BulkVideoDownloadSession | null;
  progress: BulkVideoDownloadProgressState | null;
  downloading: boolean;
  statusOpen: boolean;
  setStatusOpen: (open: boolean) => void;
  /** Open finished summary and mark button as viewed in Supabase. */
  openVideoSummary: () => void;
  startDownload: (params: StartBulkVideoDownloadParams) => Promise<void>;
  clearSession: () => void;
  isBusyForContest: (contestId: string) => boolean;
  hasSessionForContest: (contestId: string) => boolean;
  hydrateForContest: (contestId: string) => Promise<void>;
};

const BulkVideoDownloadProgressContext =
  createContext<BulkVideoDownloadProgressContextValue | null>(null);

/** One-shot cleanup of older browser-persisted bulk-download keys. */
function purgeLegacyBulkDownloadStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    localStorage.removeItem(LEGACY_PATTERN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_VIDEOS_PER_ZIP_STORAGE_KEY);
    localStorage.removeItem("goc-bulk-zip-pending");
    sessionStorage.removeItem("goc-bulk-zip-pending");
  } catch {
    // ignore
  }
}

function metaMapFromRecord(
  record: Record<string, BulkVideoDownloadSubmissionMeta>,
): Map<string, BulkVideoDownloadSubmissionMeta> {
  return new Map(Object.entries(record || {}));
}

function metaRecordFromMap(
  map: Map<string, BulkVideoDownloadSubmissionMeta>,
): Record<string, BulkVideoDownloadSubmissionMeta> {
  const record: Record<string, BulkVideoDownloadSubmissionMeta> = {};
  for (const [id, meta] of map) {
    record[id] = meta;
  }
  return record;
}

type RemoteSessionRow = {
  id: string;
  contest_id: string;
  status: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  zip_part_index?: number;
  zip_part_total?: number;
  videos_per_zip: number;
  naming_pattern?: string | null;
  file_name_prefix?: string | null;
  created_at?: string;
  updated_at?: string;
  submission_ids?: string[];
  zip_parts?: {
    jobId: string;
    zipPartIndex?: number;
    zipPartTotal?: number;
    chunkIndex?: number;
    totalChunks?: number;
    submissionIds: string[];
    zipFilename: string;
  }[];
  summary_viewed?: boolean;
  summary_viewed_at?: string | null;
  /** Enriched on GET by joining submissions + job_items. */
  metaById?: Record<string, BulkVideoDownloadSubmissionMeta>;
  results?: BulkVideoDownloadResultRow[];
};

function remoteRowToSession(row: RemoteSessionRow): BulkVideoDownloadSession | null {
  const submissionIds = Array.isArray(row.submission_ids)
    ? row.submission_ids.filter(Boolean)
    : [];
  if (submissionIds.length < 2) return null;
  const namingPattern = isVideoFilenamePattern(row.naming_pattern)
    ? row.naming_pattern
    : DEFAULT_VIDEO_FILENAME_PATTERN;
  const createdMs = Date.parse(row.created_at || "") || Date.now();
  const finished = row.status === "completed" || row.status === "failed";
  const zipParts: BulkVideoDownloadZipPartRef[] = Array.isArray(row.zip_parts)
    ? row.zip_parts
        .filter((part) => part && typeof part.jobId === "string")
        .map((part) => ({
          jobId: part.jobId,
          zipPartIndex: Math.max(
            1,
            Number(part.zipPartIndex ?? part.chunkIndex) || 1,
          ),
          zipPartTotal: Math.max(
            1,
            Number(part.zipPartTotal ?? part.totalChunks) || 1,
          ),
          submissionIds: Array.isArray(part.submissionIds)
            ? part.submissionIds.filter(Boolean)
            : [],
          zipFilename:
            typeof part.zipFilename === "string" && part.zipFilename.trim()
              ? part.zipFilename.trim()
              : "bulk.zip",
        }))
    : [];
  const results = Array.isArray(row.results) ? row.results : [];
  const successFromResults = results.filter(
    (item) => item.status === "success",
  ).length;
  const failedFromResults = results.filter(
    (item) => item.status === "failed",
  ).length;
  const storedSuccess = Number(row.success_count) || 0;
  const storedFailed = Number(row.failed_count) || 0;
  const useDerivedCounts =
    successFromResults + failedFromResults >=
    storedSuccess + storedFailed;
  return {
    contestId: String(row.contest_id),
    submissionIds,
    namingPattern,
    videosPerZip: parseVideosPerZip(row.videos_per_zip),
    fileNamePrefix:
      typeof row.file_name_prefix === "string" && row.file_name_prefix.trim()
        ? row.file_name_prefix.trim()
        : "bulk_submissions_contest",
    metaById:
      row.metaById && typeof row.metaById === "object" ? row.metaById : {},
    startedAt: createdMs,
    status: finished
      ? row.status === "failed"
        ? "failed"
        : "finished"
      : "running",
    supabaseJobId: row.id,
    zipParts,
    summaryViewed:
      row.summary_viewed === true || !!row.summary_viewed_at,
    summaryViewedAt: row.summary_viewed_at
      ? String(row.summary_viewed_at)
      : null,
    progress: {
      successCount: useDerivedCounts ? successFromResults : storedSuccess,
      failedCount: useDerivedCounts ? failedFromResults : storedFailed,
      total: Number(row.total_count) || submissionIds.length,
      results,
      finished,
      chunkIndex: Math.max(1, Number(row.zip_part_index) || 1),
      totalChunks: Math.max(
        1,
        Number(row.zip_part_total) || zipParts.length || 1,
      ),
      chunkSize: parseVideosPerZip(row.videos_per_zip),
    },
  };
}

function leanItemStatusesFromProgress(
  results: BulkVideoDownloadResultRow[] | undefined,
  options?: { includePending?: boolean },
): { submissionId: string; status: string; error?: string }[] {
  if (!Array.isArray(results)) return [];
  return results
    .map((row) => ({
      submissionId: row.submissionId,
      // Live `downloaded` is UI-only until the ZIP is ready — persist as pending
      // so reload/resume does not treat the ZIP part as finished.
      status: row.status === "downloaded" ? "pending" : row.status,
      error: row.error,
    }))
    .filter(
      (row) =>
        options?.includePending ||
        row.status === "success" ||
        row.status === "failed",
    );
}

function countTerminalResults(
  results: BulkVideoDownloadResultRow[] | undefined,
): number {
  if (!Array.isArray(results)) return 0;
  return results.filter(
    (row) => row.status === "success" || row.status === "failed",
  ).length;
}

function isResultTerminal(
  status: BulkVideoDownloadResultRow["status"] | undefined,
): boolean {
  return status === "success" || status === "failed";
}

/** First ZIP part that still has pending/unknown videos (0-based). */
function findResumeZipPartIndex(
  zipParts: BulkVideoDownloadZipPartRef[] | undefined,
  results: BulkVideoDownloadResultRow[] | undefined,
): number {
  const parts = Array.isArray(zipParts) ? zipParts : [];
  if (parts.length === 0) return 0;
  const statusById = new Map(
    (results || []).map((row) => [row.submissionId, row.status]),
  );
  for (let i = 0; i < parts.length; i++) {
    const ids = parts[i]?.submissionIds || [];
    if (ids.length === 0) return i;
    const allTerminal = ids.every((id) => isResultTerminal(statusById.get(id)));
    if (!allTerminal) return i;
  }
  return parts.length;
}

function sessionWithDerivedProgress(
  session: BulkVideoDownloadSession,
): BulkVideoDownloadSession {
  const results = session.progress.results || [];
  const derivedSuccess = results.filter(
    (row) => row.status === "success",
  ).length;
  const derivedFailed = results.filter((row) => row.status === "failed").length;
  const resumeIdx = findResumeZipPartIndex(session.zipParts, results);
  const totalParts = Math.max(
    1,
    session.zipParts?.length || session.progress.totalChunks || 1,
  );
  const allTerminal =
    results.length > 0 &&
    derivedSuccess + derivedFailed >= results.length &&
    resumeIdx >= (session.zipParts?.length || 0);

  if (allTerminal && session.status === "running") {
    return {
      ...session,
      status: derivedFailed > 0 && derivedSuccess === 0 ? "failed" : "finished",
      progress: {
        ...session.progress,
        successCount: derivedSuccess,
        failedCount: derivedFailed,
        finished: true,
        chunkIndex: totalParts,
        totalChunks: totalParts,
      },
    };
  }

  // While a ZIP is still downloading, keep live queue counters so the progress
  // bar moves within the batch (derived terminal rows alone lag until the ZIP is ready).
  // Do not rewrite chunkIndex here — provisional per-video successes would jump
  // the batch indicator before the current ZIP file is actually ready.
  if (session.status === "running" && !session.progress.finished) {
    return {
      ...session,
      progress: {
        ...session.progress,
        successCount: Math.max(
          Number(session.progress.successCount) || 0,
          derivedSuccess,
        ),
        failedCount: Math.max(
          Number(session.progress.failedCount) || 0,
          derivedFailed,
        ),
        totalChunks: totalParts,
      },
    };
  }

  return {
    ...session,
    progress: {
      ...session.progress,
      successCount: derivedSuccess,
      failedCount: derivedFailed,
      chunkIndex: Math.min(totalParts, resumeIdx + 1),
      totalChunks: totalParts,
    },
  };
}

async function createRemoteSession(options: {
  id: string;
  session: BulkVideoDownloadSession;
  jobs: {
    jobId: string;
    chunkIndex?: number;
    totalChunks?: number;
    zipPartIndex?: number;
    zipPartTotal?: number;
    submissionIds: string[];
    zipFilename: string;
  }[];
  batchId?: string;
}): Promise<void> {
  try {
    await fetch("/api/admin/bulk-download/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: options.id,
        contestId: options.session.contestId,
        submissionIds: options.session.submissionIds,
        namingPattern: options.session.namingPattern,
        fileNamePrefix: options.session.fileNamePrefix,
        videosPerZip: options.session.videosPerZip,
        zipPartTotal: options.jobs.length,
        zipParts: options.jobs.map((job) => ({
          jobId: job.jobId,
          zipPartIndex: job.zipPartIndex ?? job.chunkIndex ?? 1,
          zipPartTotal:
            job.zipPartTotal ?? job.totalChunks ?? options.jobs.length,
          submissionIds: job.submissionIds,
          zipFilename: job.zipFilename,
        })),
        itemStatuses: leanItemStatusesFromProgress(
          options.session.progress.results,
          { includePending: true },
        ),
      }),
    });
  } catch (error) {
    console.warn("[bulk-video-download] Failed to create Supabase session", error);
  }
}

async function patchRemoteSession(options: {
  id: string;
  session: BulkVideoDownloadSession;
  status?: "running" | "completed" | "failed";
}): Promise<void> {
  try {
    const finished =
      options.status === "completed" || options.status === "failed";
    await fetch("/api/admin/bulk-download/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: options.id,
        status: options.status,
        successCount: options.session.progress.successCount,
        failedCount: options.session.progress.failedCount,
        zipPartIndex: options.session.progress.chunkIndex,
        zipPartTotal: options.session.progress.totalChunks,
        // Progress updates only upsert terminal rows; final write can include all.
        itemStatuses: leanItemStatusesFromProgress(
          options.session.progress.results,
          { includePending: finished },
        ),
      }),
    });
  } catch (error) {
    console.warn("[bulk-video-download] Failed to patch Supabase session", error);
  }
}

export function BulkVideoDownloadProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<BulkVideoDownloadSession | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const runTokenRef = useRef(0);
  const runningRef = useRef(false);
  const sessionRef = useRef<BulkVideoDownloadSession | null>(null);
  const supabaseJobIdRef = useRef<string | null>(null);
  const progressSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const remoteCreatedRef = useRef(false);

  useEffect(() => {
    purgeLegacyBulkDownloadStorage();
  }, []);

  useEffect(() => {
    sessionRef.current = session;
    supabaseJobIdRef.current = session?.supabaseJobId ?? null;
  }, [session]);

  useEffect(() => {
    return () => {
      if (progressSyncTimerRef.current) {
        clearTimeout(progressSyncTimerRef.current);
      }
    };
  }, []);

  const clearSession = useCallback(() => {
    runTokenRef.current += 1;
    runningRef.current = false;
    remoteCreatedRef.current = false;
    setSession(null);
    sessionRef.current = null;
    setStatusOpen(false);
    supabaseJobIdRef.current = null;
  }, []);

  const persistSession = useCallback((next: BulkVideoDownloadSession) => {
    setSession(next);
    sessionRef.current = next;
    supabaseJobIdRef.current = next.supabaseJobId ?? null;
  }, []);

  const scheduleRemoteProgressSync = useCallback(
    (
      next: BulkVideoDownloadSession,
      options?: { immediate?: boolean },
    ) => {
      const jobId = next.supabaseJobId;
      if (!jobId) return;
      if (progressSyncTimerRef.current) {
        clearTimeout(progressSyncTimerRef.current);
        progressSyncTimerRef.current = null;
      }

      const status =
        next.status === "finished"
          ? "completed"
          : next.status === "failed"
            ? "failed"
            : "running";

      // Final writes and per-ZIP completions go immediately so a reload cannot
      // lose the first batch's success/failed rows.
      if (
        options?.immediate ||
        next.status === "finished" ||
        next.status === "failed"
      ) {
        void patchRemoteSession({
          id: jobId,
          session: next,
          status,
        });
        return;
      }

      progressSyncTimerRef.current = setTimeout(() => {
        progressSyncTimerRef.current = null;
        const current = sessionRef.current;
        if (!current || current.supabaseJobId !== jobId) return;
        if (current.status === "finished" || current.status === "failed") {
          return;
        }
        void patchRemoteSession({
          id: jobId,
          session: current,
          status: "running",
        });
      }, SUPABASE_PROGRESS_DEBOUNCE_MS);
    },
    [],
  );

  const runSession = useCallback(
    async (active: BulkVideoDownloadSession) => {
      if (activeDownloadRuns.has(active.startedAt)) return;
      activeDownloadRuns.add(active.startedAt);
      runningRef.current = true;
      const token = ++runTokenRef.current;
      setStatusOpen(true);
      remoteCreatedRef.current = !!active.supabaseJobId;

      const metaById = metaMapFromRecord(active.metaById);
      const resumeJobs =
        active.status === "running" &&
        Array.isArray(active.zipParts) &&
        active.zipParts.length > 0
          ? active.zipParts.map((part) => ({
              jobId: part.jobId,
              chunkIndex: part.zipPartIndex,
              totalChunks: part.zipPartTotal || active.zipParts!.length,
              submissionIds: part.submissionIds,
              zipFilename: part.zipFilename,
            }))
          : undefined;
      const resumeCurrentIndex = resumeJobs
        ? findResumeZipPartIndex(active.zipParts, active.progress.results)
        : undefined;

      // Everything already terminal in Supabase — just show summary.
      if (
        resumeJobs &&
        typeof resumeCurrentIndex === "number" &&
        resumeCurrentIndex >= resumeJobs.length
      ) {
        const finished = sessionWithDerivedProgress({
          ...active,
          status: "finished",
          progress: { ...active.progress, finished: true },
        });
        persistSession(finished);
        setStatusOpen(true);
        if (finished.supabaseJobId) {
          scheduleRemoteProgressSync(finished, { immediate: true });
        }
        activeDownloadRuns.delete(active.startedAt);
        runningRef.current = false;
        return;
      }

      try {
        const result = await downloadSubmissionVideosInChunks({
          submissionIds: active.submissionIds,
          namingPattern: active.namingPattern,
          videosPerZip: active.videosPerZip,
          fileNamePrefix: active.fileNamePrefix,
          metaById,
          existingResults: active.progress.results,
          resumeJobs,
          resumeBatchId: active.supabaseJobId || undefined,
          resumeCurrentIndex,
          onEnqueued: ({ batchId, jobs }) => {
            if (token !== runTokenRef.current) return;
            const current = sessionRef.current;
            if (!current || current.startedAt !== active.startedAt) return;
            const id = batchId || current.supabaseJobId || jobs[0]?.jobId;
            if (!id) return;
            const zipParts: BulkVideoDownloadZipPartRef[] = jobs.map((job) => ({
              jobId: job.jobId,
              zipPartIndex: job.chunkIndex,
              zipPartTotal: job.totalChunks || jobs.length,
              submissionIds: job.submissionIds,
              zipFilename: job.zipFilename,
            }));
            const withId: BulkVideoDownloadSession = {
              ...current,
              supabaseJobId: id,
              zipParts,
              progress: {
                ...current.progress,
                totalChunks: jobs.length || current.progress.totalChunks,
                chunkSize: current.videosPerZip,
              },
            };
            persistSession(withId);
            if (!remoteCreatedRef.current) {
              remoteCreatedRef.current = true;
              void createRemoteSession({
                id,
                batchId,
                session: withId,
                jobs,
              });
            }
          },
          onProgress: ({
            successCount,
            failedCount,
            totalVideos,
            results,
            chunkIndex,
            totalChunks,
            chunkSize,
          }) => {
            if (token !== runTokenRef.current) return;
            const current = sessionRef.current;
            if (!current || current.startedAt !== active.startedAt) return;
            const prevTerminal = countTerminalResults(current.progress.results);
            const nextTerminal = countTerminalResults(results);
            const next: BulkVideoDownloadSession = sessionWithDerivedProgress({
              ...current,
              status: "running",
              progress: {
                successCount,
                failedCount,
                total: totalVideos,
                results,
                finished: false,
                chunkIndex,
                totalChunks,
                chunkSize,
              },
            });
            persistSession(next);
            // Flush as soon as a ZIP part lands terminal rows so reload mid-batch
            // restores accurate counts instead of leaving items as pending.
            scheduleRemoteProgressSync(next, {
              immediate: nextTerminal > prevTerminal,
            });
          },
        });

        if (token !== runTokenRef.current) return;

        if (result.successCount === 0 && result.failedCount === 0) {
          throw new Error(
            result.errors[0] || "Failed to download ZIP archives.",
          );
        }

        const hasPartialFailures =
          result.successCount > 0 && result.failedCount > 0;
        const isTotalFailure =
          result.successCount === 0 && result.failedCount > 0;

        showToast({
          title: isTotalFailure ? "Download failed" : "Download complete",
          description: `${result.totalVideos} selected · ${result.successCount} succeeded · ${result.failedCount} failed`,
          variant: isTotalFailure
            ? "destructive"
            : hasPartialFailures
              ? "pending"
              : "success",
        });

        const current = sessionRef.current;
        const finished = sessionWithDerivedProgress({
          ...active,
          ...(current || {}),
          supabaseJobId:
            current?.supabaseJobId || active.supabaseJobId,
          zipParts: current?.zipParts || active.zipParts,
          namingPattern: current?.namingPattern || active.namingPattern,
          status: isTotalFailure ? "failed" : "finished",
          progress: {
            successCount: result.successCount,
            failedCount: result.failedCount,
            total: result.totalVideos,
            results: result.results,
            finished: true,
            chunkIndex: result.totalChunks,
            totalChunks: result.totalChunks,
            chunkSize: current?.progress.chunkSize || active.videosPerZip,
          },
        });
        persistSession(finished);
        setStatusOpen(true);
        if (finished.supabaseJobId) {
          if (progressSyncTimerRef.current) {
            clearTimeout(progressSyncTimerRef.current);
            progressSyncTimerRef.current = null;
          }
          scheduleRemoteProgressSync(finished, { immediate: true });
        }
      } catch (error: unknown) {
        if (token !== runTokenRef.current) return;
        const message =
          error instanceof Error
            ? error.message
            : "An error occurred while compiling the ZIP folder.";
        showToast({
          title: "Bulk Download Failed",
          description: message,
          variant: "destructive",
        });
        const current = sessionRef.current;
        if (current && current.startedAt === active.startedAt) {
          const failed: BulkVideoDownloadSession = {
            ...current,
            status: "failed",
            progress: {
              ...current.progress,
              finished: true,
            },
          };
          persistSession(failed);
          setStatusOpen(true);
          if (failed.supabaseJobId) {
            if (progressSyncTimerRef.current) {
              clearTimeout(progressSyncTimerRef.current);
              progressSyncTimerRef.current = null;
            }
            scheduleRemoteProgressSync(failed);
          }
        }
      } finally {
        activeDownloadRuns.delete(active.startedAt);
        if (token === runTokenRef.current) {
          runningRef.current = false;
        }
      }
    },
    [persistSession, scheduleRemoteProgressSync],
  );

  const hydrateForContest = useCallback(
    async (contestId: string) => {
      const id = String(contestId);
      if (!id || hydratedContests.has(id)) return;
      hydratedContests.add(id);

      try {
        const res = await fetch(
          `/api/admin/bulk-download/session?contestId=${encodeURIComponent(id)}`,
        );
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const row = data.session as RemoteSessionRow | null;
        const restored = row ? remoteRowToSession(row) : null;
        const local = sessionRef.current;

        // Supabase has no job for this contest → drop browser cache so the
        // summary does not keep showing after DB rows were deleted.
        if (!restored) {
          if (
            local &&
            local.contestId === id &&
            // Don't interrupt an in-tab download that has not synced yet.
            !(runningRef.current && local.status === "running")
          ) {
            clearSession();
          }
          return;
        }

        const pickRemote =
          restored.contestId === id &&
          (!local ||
            local.contestId !== id ||
            (restored.progress.successCount || 0) +
              (restored.progress.failedCount || 0) >
              (local.progress.successCount || 0) +
                (local.progress.failedCount || 0) ||
            (restored.progress.results?.length || 0) >
              (local.progress.results?.length || 0) ||
            restored.startedAt >= local.startedAt);

        if (pickRemote) {
          const normalized = sessionWithDerivedProgress(restored);
          persistSession(normalized);
          if (normalized.status === "running" && !runningRef.current) {
            void runSession(normalized);
          }
          return;
        }

        if (local && local.contestId === id) {
          if (local.status === "running" && !runningRef.current) {
            void runSession(sessionWithDerivedProgress(local));
          }
        }
      } catch (error) {
        console.warn(
          "[bulk-video-download] Failed to hydrate session from Supabase",
          error,
        );
        hydratedContests.delete(id);
      }
    },
    [clearSession, persistSession, runSession],
  );

  const startDownload = useCallback(
    async (params: StartBulkVideoDownloadParams) => {
      const submissionIds = params.submissionIds.filter(Boolean);
      if (submissionIds.length < 2) return;

      if (runningRef.current) {
        showToast({
          title: "Download already in progress",
          description:
            "Hide or wait for the current ZIP download, then start another.",
          variant: "pending",
        });
        setStatusOpen(true);
        return;
      }

      const startedAt = Date.now();
      remoteCreatedRef.current = false;
      const next: BulkVideoDownloadSession = {
        contestId: params.contestId,
        creatorId: params.creatorId ?? null,
        submissionIds,
        namingPattern: params.namingPattern,
        videosPerZip: parseVideosPerZip(params.videosPerZip),
        fileNamePrefix: params.fileNamePrefix,
        metaById: metaRecordFromMap(params.metaById),
        startedAt,
        status: "running",
        supabaseJobId: null,
        progress: {
          successCount: 0,
          failedCount: 0,
          total: submissionIds.length,
          results: submissionIds.map((submissionId) => {
            const meta = params.metaById.get(submissionId);
            return {
              submissionId,
              username: meta?.username ?? "unknown",
              videoTitle: meta?.videoTitle ?? "Untitled",
              link: meta?.link ?? "",
              views: meta?.views ?? 0,
              avatarUrl: meta?.avatarUrl ?? null,
              displayName: meta?.displayName ?? null,
              creatorId: meta?.creatorId ?? null,
              status: "pending",
            } satisfies BulkVideoDownloadResultRow;
          }),
          finished: false,
          chunkIndex: 1,
          totalChunks: 1,
          chunkSize: parseVideosPerZip(params.videosPerZip),
        },
      };
      persistSession(next);
      await runSession(next);
    },
    [persistSession, runSession],
  );

  const openVideoSummary = useCallback(() => {
    const current = sessionRef.current;
    setStatusOpen(true);
    if (!current) return;
    const finished =
      current.status === "finished" ||
      current.status === "failed" ||
      !!current.progress.finished;
    if (!finished || current.summaryViewed) return;

    const viewedAt = new Date().toISOString();
    const next: BulkVideoDownloadSession = {
      ...current,
      summaryViewed: true,
      summaryViewedAt: viewedAt,
    };
    persistSession(next);

    const jobId = current.supabaseJobId;
    if (!jobId) return;
    void fetch("/api/admin/bulk-download/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: jobId, summaryViewed: true }),
    }).catch((error) => {
      console.warn(
        "[bulk-video-download] Failed to mark summary viewed",
        error,
      );
    });
  }, [persistSession]);

  const downloading = session?.status === "running";
  const progress = session?.progress ?? null;

  const value = useMemo<BulkVideoDownloadProgressContextValue>(
    () => ({
      session,
      progress,
      downloading: !!downloading,
      statusOpen,
      setStatusOpen,
      openVideoSummary,
      startDownload,
      clearSession,
      isBusyForContest: (contestId: string) =>
        !!session &&
        session.contestId === contestId &&
        session.status === "running",
      hasSessionForContest: (contestId: string) =>
        !!session && session.contestId === String(contestId),
      hydrateForContest,
    }),
    [
      session,
      progress,
      downloading,
      statusOpen,
      openVideoSummary,
      startDownload,
      clearSession,
      hydrateForContest,
    ],
  );

  return (
    <BulkVideoDownloadProgressContext.Provider value={value}>
      {children}
    </BulkVideoDownloadProgressContext.Provider>
  );
}

export function useBulkVideoDownloadProgress() {
  const value = useContext(BulkVideoDownloadProgressContext);
  if (!value) {
    throw new Error(
      "useBulkVideoDownloadProgress must be used within BulkVideoDownloadProgressProvider",
    );
  }
  return value;
}
