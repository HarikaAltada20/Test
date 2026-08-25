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
  BulkVideoDownloadStatusButton,
  BulkVideoDownloadStatusDialog,
} from "@/components/BulkVideoDownloadStatusDialog";
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

const STORAGE_KEY = "goc-bulk-video-download-session-v1";
const SESSION_TTL_MS = 15 * 60 * 1000;
/** Survives React Strict Mode remounts so the same session is not started twice. */
const activeDownloadRuns = new Set<number>();

export type BulkVideoDownloadSession = {
  contestId: string;
  scope: "normal" | "creator";
  creatorId?: string | null;
  submissionIds: string[];
  namingPattern: VideoFilenamePattern;
  videosPerZip: number;
  fileNamePrefix: string;
  metaById: Record<string, BulkVideoDownloadSubmissionMeta>;
  progress: BulkVideoDownloadProgressState;
  startedAt: number;
  status: "running" | "finished" | "failed";
};

type StartBulkVideoDownloadParams = {
  contestId: string;
  scope: "normal" | "creator";
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
  startDownload: (params: StartBulkVideoDownloadParams) => Promise<void>;
  clearSession: () => void;
  isBusyForContest: (contestId: string) => boolean;
};

const BulkVideoDownloadProgressContext =
  createContext<BulkVideoDownloadProgressContextValue | null>(null);

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

function writeStoredSession(session: BulkVideoDownloadSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (!session) {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const payload = JSON.stringify(session);
    localStorage.setItem(STORAGE_KEY, payload);
    sessionStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // ignore quota / private mode
  }
}

function parseStoredSession(raw: string | null): BulkVideoDownloadSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BulkVideoDownloadSession;
    if (
      !parsed?.contestId ||
      !Array.isArray(parsed.submissionIds) ||
      parsed.submissionIds.length < 2 ||
      typeof parsed.startedAt !== "number" ||
      !parsed.progress
    ) {
      return null;
    }
    if (Date.now() - parsed.startedAt >= SESSION_TTL_MS) {
      writeStoredSession(null);
      return null;
    }
    const namingPattern = isVideoFilenamePattern(parsed.namingPattern)
      ? parsed.namingPattern
      : DEFAULT_VIDEO_FILENAME_PATTERN;
    return {
      ...parsed,
      namingPattern,
      videosPerZip: parseVideosPerZip(parsed.videosPerZip),
      fileNamePrefix:
        typeof parsed.fileNamePrefix === "string" && parsed.fileNamePrefix.trim()
          ? parsed.fileNamePrefix.trim()
          : "bulk_submissions_contest",
      metaById:
        parsed.metaById && typeof parsed.metaById === "object"
          ? parsed.metaById
          : {},
      status:
        parsed.status === "finished" || parsed.status === "failed"
          ? parsed.status
          : "running",
    };
  } catch {
    return null;
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

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const read = () => {
      const mode = document.querySelector("[data-mode]")?.getAttribute("data-mode");
      setIsDark(mode === "dark");
    };
    read();
    const observer = new MutationObserver(read);
    const target = document.querySelector("[data-mode]");
    if (target) {
      observer.observe(target, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }
    return () => observer.disconnect();
  }, []);
  return isDark;
}

export function BulkVideoDownloadProgressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const initial = useMemo(() => parseStoredSession(readStorageRaw()), []);
  const [session, setSession] = useState<BulkVideoDownloadSession | null>(initial);
  const [statusOpen, setStatusOpen] = useState(false);
  const [dismissedUi, setDismissedUi] = useState(false);
  const runTokenRef = useRef(0);
  const runningRef = useRef(false);
  const sessionRef = useRef<BulkVideoDownloadSession | null>(initial);
  const isDark = useIsDarkMode();

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const clearSession = useCallback(() => {
    runTokenRef.current += 1;
    runningRef.current = false;
    writeStoredSession(null);
    setSession(null);
    setStatusOpen(false);
    setDismissedUi(false);
  }, []);

  const persistSession = useCallback((next: BulkVideoDownloadSession) => {
    writeStoredSession(next);
    setSession(next);
    sessionRef.current = next;
  }, []);

  const runSession = useCallback(
    async (active: BulkVideoDownloadSession) => {
      if (activeDownloadRuns.has(active.startedAt)) return;
      activeDownloadRuns.add(active.startedAt);
      runningRef.current = true;
      const token = ++runTokenRef.current;
      setDismissedUi(false);
      setStatusOpen(true);

      const metaById = metaMapFromRecord(active.metaById);
      try {
        const result = await downloadSubmissionVideosInChunks({
          submissionIds: active.submissionIds,
          namingPattern: active.namingPattern,
          videosPerZip: active.videosPerZip,
          fileNamePrefix: active.fileNamePrefix,
          metaById,
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
            const next: BulkVideoDownloadSession = {
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
            };
            persistSession(next);
          },
        });

        if (token !== runTokenRef.current) return;

        if (result.successCount === 0 && result.failedCount === 0) {
          throw new Error(result.errors[0] || "Failed to download ZIP archives.");
        }

        const hasPartialFailures =
          result.successCount > 0 && result.failedCount > 0;
        const isTotalFailure =
          result.successCount === 0 && result.failedCount > 0;

        showToast({
          title: isTotalFailure
            ? "Download failed"
            : "Download complete",
          description: `${result.totalVideos} selected · ${result.successCount} succeeded · ${result.failedCount} failed`,
          variant: isTotalFailure
            ? "destructive"
            : hasPartialFailures
              ? "pending"
              : "success",
        });

        const finished: BulkVideoDownloadSession = {
          ...active,
          status: isTotalFailure ? "failed" : "finished",
          progress: {
            successCount: result.successCount,
            failedCount: result.failedCount,
            total: result.totalVideos,
            results: result.results,
            finished: true,
            chunkIndex: result.totalChunks,
            totalChunks: result.totalChunks,
          },
        };
        persistSession(finished);
        setStatusOpen(true);
        setDismissedUi(false);
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
          persistSession({
            ...current,
            status: "failed",
            progress: {
              ...current.progress,
              finished: true,
            },
          });
          setStatusOpen(true);
        }
      } finally {
        activeDownloadRuns.delete(active.startedAt);
        if (token === runTokenRef.current) {
          runningRef.current = false;
        }
      }
    },
    [persistSession],
  );

  useEffect(() => {
    if (!initial) return;
    if (initial.status === "running") {
      void runSession(initial);
      return;
    }
    // Finished summary stays available until dismissed.
    setDismissedUi(false);
  }, [initial, runSession]);

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
        setDismissedUi(false);
        return;
      }

      const startedAt = Date.now();
      const next: BulkVideoDownloadSession = {
        contestId: params.contestId,
        scope: params.scope,
        creatorId: params.creatorId ?? null,
        submissionIds,
        namingPattern: params.namingPattern,
        videosPerZip: parseVideosPerZip(params.videosPerZip),
        fileNamePrefix: params.fileNamePrefix,
        metaById: metaRecordFromMap(params.metaById),
        startedAt,
        status: "running",
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

  const downloading = session?.status === "running";
  const progress = session?.progress ?? null;
  const showFloating =
    !!session &&
    !statusOpen &&
    !dismissedUi &&
    (downloading ||
      !!session.progress.finished ||
      (session.progress.results?.length ?? 0) > 0);

  const value = useMemo<BulkVideoDownloadProgressContextValue>(
    () => ({
      session,
      progress,
      downloading: !!downloading,
      statusOpen,
      setStatusOpen: (open) => {
        setStatusOpen(open);
        if (open) setDismissedUi(false);
      },
      startDownload,
      clearSession,
      isBusyForContest: (contestId: string) =>
        !!session &&
        session.contestId === contestId &&
        session.status === "running",
    }),
    [
      session,
      progress,
      downloading,
      statusOpen,
      startDownload,
      clearSession,
    ],
  );

  return (
    <BulkVideoDownloadProgressContext.Provider value={value}>
      {children}
      <BulkVideoDownloadStatusDialog
        open={statusOpen && !!session}
        onOpenChange={(open) => {
          setStatusOpen(open);
          if (!open) setDismissedUi(false);
        }}
        isDark={isDark}
        downloading={!!downloading}
        progress={progress}
      />
      {showFloating && (
        <BulkVideoDownloadStatusButton
          floating
          isDark={isDark}
          downloading={!!downloading}
          progress={progress}
          onClick={() => {
            setStatusOpen(true);
            setDismissedUi(false);
          }}
        />
      )}
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
