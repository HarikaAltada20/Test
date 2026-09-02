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
  const platform = (
    input.platform ||
    input.contestPlatform ||
    ""
  ).toLowerCase();
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

export function canBulkDownloadContestVideos(
  contestPlatform?: string | null,
): boolean {
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
/** In-tab only (no localStorage). Survives React remounts within the same page load. */
let memoryPendingBulkZipSession: PendingBulkZipSession | null = null;

export type PendingBulkZipJobPart = {
  jobId: string;
  fileName: string;
  submissionIds: string[];
  chunkIndex: number;
};

/** Multi-ZIP queue session held in memory while the tab is open. */
export type PendingBulkZipSession = {
  batchId?: string;
  jobs: PendingBulkZipJobPart[];
  currentIndex: number;
  startedAt: number;
};

/** @deprecated single-job shape; still accepted when reading older in-memory snapshots. */
export type PendingBulkZipJob = PendingBulkZipJobPart & {
  startedAt: number;
};

function sameIdList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, index) => id === right[index]);
}

function parsePendingBulkZipSession(raw: string): PendingBulkZipSession | null {
  const parsed = JSON.parse(raw) as PendingBulkZipSession & PendingBulkZipJob;
  if (Array.isArray(parsed.jobs) && parsed.jobs.length > 0) {
    const jobs = parsed.jobs.filter(
      (job): job is PendingBulkZipJobPart =>
        !!job &&
        typeof job.jobId === "string" &&
        typeof job.fileName === "string" &&
        Array.isArray(job.submissionIds),
    );
    if (jobs.length === 0) return null;
    if (Date.now() - Number(parsed.startedAt) >= QUEUED_DOWNLOAD_TIMEOUT_MS) {
      return null;
    }
    return {
      batchId: typeof parsed.batchId === "string" ? parsed.batchId : undefined,
      jobs,
      currentIndex: Math.max(
        0,
        Math.min(
          jobs.length - 1,
          typeof parsed.currentIndex === "number" ? parsed.currentIndex : 0,
        ),
      ),
      startedAt: Number(parsed.startedAt) || Date.now(),
    };
  }

  // Legacy single-job pending record.
  if (
    !parsed?.jobId ||
    !parsed?.fileName ||
    !Array.isArray(parsed.submissionIds) ||
    typeof parsed.startedAt !== "number"
  ) {
    return null;
  }
  if (Date.now() - parsed.startedAt >= QUEUED_DOWNLOAD_TIMEOUT_MS) {
    return null;
  }
  return {
    jobs: [
      {
        jobId: parsed.jobId,
        fileName: parsed.fileName,
        submissionIds: parsed.submissionIds,
        chunkIndex:
          typeof parsed.chunkIndex === "number" && parsed.chunkIndex > 0
            ? parsed.chunkIndex
            : 1,
      },
    ],
    currentIndex: 0,
    startedAt: parsed.startedAt,
  };
}

export function readPendingBulkZipSession(): PendingBulkZipSession | null {
  const session = memoryPendingBulkZipSession;
  if (!session) return null;
  if (Date.now() - Number(session.startedAt) >= QUEUED_DOWNLOAD_TIMEOUT_MS) {
    clearPendingBulkZipJob();
    return null;
  }
  return session;
}

/** @deprecated use readPendingBulkZipSession */
export function readPendingBulkZipJob(): PendingBulkZipJob | null {
  const session = readPendingBulkZipSession();
  if (!session) return null;
  const current = session.jobs[session.currentIndex] || session.jobs[0];
  if (!current) return null;
  return { ...current, startedAt: session.startedAt };
}

function writePendingBulkZipSession(session: PendingBulkZipSession): void {
  memoryPendingBulkZipSession = session;
}

function writePendingBulkZipJob(job: PendingBulkZipJob): void {
  writePendingBulkZipSession({
    jobs: [
      {
        jobId: job.jobId,
        fileName: job.fileName,
        submissionIds: job.submissionIds,
        chunkIndex: job.chunkIndex,
      },
    ],
    currentIndex: 0,
    startedAt: job.startedAt,
  });
}

export function clearPendingBulkZipJob(): void {
  memoryPendingBulkZipSession = null;
  if (typeof window === "undefined") return;
  // Drop legacy browser keys from older builds.
  try {
    window.localStorage.removeItem(PENDING_BULK_ZIP_KEY);
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

/** Prevent duplicate browser saves for the same queued ZIP job. */
const recentBulkZipDownloadJobIds = new Set<string>();
const BULK_ZIP_DOWNLOAD_DEDUPE_MS = 5_000;
const BULK_ZIP_DOWNLOAD_IFRAME_MS = 120_000;

function bulkZipDownloadJobIdFromUrl(url: string): string | null {
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    return new URL(url, base).searchParams.get("jobId");
  } catch {
    return null;
  }
}

/**
 * One hidden iframe. Content-Disposition: attachment saves the file.
 * Do not also click an <a> — that starts a second download of the same ZIP.
 * Dedupes by jobId so queue auto-download + summary button cannot double-save.
 */
export function triggerBulkZipFileDownload(
  url: string,
  options?: { force?: boolean },
): void {
  if (typeof document === "undefined") return;

  const jobId = bulkZipDownloadJobIdFromUrl(url);
  if (jobId && !options?.force) {
    if (recentBulkZipDownloadJobIds.has(jobId)) return;
    recentBulkZipDownloadJobIds.add(jobId);
    window.setTimeout(() => {
      recentBulkZipDownloadJobIds.delete(jobId);
    }, BULK_ZIP_DOWNLOAD_DEDUPE_MS);
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), BULK_ZIP_DOWNLOAD_IFRAME_MS);
}

function triggerNativeZipDownload(url: string): void {
  triggerBulkZipFileDownload(url);
}

export function buildBulkZipFileDownloadUrl(
  jobId: string,
  filename: string,
): string {
  return `/api/admin/bulk-download/file?jobId=${encodeURIComponent(jobId)}&filename=${encodeURIComponent(filename)}&proxy=1`;
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
  const json = options.contentType.includes("application/json") || !options.ok;
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

export type BulkVideoDownloadSubmissionMeta = {
  submissionId: string;
  username: string;
  videoTitle: string;
  link: string;
  views: number;
  /** Creator profile picture URL when available. */
  avatarUrl?: string | null;
  /** Display / full name for UI (falls back to username). */
  displayName?: string | null;
  /** Stable creator id for creators-wise grouping when available. */
  creatorId?: string | null;
  /** Contest moderation status: pending, verified, rejected, paid. */
  submissionStatus?: string | null;
  qualityScore?: number | null;
  /** When this video finished in the ZIP job (item updated_at). */
  downloadedAt?: string | null;
};

export function extraDownloadRowMeta(
  meta?: Pick<
    BulkVideoDownloadSubmissionMeta,
    "submissionStatus" | "qualityScore" | "downloadedAt"
  > | null,
): Pick<
  BulkVideoDownloadSubmissionMeta,
  "submissionStatus" | "qualityScore" | "downloadedAt"
> {
  const quality = Number(meta?.qualityScore);
  return {
    submissionStatus: meta?.submissionStatus
      ? String(meta.submissionStatus).toLowerCase()
      : null,
    qualityScore: Number.isFinite(quality) ? quality : null,
    downloadedAt: meta?.downloadedAt ? String(meta.downloadedAt) : null,
  };
}

export type BulkVideoDownloadResultRow = BulkVideoDownloadSubmissionMeta & {
  /**
   * - pending: not finished yet
   * - downloaded: video fetched in the current ZIP wave (ZIP not ready yet; not terminal)
   * - success: confirmed in a finished ZIP
   * - failed: known failure
   */
  status: "pending" | "downloaded" | "success" | "failed";
  error?: string;
};

/** True when the row should appear under the Succeeded results tab. */
export function isBulkDownloadSuccessRow(
  row: Pick<BulkVideoDownloadResultRow, "status">,
): boolean {
  return row.status === "success" || row.status === "downloaded";
}

export function normalizeBulkDownloadLink(link: string): string {
  return link.trim().replace(/\/+$/, "").toLowerCase();
}

/** Drop failures for URLs that succeeded in the latest worker wave (retry/remainder). */
export function stripResolvedVideoDownloadFailures(
  failures: { url: string; error: string }[],
  waveItems: { url: string }[],
  waveFailures: { url: string; error: string }[],
  waveDeferred: { url: string }[] = [],
): { url: string; error: string }[] {
  if (failures.length === 0) return failures;
  const failedThisWave = new Set(
    waveFailures.map((failure) => normalizeBulkDownloadLink(failure.url)),
  );
  const deferredThisWave = new Set(
    waveDeferred.map((item) => normalizeBulkDownloadLink(item.url)),
  );
  const succeededThisWave = new Set(
    waveItems
      .map((item) => normalizeBulkDownloadLink(item.url))
      .filter(
        (url) => !failedThisWave.has(url) && !deferredThisWave.has(url),
      ),
  );
  if (succeededThisWave.size === 0) return failures;
  return failures.filter(
    (failure) =>
      !succeededThisWave.has(normalizeBulkDownloadLink(failure.url)),
  );
}

export function countBulkDownloadResultStatuses(
  rows: BulkVideoDownloadResultRow[],
): { successCount: number; failedCount: number; pendingCount: number } {
  let successCount = 0;
  let failedCount = 0;
  let pendingCount = 0;
  for (const row of rows) {
    if (isBulkDownloadSuccessRow(row)) successCount += 1;
    else if (row.status === "failed") failedCount += 1;
    else pendingCount += 1;
  }
  return { successCount, failedCount, pendingCount };
}

export function buildBulkDownloadMetaMap(
  submissionIds: string[],
  lookup: (
    id: string,
  ) => Omit<BulkVideoDownloadSubmissionMeta, "submissionId"> | null,
): Map<string, BulkVideoDownloadSubmissionMeta> {
  const map = new Map<string, BulkVideoDownloadSubmissionMeta>();
  for (const submissionId of submissionIds) {
    const meta = lookup(submissionId);
    if (!meta) continue;
    map.set(submissionId, { submissionId, ...meta });
  }
  return map;
}

export function buildBulkDownloadResultRows(options: {
  submissionIds: string[];
  metaById: Map<string, BulkVideoDownloadSubmissionMeta>;
  itemFailures?: { url: string; error: string }[];
  jobFailed?: boolean;
  jobError?: string;
}): BulkVideoDownloadResultRow[] {
  const failureByLink = new Map(
    (options.itemFailures ?? []).map((failure) => [
      normalizeBulkDownloadLink(failure.url),
      failure.error,
    ]),
  );

  return options.submissionIds.map((submissionId) => {
    const meta = options.metaById.get(submissionId);
    const link = meta?.link ?? "";
    const failureError = link
      ? failureByLink.get(normalizeBulkDownloadLink(link))
      : undefined;

    const base = {
      submissionId,
      username: meta?.username ?? "unknown",
      videoTitle: meta?.videoTitle ?? "Untitled",
      link,
      views: meta?.views ?? 0,
      avatarUrl: meta?.avatarUrl ?? null,
      displayName: meta?.displayName ?? null,
      creatorId: meta?.creatorId ?? null,
      ...extraDownloadRowMeta(meta),
    };

    if (failureError) {
      return {
        ...base,
        status: "failed" as const,
        error: failureError,
      };
    }

    if (options.jobFailed) {
      return {
        ...base,
        status: "failed" as const,
        error: options.jobError || "Download failed",
      };
    }

    return {
      ...base,
      status: "success" as const,
    };
  });
}

export function mergeBulkDownloadResultRows(
  existing: BulkVideoDownloadResultRow[],
  next: BulkVideoDownloadResultRow[],
): BulkVideoDownloadResultRow[] {
  const statusRank = (status: BulkVideoDownloadResultRow["status"]) =>
    status === "success"
      ? 3
      : status === "failed"
        ? 2
        : status === "downloaded"
          ? 1
          : 0;

  const byId = new Map(existing.map((row) => [row.submissionId, row]));
  for (const row of next) {
    const prev = byId.get(row.submissionId);
    if (!prev || statusRank(row.status) >= statusRank(prev.status)) {
      byId.set(row.submissionId, row);
    }
  }
  return Array.from(byId.values());
}

/**
 * Live per-video rows while a ZIP job is still queued/processing.
 * Failures are marked immediately; completed downloads use non-terminal
 * `downloaded` so the Succeeded tab fills without treating the ZIP as done.
 */
export function buildProvisionalBulkDownloadResultRows(options: {
  submissionIds: string[];
  metaById: Map<string, BulkVideoDownloadSubmissionMeta>;
  completed: number;
  status?: string;
  itemFailures?: { url: string; error: string }[];
}): BulkVideoDownloadResultRow[] {
  const failureByLink = new Map(
    (options.itemFailures ?? []).map((failure) => [
      normalizeBulkDownloadLink(failure.url),
      failure.error,
    ]),
  );
  // Worker downloads sequentially in submission order, so the first N
  // non-failed rows match queue `completed`.
  let downloadedSlots = Math.max(0, Math.floor(options.completed) || 0);

  return options.submissionIds.map((submissionId) => {
    const meta = options.metaById.get(submissionId);
    const link = meta?.link ?? "";
    const failureError = link
      ? failureByLink.get(normalizeBulkDownloadLink(link))
      : undefined;
    const base = {
      submissionId,
      username: meta?.username ?? "unknown",
      videoTitle: meta?.videoTitle ?? "Untitled",
      link,
      views: meta?.views ?? 0,
      avatarUrl: meta?.avatarUrl ?? null,
      displayName: meta?.displayName ?? null,
      creatorId: meta?.creatorId ?? null,
      ...extraDownloadRowMeta(meta),
    };

    if (failureError) {
      return {
        ...base,
        status: "failed" as const,
        error: failureError,
      };
    }

    if (options.status === "failed") {
      return {
        ...base,
        status: "failed" as const,
        error: "Download failed",
      };
    }

    if (downloadedSlots > 0) {
      downloadedSlots -= 1;
      return {
        ...base,
        status: "downloaded" as const,
      };
    }

    return {
      ...base,
      status: "pending" as const,
    };
  });
}

export type ChunkedBulkDownloadResult = {
  totalVideos: number;
  totalChunks: number;
  succeededChunks: number;
  failedChunks: number;
  successCount: number;
  failedCount: number;
  errors: string[];
  results: BulkVideoDownloadResultRow[];
};

export type BulkDownloadProgressInfo = {
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
  totalVideos: number;
  successCount: number;
  failedCount: number;
  results?: BulkVideoDownloadResultRow[];
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
    itemFailures?: { url: string; error: string }[];
  }) => void,
  options?: { allowMissingWhileQueued?: boolean },
): Promise<{
  downloaded: boolean;
  completed: number;
  failed: number;
  total: number;
  error?: string;
  itemFailures?: { url: string; error: string }[];
}> {
  const started = Date.now();
  let last = { completed: 0, failed: 0, total: 0 };
  let downloadStarted = false;
  while (Date.now() - started < QUEUED_DOWNLOAD_TIMEOUT_MS) {
    const statusRes = await fetchJsonWithRetry<{
      error?: string;
      status?: string;
      completed?: number;
      failed?: number;
      total?: number;
      errors?: string[];
      itemFailures?: { url: string; error: string }[];
    }>(`/api/admin/bulk-download/status?jobId=${encodeURIComponent(jobId)}`);

    // Later ZIP parts are enqueued by the server after the previous part
    // finishes. Treat 404 as "not queued yet" when we already know the jobId.
    if (
      !statusRes.ok &&
      statusRes.status === 404 &&
      options?.allowMissingWhileQueued
    ) {
      onProgress?.({
        completed: last.completed,
        failed: last.failed,
        total: last.total,
        status: "queued",
        itemFailures: [],
      });
      await sleep(QUEUED_DOWNLOAD_POLL_MS);
      continue;
    }

    if (!statusRes.ok) {
      throw new Error(
        statusRes.data.error || "Failed to check download queue status.",
      );
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
      itemFailures: statusRes.data.itemFailures ?? [],
    });

    if (statusRes.data.status === "ready") {
      if (!downloadStarted) {
        downloadStarted = true;
        const fileUrl = buildBulkZipFileDownloadUrl(jobId, fileName);
        triggerNativeZipDownload(fileUrl);
        await sleep(NATIVE_DOWNLOAD_SETTLE_MS);
      }
      return {
        downloaded: true,
        completed: last.completed,
        failed: last.failed,
        total: last.total,
        itemFailures: statusRes.data.itemFailures ?? [],
      };
    }

    if (statusRes.data.status === "failed") {
      const firstError = statusRes.data.errors?.[0];
      return {
        downloaded: false,
        completed: last.completed,
        failed: Math.max(last.failed, last.total || 0),
        total: last.total,
        error: firstError || "Queued video download failed.",
        itemFailures: statusRes.data.itemFailures ?? [],
      };
    }

    await sleep(QUEUED_DOWNLOAD_POLL_MS);
  }
  throw new Error("Timed out waiting for queued video download.");
}

async function downloadOneZipChunk(options: {
  submissionIds: string[];
  metaById: Map<string, BulkVideoDownloadSubmissionMeta>;
  fileNamePrefix: string;
  namingPattern: VideoFilenamePattern;
  chunkIndex: number;
  totalChunks: number;
  totalVideos: number;
  /** When set, skip POST and only poll/download this already-enqueued job. */
  existingJobId?: string;
  existingFileName?: string;
  batchSession?: PendingBulkZipSession | null;
  batchJobIndex?: number;
  onProgress?: (info: BulkDownloadProgressInfo) => void;
}): Promise<{
  successCount: number;
  failedCount: number;
  downloaded: boolean;
  errors: string[];
  chunkResults: BulkVideoDownloadResultRow[];
}> {
  const errors: string[] = [];
  const chunk = options.submissionIds;

  const emit = (info: {
    successCount: number;
    failedCount: number;
    chunkResults?: BulkVideoDownloadResultRow[];
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
      results: info.chunkResults,
      queuedCompleted: info.queuedCompleted,
      queuedFailed: info.queuedFailed,
      queuedTotal: info.queuedTotal,
      queueStatus: info.queueStatus,
    });
  };

  const buildResults = (
    itemFailures?: { url: string; error: string }[],
    jobFailed?: boolean,
    jobError?: string,
  ) =>
    buildBulkDownloadResultRows({
      submissionIds: chunk,
      metaById: options.metaById,
      itemFailures,
      jobFailed,
      jobError,
    });

  const buildProvisionalChunkResults = (
    queueInfo: {
      completed: number;
      failed: number;
      status: string;
      itemFailures?: { url: string; error: string }[];
    },
  ): BulkVideoDownloadResultRow[] =>
    buildProvisionalBulkDownloadResultRows({
      submissionIds: chunk,
      metaById: options.metaById,
      completed: queueInfo.completed,
      status: queueInfo.status,
      itemFailures: queueInfo.itemFailures,
    });

  const pollQueued = async (jobId: string, fileName: string) => {
    if (options.batchSession && typeof options.batchJobIndex === "number") {
      writePendingBulkZipSession({
        ...options.batchSession,
        currentIndex: options.batchJobIndex,
        startedAt: options.batchSession.startedAt || Date.now(),
      });
    } else {
      writePendingBulkZipJob({
        jobId,
        fileName,
        submissionIds: chunk,
        startedAt: Date.now(),
        chunkIndex: options.chunkIndex,
      });
    }
    const queued = await waitForQueuedZipJob(
      jobId,
      fileName,
      (queueInfo) => {
        const provisional = buildProvisionalChunkResults(queueInfo);
        const confirmedFailed = (queueInfo.itemFailures ?? []).filter(
          (failure) =>
            chunk.some(
              (submissionId) =>
                normalizeBulkDownloadLink(
                  options.metaById.get(submissionId)?.link ?? "",
                ) === normalizeBulkDownloadLink(failure.url),
            ),
        ).length;
        // Prefer live queue `failed` so the Failed chip moves with the bar;
        // itemFailures can lag until the worker finishes a wave.
        const liveFailed = Math.max(
          Number(queueInfo.failed) || 0,
          confirmedFailed,
        );
        emit({
          queuedCompleted: queueInfo.completed,
          queuedFailed: queueInfo.failed,
          queuedTotal: queueInfo.total,
          queueStatus: queueInfo.status,
          successCount: queueInfo.completed,
          failedCount: liveFailed,
          chunkResults: provisional,
        });
      },
      { allowMissingWhileQueued: !!options.existingJobId },
    );
    const chunkResults = buildResults(
      queued.itemFailures,
      !queued.downloaded && !queued.itemFailures?.length,
      queued.error,
    );
    const { successCount, failedCount } =
      countBulkDownloadResultStatuses(chunkResults);
    if (queued.error) {
      errors.push(queued.error);
    }
    emit({
      successCount,
      failedCount,
      chunkResults,
    });
    return {
      successCount,
      failedCount,
      downloaded: queued.downloaded,
      errors,
      chunkResults,
    };
  };

  if (options.existingJobId) {
    return pollQueued(
      options.existingJobId,
      options.existingFileName || `${options.fileNamePrefix}.zip`,
    );
  }

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
      videosPerZip: chunk.length,
    }),
  });

  const contentType = response.headers.get("content-type");
  if (!response.ok || contentType?.includes("application/json")) {
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.queued && typeof payload.jobId === "string") {
      const fileName =
        typeof payload.jobs?.[0]?.zipFilename === "string"
          ? payload.jobs[0].zipFilename
          : `${options.fileNamePrefix}_${Date.now()}.zip`;
      return pollQueued(payload.jobId, fileName);
    }
    if (typeof payload.failed === "number") {
      const successCount = Number(payload.completed) || 0;
      const failedCount = Number(payload.failed) || chunk.length;
      const chunkResults = buildResults(undefined, true, payload.error);
      emit({ successCount, failedCount, chunkResults });
      return {
        successCount,
        failedCount: Math.max(failedCount, chunk.length - successCount),
        downloaded: false,
        errors: payload.error ? [String(payload.error)] : errors,
        chunkResults,
      };
    }
    throw new Error(payload.error || "Failed to download ZIP archive.");
  }

  const blob = await response.blob();
  const successCount =
    Number(response.headers.get("X-Bulk-Downloaded")) || chunk.length;
  const failedCount = Number(response.headers.get("X-Bulk-Failed")) || 0;
  triggerBrowserDownload(blob, `${options.fileNamePrefix}_${Date.now()}.zip`);
  const chunkResults = buildResults();
  emit({ successCount, failedCount, chunkResults });
  return {
    successCount,
    failedCount,
    downloaded: true,
    errors,
    chunkResults,
  };
}

type EnqueuedBulkZipJob = {
  jobId: string;
  chunkIndex: number;
  totalChunks: number;
  submissionIds: string[];
  zipFilename: string;
};

/**
 * Downloads selected submissions as ZIP batches of at most `videosPerZip`
 * (1–MAX_BULK_VIDEO_DOWNLOADS). When Redis is configured, all ZIP parts are
 * registered in one server batch: only the first part is queued immediately,
 * and the processor enqueues later parts after each ZIP finishes — so leaving
 * the contest page does not stop further queuing.
 */
export async function downloadSubmissionVideosInChunks(options: {
  submissionIds: string[];
  fileNamePrefix: string;
  namingPattern?: VideoFilenamePattern;
  videosPerZip?: number;
  metaById: Map<string, BulkVideoDownloadSubmissionMeta>;
  /** Prior per-video outcomes (e.g. after reload) so completed ZIP parts stay terminal. */
  existingResults?: BulkVideoDownloadResultRow[];
  onProgress?: (info: BulkDownloadProgressInfo) => void;
  /** Fired once when ZIP jobs are registered (new enqueue or local resume). */
  onEnqueued?: (info: {
    batchId?: string;
    jobs: EnqueuedBulkZipJob[];
  }) => void;
  /**
   * Resume from Supabase zip_parts (preferred over in-memory pending).
   * Skips creating a new bulk-download batch.
   */
  resumeJobs?: EnqueuedBulkZipJob[];
  resumeBatchId?: string;
  resumeCurrentIndex?: number;
}): Promise<ChunkedBulkDownloadResult> {
  const namingPattern = parseVideoFilenamePattern(options.namingPattern);
  const ids = options.submissionIds.filter(Boolean);
  const videosPerZip = parseVideosPerZip(options.videosPerZip);
  const expectedChunks = chunkArray(ids, videosPerZip);
  const errors: string[] = [];
  let succeededChunks = 0;
  const existingById = new Map(
    (options.existingResults || []).map((row) => [row.submissionId, row]),
  );
  let results: BulkVideoDownloadResultRow[] = ids.map((submissionId) => {
    const existing = existingById.get(submissionId);
    if (existing) return existing;
    const meta = options.metaById.get(submissionId);
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
    };
  });
  let successCount = results.filter((row) => row.status === "success").length;
  let failedCount = results.filter((row) => row.status === "failed").length;

  const resumeJobs = (options.resumeJobs || []).filter(
    (job) => typeof job.jobId === "string" && job.jobId.length > 0,
  );
  const pendingSession = resumeJobs.length === 0 ? readPendingBulkZipSession() : null;
  const canResumePending =
    resumeJobs.length === 0 &&
    !!pendingSession &&
    pendingSession.jobs.length > 0 &&
    sameIdList(
      pendingSession.jobs.flatMap((job) => job.submissionIds),
      ids,
    );

  let enqueuedJobs: EnqueuedBulkZipJob[] = [];
  let batchSession: PendingBulkZipSession | null = null;

  if (resumeJobs.length > 0) {
    enqueuedJobs = resumeJobs.map((job) => ({
      jobId: job.jobId,
      chunkIndex: job.chunkIndex > 0 ? job.chunkIndex : 1,
      totalChunks:
        job.totalChunks > 0 ? job.totalChunks : resumeJobs.length,
      submissionIds: job.submissionIds || [],
      zipFilename: job.zipFilename || `${options.fileNamePrefix}.zip`,
    }));
    batchSession = {
      batchId: options.resumeBatchId,
      jobs: enqueuedJobs.map((job) => ({
        jobId: job.jobId,
        fileName: job.zipFilename,
        submissionIds: job.submissionIds,
        chunkIndex: job.chunkIndex,
      })),
      currentIndex: Math.max(
        0,
        Math.min(
          enqueuedJobs.length - 1,
          typeof options.resumeCurrentIndex === "number"
            ? options.resumeCurrentIndex
            : 0,
        ),
      ),
      startedAt: Date.now(),
    };
    writePendingBulkZipSession(batchSession);
  } else if (canResumePending && pendingSession) {
    enqueuedJobs = pendingSession.jobs.map((job) => ({
      jobId: job.jobId,
      chunkIndex: job.chunkIndex,
      totalChunks: pendingSession.jobs.length,
      submissionIds: job.submissionIds,
      zipFilename: job.fileName,
    }));
    batchSession = pendingSession;
  } else {
    const response = await fetch("/api/admin/bulk-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        submissionIds: ids,
        namingPattern,
        zipFilename: `${options.fileNamePrefix}.zip`,
        videosPerZip,
      }),
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || contentType.includes("application/json")) {
      const payload = await response.json().catch(() => ({}));
      if (
        response.ok &&
        payload.queued &&
        Array.isArray(payload.jobs) &&
        payload.jobs.length > 0
      ) {
        enqueuedJobs = payload.jobs
          .map(
            (job: {
              jobId?: unknown;
              chunkIndex?: unknown;
              totalChunks?: unknown;
              submissionIds?: unknown;
              zipFilename?: unknown;
            }) => {
              if (typeof job.jobId !== "string") return null;
              const submissionIds = Array.isArray(job.submissionIds)
                ? job.submissionIds.filter(
                    (id): id is string =>
                      typeof id === "string" && id.length > 0,
                  )
                : [];
              return {
                jobId: job.jobId,
                chunkIndex:
                  typeof job.chunkIndex === "number" && job.chunkIndex > 0
                    ? job.chunkIndex
                    : 1,
                totalChunks:
                  typeof job.totalChunks === "number" && job.totalChunks > 0
                    ? job.totalChunks
                    : payload.jobs.length,
                submissionIds,
                zipFilename:
                  typeof job.zipFilename === "string" && job.zipFilename.trim()
                    ? job.zipFilename.trim()
                    : `${options.fileNamePrefix}.zip`,
              } satisfies EnqueuedBulkZipJob;
            },
          )
          .filter(
            (job: EnqueuedBulkZipJob | null): job is EnqueuedBulkZipJob =>
              job != null,
          );

        batchSession = {
          batchId:
            typeof payload.batchId === "string" ? payload.batchId : undefined,
          jobs: enqueuedJobs.map((job) => ({
            jobId: job.jobId,
            fileName: job.zipFilename,
            submissionIds: job.submissionIds,
            chunkIndex: job.chunkIndex,
          })),
          currentIndex: 0,
          startedAt: Date.now(),
        };
        writePendingBulkZipSession(batchSession);
      } else if (!response.ok) {
        throw new Error(payload.error || "Failed to enqueue ZIP download.");
      } else if (typeof payload.failed === "number") {
        // Sync failure payload (no queue)
        const chunkResults = buildBulkDownloadResultRows({
          submissionIds: ids,
          metaById: options.metaById,
          jobFailed: true,
          jobError: payload.error,
        });
        return {
          totalVideos: ids.length,
          totalChunks: expectedChunks.length,
          succeededChunks: 0,
          failedChunks: expectedChunks.length,
          successCount: Number(payload.completed) || 0,
          failedCount: Number(payload.failed) || ids.length,
          errors: payload.error ? [String(payload.error)] : [],
          results: chunkResults,
        };
      }
    }

    // Dev sync path: direct ZIP blob for a single chunk.
    if (enqueuedJobs.length === 0 && response.ok) {
      const blob = await response.blob();
      const success =
        Number(response.headers.get("X-Bulk-Downloaded")) || ids.length;
      const failed = Number(response.headers.get("X-Bulk-Failed")) || 0;
      triggerBrowserDownload(
        blob,
        `${options.fileNamePrefix}_${Date.now()}.zip`,
      );
      const chunkResults = buildBulkDownloadResultRows({
        submissionIds: ids,
        metaById: options.metaById,
      });
      options.onProgress?.({
        chunkIndex: 1,
        totalChunks: 1,
        chunkSize: ids.length,
        totalVideos: ids.length,
        successCount: success,
        failedCount: failed,
        results: chunkResults,
      });
      return {
        totalVideos: ids.length,
        totalChunks: 1,
        succeededChunks: 1,
        failedChunks: 0,
        successCount: success,
        failedCount: failed,
        errors: [],
        results: chunkResults,
      };
    }
  }

  if (enqueuedJobs.length === 0) {
    throw new Error("Failed to enqueue ZIP download jobs.");
  }

  options.onEnqueued?.({
    batchId: batchSession?.batchId,
    jobs: enqueuedJobs,
  });

  const startIndex =
    resumeJobs.length > 0
      ? Math.max(0, batchSession?.currentIndex ?? 0)
      : canResumePending
        ? Math.max(0, pendingSession?.currentIndex ?? 0)
        : 0;

  for (let i = startIndex; i < enqueuedJobs.length; i++) {
    const job = enqueuedJobs[i];
    const chunk =
      job.submissionIds.length > 0
        ? job.submissionIds
        : expectedChunks[job.chunkIndex - 1] || [];

    // Skip ZIP parts already completed before a reload.
    const chunkAlreadyDone =
      chunk.length > 0 &&
      chunk.every((submissionId) => {
        const status = results.find(
          (row) => row.submissionId === submissionId,
        )?.status;
        return status === "success" || status === "failed";
      });
    if (chunkAlreadyDone) {
      succeededChunks += 1;
      options.onProgress?.({
        chunkIndex: job.chunkIndex,
        totalChunks: job.totalChunks,
        chunkSize: chunk.length,
        totalVideos: ids.length,
        successCount,
        failedCount,
        results,
      });
      continue;
    }

    options.onProgress?.({
      chunkIndex: job.chunkIndex,
      totalChunks: job.totalChunks,
      chunkSize: chunk.length,
      totalVideos: ids.length,
      successCount,
      failedCount,
      results,
    });

    try {
      const result = await downloadOneZipChunk({
        submissionIds: chunk,
        metaById: options.metaById,
        fileNamePrefix: options.fileNamePrefix,
        namingPattern,
        chunkIndex: job.chunkIndex,
        totalChunks: job.totalChunks,
        totalVideos: ids.length,
        existingJobId: job.jobId,
        existingFileName: job.zipFilename,
        batchSession,
        batchJobIndex: i,
        onProgress: (info) => {
          const mergedResults = info.results
            ? mergeBulkDownloadResultRows(results, info.results)
            : results;
          // Live counters come from prior finished ZIPs + this ZIP's queue
          // completed/failed. Per-video rows use non-terminal `downloaded`
          // until the ZIP is ready (then upgraded to `success`).
          options.onProgress?.({
            ...info,
            successCount: successCount + info.successCount,
            failedCount: failedCount + info.failedCount,
            results: mergedResults,
          });
        },
      });
      successCount += result.successCount;
      failedCount += result.failedCount;
      results = mergeBulkDownloadResultRows(results, result.chunkResults);
      // Recompute from merged rows so seeded prior parts stay accurate.
      successCount = results.filter((row) => row.status === "success").length;
      failedCount = results.filter((row) => row.status === "failed").length;
      errors.push(...result.errors);
      if (result.downloaded) succeededChunks += 1;
      options.onProgress?.({
        chunkIndex: job.chunkIndex,
        totalChunks: job.totalChunks,
        chunkSize: chunk.length,
        totalVideos: ids.length,
        successCount,
        failedCount,
        results,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : `Batch ${job.chunkIndex} failed`;
      errors.push(message);
      const chunkResults = buildBulkDownloadResultRows({
        submissionIds: chunk,
        metaById: options.metaById,
        jobFailed: true,
        jobError: message,
      });
      results = mergeBulkDownloadResultRows(results, chunkResults);
      successCount = results.filter((row) => row.status === "success").length;
      failedCount = results.filter((row) => row.status === "failed").length;
    }

    if (i < enqueuedJobs.length - 1) {
      await sleep(BULK_CHUNK_DOWNLOAD_GAP_MS);
    }
  }

  clearPendingBulkZipJob();

  return {
    totalVideos: ids.length,
    totalChunks: enqueuedJobs.length,
    succeededChunks,
    failedChunks: enqueuedJobs.length - succeededChunks,
    successCount,
    failedCount,
    errors,
    results,
  };
}
