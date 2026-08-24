import {
  parseVideoFilenamePattern,
  type VideoFilenamePattern,
} from "@/lib/video-download-filename";

export type { VideoFilenamePattern };

/** Max videos per ZIP job (must match server `MAX_BULK_VIDEO_DOWNLOADS`). */
export const MAX_BULK_VIDEO_DOWNLOADS = 100;
/** Minimum videos per ZIP; 0 is allowed in the input but not used for download. */
export const MIN_BULK_VIDEO_DOWNLOADS = 1;
/** Default videos per ZIP when the user has not chosen a batch size. */
export const DEFAULT_VIDEOS_PER_ZIP = 10;

export function parseVideosPerZip(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_VIDEOS_PER_ZIP;
  return Math.min(
    MAX_BULK_VIDEO_DOWNLOADS,
    Math.max(MIN_BULK_VIDEO_DOWNLOADS, n),
  );
}

/** Pause between ZIP downloads so browsers allow multiple automatic downloads. */
const BULK_CHUNK_DOWNLOAD_GAP_MS = 2500;
const NATIVE_DOWNLOAD_SETTLE_MS = 2000;
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

const PENDING_BULK_ZIP_KEY = "goc-bulk-zip-pending";

export type PendingBulkZipJob = {
  jobId: string;
  fileName: string;
  submissionIds: string[];
  startedAt: number;
  chunkIndex: number;
};

function sameIdList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, index) => id === right[index]);
}

export function readPendingBulkZipJob(): PendingBulkZipJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_BULK_ZIP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingBulkZipJob;
    if (
      !parsed?.jobId ||
      !parsed?.fileName ||
      !Array.isArray(parsed.submissionIds) ||
      typeof parsed.startedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.startedAt >= QUEUED_DOWNLOAD_TIMEOUT_MS) {
      clearPendingBulkZipJob();
      return null;
    }
    return {
      ...parsed,
      chunkIndex:
        typeof parsed.chunkIndex === "number" && parsed.chunkIndex > 0
          ? parsed.chunkIndex
          : 1,
    };
  } catch {
    return null;
  }
}

function writePendingBulkZipJob(job: PendingBulkZipJob): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_BULK_ZIP_KEY, JSON.stringify(job));
  } catch {
    // ignore quota / private-mode failures
  }
}

export function clearPendingBulkZipJob(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_BULK_ZIP_KEY);
  } catch {
    // ignore
  }
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    window.URL.revokeObjectURL(url);
  }, 120_000);
}

/**
 * One hidden iframe. Content-Disposition: attachment saves the file.
 * Do not also click an <a> — that starts a second download of the same ZIP.
 */
function triggerNativeZipDownload(url: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), 120_000);
}

export function parseBulkZipFileResponse(options: {
  ok: boolean;
  status: number;
  contentType: string;
  payload?: { error?: string; url?: string; filename?: string };
}):
  | { kind: "retry" }
  | { kind: "blob" }
  | { kind: "signed-url"; url: string }
  | { kind: "error"; error: string } {
  if (options.status === 409) return { kind: "retry" };
  const json =
    options.contentType.includes("application/json") || !options.ok;
  if (!json) return { kind: "blob" };
  const url =
    typeof options.payload?.url === "string" ? options.payload.url.trim() : "";
  if (url) return { kind: "signed-url", url };
  return {
    kind: "error",
    error: options.payload?.error || "Failed to download queued ZIP.",
  };
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
): Promise<{
  downloaded: boolean;
  completed: number;
  failed: number;
  total: number;
  error?: string;
}> {
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
      completed: last.completed,
      failed: last.failed,
      total: last.total,
      status: String(statusRes.data.status || "queued"),
    });

    if (statusRes.data.status === "ready") {
      const fileUrl = `/api/admin/bulk-download/file?jobId=${encodeURIComponent(jobId)}&filename=${encodeURIComponent(fileName)}&proxy=1`;
      triggerNativeZipDownload(fileUrl);
      await sleep(NATIVE_DOWNLOAD_SETTLE_MS);
      return {
        downloaded: true,
        completed: last.completed,
        failed: last.failed,
        total: last.total,
      };
    }

    if (statusRes.data.status === "failed") {
      clearPendingBulkZipJob();
      const firstError = statusRes.data.errors?.[0];
      return {
        downloaded: false,
        completed: last.completed,
        failed: Math.max(last.failed, last.total || 0),
        total: last.total,
        error: firstError || "Queued video download failed.",
      };
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

  const pollQueued = async (jobId: string, fileName: string) => {
    writePendingBulkZipJob({
      jobId,
      fileName,
      submissionIds: chunk,
      startedAt: Date.now(),
      chunkIndex: options.chunkIndex,
    });
    const queued = await waitForQueuedZipJob(
      jobId,
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
    clearPendingBulkZipJob();
    if (queued.error) {
      errors.push(queued.error);
    }
    return {
      successCount: queued.completed,
      failedCount: Math.max(
        queued.failed,
        Math.max(0, chunk.length - queued.completed),
      ),
      downloaded: queued.downloaded,
      errors,
    };
  };

  const pending = readPendingBulkZipJob();
  if (pending && sameIdList(pending.submissionIds, chunk)) {
    try {
      return await pollQueued(pending.jobId, pending.fileName);
    } catch (error) {
      if (error instanceof Error && /timed out/i.test(error.message)) {
        throw error;
      }
      clearPendingBulkZipJob();
    }
  }

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
      return pollQueued(payload.jobId, fileName);
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
 * Downloads selected submissions as ZIP batches of at most `videosPerZip`
 * (1–MAX_BULK_VIDEO_DOWNLOADS). When Redis is configured, each batch is enqueued
 * and downloaded as a same-origin blob once the single ZIP is ready
 * (time-budget leftovers stay on the same job).
 */
export async function downloadSubmissionVideosInChunks(options: {
  submissionIds: string[];
  fileNamePrefix: string;
  namingPattern?: VideoFilenamePattern;
  videosPerZip?: number;
  onProgress?: (info: BulkDownloadProgressInfo) => void;
}): Promise<ChunkedBulkDownloadResult> {
  const namingPattern = parseVideoFilenamePattern(options.namingPattern);
  const ids = options.submissionIds.filter(Boolean);
  const chunks = chunkArray(ids, parseVideosPerZip(options.videosPerZip));
  const errors: string[] = [];
  let succeededChunks = 0;
  let successCount = 0;
  let failedCount = 0;
  const pending = readPendingBulkZipJob();
  const resumeAt = pending
    ? chunks.findIndex((chunk) => sameIdList(chunk, pending.submissionIds))
    : -1;
  const startIndex = resumeAt >= 0 ? resumeAt : 0;

  for (let i = startIndex; i < chunks.length; i++) {
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
