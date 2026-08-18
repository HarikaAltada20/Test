import {
  parseVideoFilenamePattern,
  type VideoFilenamePattern,
} from "@/lib/video-download-filename";

export type { VideoFilenamePattern };

/** Max videos per ZIP job (must match server `MAX_BULK_VIDEO_DOWNLOADS`). */
export const MAX_BULK_VIDEO_DOWNLOADS = 10;

/** Pause between ZIP downloads so browsers allow multiple automatic downloads. */
const BULK_CHUNK_DOWNLOAD_GAP_MS = 700;
const QUEUED_DOWNLOAD_POLL_MS = 2000;
const QUEUED_DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000;

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
  document.body.removeChild(a);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

async function downloadZipFromUrl(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }
    triggerBrowserDownload(await response.blob(), filename);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Download failed")) {
      throw error;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

function isNetworkFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|load failed/i.test(message);
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

async function fetchJsonWithRetry<T>(
  url: string,
  options?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, options);
      const data = (await response.json().catch(() => ({}))) as T;
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      lastError = error;
      if (!isNetworkFetchError(error) || attempt === 2) {
        throw error;
      }
      await sleep(800 * (attempt + 1));
    }
  }
  throw lastError;
}

async function waitForQueuedZipJob(
  jobId: string,
  fileName: string,
  onProgress?: (info: {
    completed: number;
    failed: number;
    total: number;
    status: string;
  }) => void,
  depth = 0,
): Promise<{ downloaded: boolean; completed: number; failed: number; total: number }> {
  if (depth > 8) {
    throw new Error("Timed out following continued ZIP jobs.");
  }
  const started = Date.now();
  let last = { completed: 0, failed: 0, total: 0 };
  while (Date.now() - started < QUEUED_DOWNLOAD_TIMEOUT_MS) {
    const statusRes = await fetchJsonWithRetry<{
      error?: string;
      status?: string;
      completed?: number;
      failed?: number;
      total?: number;
      errors?: string[];
      continuationJobId?: string | null;
    }>(`/api/admin/bulk-download/status?jobId=${encodeURIComponent(jobId)}`);
    if (!statusRes.ok) {
      throw new Error(statusRes.data.error || "Failed to check download queue status.");
    }

    last = {
      completed: Number(statusRes.data.completed) || 0,
      failed: Number(statusRes.data.failed) || 0,
      total: Number(statusRes.data.total) || 0,
    };
    onProgress?.({
      ...last,
      status: String(statusRes.data.status || "queued"),
    });

    if (statusRes.data.status === "ready") {
      const fileRes = await fetchJsonWithRetry<{
        error?: string;
        url?: string;
        filename?: string;
      }>(
        `/api/admin/bulk-download/file?jobId=${encodeURIComponent(jobId)}&filename=${encodeURIComponent(fileName)}`,
      );
      if (!fileRes.ok || !fileRes.data.url) {
        if (fileRes.status === 409) {
          await sleep(QUEUED_DOWNLOAD_POLL_MS);
          continue;
        }
        throw new Error(fileRes.data.error || "Failed to download queued ZIP.");
      }
      await downloadZipFromUrl(
        fileRes.data.url,
        fileRes.data.filename || fileName,
      );
      const continuationJobId = statusRes.data.continuationJobId?.trim();
      if (continuationJobId) {
        const continued = await waitForQueuedZipJob(
          continuationJobId,
          fileName,
          onProgress,
          depth + 1,
        );
        return {
          downloaded: true,
          completed: last.completed + continued.completed,
          failed: last.failed + continued.failed,
          total: last.total + continued.total,
        };
      }
      return {
        downloaded: true,
        completed: last.completed,
        failed: last.failed,
        total: last.total,
      };
    }

    if (statusRes.data.status === "failed") {
      const firstError = statusRes.data.errors?.[0];
      throw new Error(firstError || "Queued video download failed.");
    }

    await sleep(QUEUED_DOWNLOAD_POLL_MS);
  }
  throw new Error("Timed out waiting for queued video download.");
}

async function downloadOneZipChunk(options: {
  submissionIds: string[];
  fileNamePrefix: string;
  namingPattern: VideoFilenamePattern;
  chunkIndex: number;
  totalChunks: number;
  totalVideos: number;
  onProgress?: (info: BulkDownloadProgressInfo) => void;
}): Promise<{
  successCount: number;
  failedCount: number;
  downloaded: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  const chunk = options.submissionIds;

  const emit = (info: {
    successCount: number;
    failedCount: number;
    queuedCompleted?: number;
    queuedFailed?: number;
    queuedTotal?: number;
    queueStatus?: string;
  }) => {
    options.onProgress?.({
      chunkIndex: options.chunkIndex,
      totalChunks: options.totalChunks,
      chunkSize: chunk.length,
      totalVideos: options.totalVideos,
      successCount: info.successCount,
      failedCount: info.failedCount,
      queuedCompleted: info.queuedCompleted,
      queuedFailed: info.queuedFailed,
      queuedTotal: info.queuedTotal,
      queueStatus: info.queueStatus,
    });
  };

  const response = await fetch("/api/admin/bulk-download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      submissionIds: chunk,
      namingPattern: options.namingPattern,
      zipFilename: `${options.fileNamePrefix}.zip`,
    }),
  });

  const contentType = response.headers.get("content-type");
  if (!response.ok || contentType?.includes("application/json")) {
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.queued && typeof payload.jobId === "string") {
      const fileName = `${options.fileNamePrefix}_${Date.now()}.zip`;
      const queued = await waitForQueuedZipJob(
        payload.jobId,
        fileName,
        (queueInfo) => {
          emit({
            queuedCompleted: queueInfo.completed,
            queuedFailed: queueInfo.failed,
            queuedTotal: queueInfo.total,
            queueStatus: queueInfo.status,
            successCount: queueInfo.completed,
            failedCount: queueInfo.failed,
          });
        },
      );
      return {
        successCount: queued.completed,
        failedCount: Math.max(0, chunk.length - queued.completed),
        downloaded: queued.downloaded,
        errors,
      };
    }
    if (typeof payload.failed === "number") {
      const successCount = Number(payload.completed) || 0;
      const failedCount = Number(payload.failed) || chunk.length;
      emit({ successCount, failedCount });
      return {
        successCount,
        failedCount: Math.max(failedCount, chunk.length - successCount),
        downloaded: false,
        errors: payload.error ? [String(payload.error)] : errors,
      };
    }
    throw new Error(payload.error || "Failed to download ZIP archive.");
  }

  const blob = await response.blob();
  const successCount = Number(response.headers.get("X-Bulk-Downloaded")) || chunk.length;
  const failedCount = Number(response.headers.get("X-Bulk-Failed")) || 0;
  triggerBrowserDownload(blob, `${options.fileNamePrefix}_${Date.now()}.zip`);
  emit({ successCount, failedCount });
  return {
    successCount,
    failedCount,
    downloaded: true,
    errors,
  };
}

/**
 * Downloads selected submissions as ZIP batches of at most MAX_BULK_VIDEO_DOWNLOADS.
 * When Redis is configured, each batch is enqueued and the browser is sent a
 * signed storage URL (the ZIP is not proxied through Next.js).
 */
export async function downloadSubmissionVideosInChunks(options: {
  submissionIds: string[];
  fileNamePrefix: string;
  namingPattern?: VideoFilenamePattern;
  onProgress?: (info: BulkDownloadProgressInfo) => void;
}): Promise<ChunkedBulkDownloadResult> {
  const namingPattern = parseVideoFilenamePattern(options.namingPattern);
  const ids = options.submissionIds.filter(Boolean);
  const chunks = chunkArray(ids, MAX_BULK_VIDEO_DOWNLOADS);
  const errors: string[] = [];
  let succeededChunks = 0;
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const partSuffix =
      chunks.length > 1 ? `_part_${i + 1}_of_${chunks.length}` : "";

    options.onProgress?.({
      chunkIndex: i + 1,
      totalChunks: chunks.length,
      chunkSize: chunk.length,
      totalVideos: ids.length,
      successCount,
      failedCount,
    });

    try {
      const result = await downloadOneZipChunk({
        submissionIds: chunk,
        fileNamePrefix: `${options.fileNamePrefix}${partSuffix}`,
        namingPattern,
        chunkIndex: i + 1,
        totalChunks: chunks.length,
        totalVideos: ids.length,
        onProgress: (info) => {
          options.onProgress?.({
            ...info,
            successCount: successCount + info.successCount,
            failedCount: failedCount + info.failedCount,
          });
        },
      });
      successCount += result.successCount;
      failedCount += result.failedCount;
      errors.push(...result.errors);
      if (result.downloaded) succeededChunks += 1;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : `Batch ${i + 1} failed`;
      errors.push(message);
      failedCount += chunk.length;
    }

    if (i < chunks.length - 1) {
      await sleep(BULK_CHUNK_DOWNLOAD_GAP_MS);
    }
  }

  return {
    totalVideos: ids.length,
    totalChunks: chunks.length,
    succeededChunks,
    failedChunks: chunks.length - succeededChunks,
    successCount,
    failedCount,
    errors,
  };
}
