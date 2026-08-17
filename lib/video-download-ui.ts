import {
  parseVideoFilenamePattern,
  type VideoFilenamePattern,
} from "@/lib/video-download-filename";

export type { VideoFilenamePattern };

/** Max selected videos per bulk ZIP request (must match server `MAX_BULK_VIDEO_DOWNLOADS`). */
export const MAX_BULK_VIDEO_DOWNLOADS = 200;

const QUEUED_DOWNLOAD_POLL_MS = 2000;
const QUEUED_DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Client/server helper: whether a submission can be downloaded as IG/YT video.
 */
export function canDownloadSubmissionVideo(input: {
  platform?: string | null;
  contestPlatform?: string | null;
  contentLink?: string | null;
}): boolean {
  const platform = (input.platform || input.contestPlatform || "").toLowerCase();
  const link = input.contentLink || "";

  if (platform.includes("tiktok")) return false;

  const isInstagram =
    platform.includes("instagram") || link.includes("instagram.com");
  const isYouTube =
    platform.includes("youtube") ||
    link.includes("youtube.com") ||
    /youtu\.?be/i.test(link);

  return isInstagram || isYouTube;
}

export function canBulkDownloadContestVideos(contestPlatform?: string | null): boolean {
  const platform = (contestPlatform || "").toLowerCase();
  if (platform.includes("tiktok")) return false;
  return platform.includes("instagram") || platform.includes("youtube");
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ChunkedBulkDownloadResult = {
  totalVideos: number;
  totalChunks: number;
  succeededChunks: number;
  failedChunks: number;
  successCount: number;
  failedCount: number;
  errors: string[];
};

export type BulkDownloadProgressInfo = {
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
  totalVideos: number;
  successCount: number;
  failedCount: number;
  queuedCompleted?: number;
  queuedFailed?: number;
  queuedTotal?: number;
  queueStatus?: string;
};

async function waitForQueuedZipJob(
  jobId: string,
  onProgress?: (info: {
    completed: number;
    failed: number;
    total: number;
    status: string;
  }) => void,
): Promise<{ blob: Blob | null; completed: number; failed: number; total: number }> {
  const started = Date.now();
  let last = { completed: 0, failed: 0, total: 0 };
  while (Date.now() - started < QUEUED_DOWNLOAD_TIMEOUT_MS) {
    const statusRes = await fetch(
      `/api/admin/bulk-download/status?jobId=${encodeURIComponent(jobId)}`,
    );
    const status = await statusRes.json().catch(() => ({}));
    if (!statusRes.ok) {
      throw new Error(status.error || "Failed to check download queue status.");
    }

    last = {
      completed: Number(status.completed) || 0,
      failed: Number(status.failed) || 0,
      total: Number(status.total) || 0,
    };
    onProgress?.({
      ...last,
      status: String(status.status || "queued"),
    });

    if (status.status === "ready") {
      const fileRes = await fetch(
        `/api/admin/bulk-download/file?jobId=${encodeURIComponent(jobId)}`,
      );
      if (!fileRes.ok) {
        const errorData = await fileRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to download queued ZIP.");
      }
      return { blob: await fileRes.blob(), ...last };
    }

    if (status.status === "failed") {
      return { blob: null, ...last };
    }

    await sleep(QUEUED_DOWNLOAD_POLL_MS);
  }
  throw new Error("Timed out waiting for queued video download.");
}

/**
 * Downloads the selected submissions into a single ZIP.
 * When Redis is configured, the job is enqueued and polled until that ZIP is ready.
 */
export async function downloadSubmissionVideosInChunks(options: {
  submissionIds: string[];
  fileNamePrefix: string;
  namingPattern?: VideoFilenamePattern;
  onProgress?: (info: BulkDownloadProgressInfo) => void;
}): Promise<ChunkedBulkDownloadResult> {
  const namingPattern = parseVideoFilenamePattern(options.namingPattern);
  const ids = options.submissionIds.filter(Boolean);
  const errors: string[] = [];

  const emitProgress = (info: {
    successCount: number;
    failedCount: number;
    queuedCompleted?: number;
    queuedFailed?: number;
    queuedTotal?: number;
    queueStatus?: string;
  }) => {
    options.onProgress?.({
      chunkIndex: 1,
      totalChunks: 1,
      chunkSize: ids.length,
      totalVideos: ids.length,
      successCount: info.successCount,
      failedCount: info.failedCount,
      queuedCompleted: info.queuedCompleted,
      queuedFailed: info.queuedFailed,
      queuedTotal: info.queuedTotal,
      queueStatus: info.queueStatus,
    });
  };

  emitProgress({ successCount: 0, failedCount: 0 });

  try {
    const response = await fetch("/api/admin/bulk-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionIds: ids,
        namingPattern,
      }),
    });

    const contentType = response.headers.get("content-type");
    if (!response.ok || contentType?.includes("application/json")) {
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.queued && typeof payload.jobId === "string") {
        const queued = await waitForQueuedZipJob(payload.jobId, (queueInfo) => {
          emitProgress({
            queuedCompleted: queueInfo.completed,
            queuedFailed: queueInfo.failed,
            queuedTotal: queueInfo.total,
            queueStatus: queueInfo.status,
            successCount: queueInfo.completed,
            failedCount: queueInfo.failed,
          });
        });
        if (queued.blob && queued.blob.size > 0) {
          triggerBrowserDownload(
            queued.blob,
            `${options.fileNamePrefix}_${Date.now()}.zip`,
          );
        }
        return {
          totalVideos: ids.length,
          totalChunks: 1,
          succeededChunks: queued.blob && queued.blob.size > 0 ? 1 : 0,
          failedChunks: 0,
          successCount: queued.completed,
          failedCount: Math.max(0, ids.length - queued.completed),
          errors,
        };
      }
      if (typeof payload.failed === "number") {
        const successCount = Number(payload.completed) || 0;
        const failedCount = Number(payload.failed) || ids.length;
        emitProgress({ successCount, failedCount });
        return {
          totalVideos: ids.length,
          totalChunks: 1,
          succeededChunks: 0,
          failedChunks: 0,
          successCount,
          failedCount: Math.max(failedCount, ids.length - successCount),
          errors: payload.error ? [String(payload.error)] : errors,
        };
      }
      throw new Error(payload.error || "Failed to download ZIP archive.");
    }

    const blob = await response.blob();
    const successCount = Number(response.headers.get("X-Bulk-Downloaded")) || ids.length;
    const failedCount = Number(response.headers.get("X-Bulk-Failed")) || 0;
    triggerBrowserDownload(blob, `${options.fileNamePrefix}_${Date.now()}.zip`);
    emitProgress({ successCount, failedCount });
    return {
      totalVideos: ids.length,
      totalChunks: 1,
      succeededChunks: 1,
      failedChunks: 0,
      successCount,
      failedCount,
      errors,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Bulk download failed";
    errors.push(message);
    emitProgress({ successCount: 0, failedCount: 0 });
    return {
      totalVideos: ids.length,
      totalChunks: 1,
      succeededChunks: 0,
      failedChunks: 1,
      successCount: 0,
      failedCount: 0,
      errors,
    };
  }
}
