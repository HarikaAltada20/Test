/**
 * Instagram/YouTube bulk video download queue (Upstash Redis).
 * LMOVE queue → processing, LREM after success, bounded retry/dead-letter.
 *
 * Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from "@upstash/redis";

const REDIS_PREFIX = "video_download";
const REDIS_QUEUE_KEY = `${REDIS_PREFIX}:queue`;
const REDIS_PROCESSING_KEY = `${REDIS_PREFIX}:processing`;
const REDIS_DEAD_LETTER_KEY = `${REDIS_PREFIX}:dead_letter`;
const REDIS_DEAD_LETTER_MAX = 200;
const MAX_RETRY_ATTEMPTS = 3;
export const VIDEO_DOWNLOAD_JOB_TTL_SECONDS = 2 * 60 * 60;
/** Private bucket. Do not store ZIPs in public contest-assets. */
export const VIDEO_DOWNLOAD_STORAGE_BUCKET = "video-downloads";
/** Pre-fix path on the public contest-assets bucket; cleanup still removes these. */
export const VIDEO_DOWNLOAD_LEGACY_STORAGE_BUCKET = "contest-assets";
export const VIDEO_DOWNLOAD_LEGACY_STORAGE_PREFIX = "video-downloads";
/** Don't pull live jobs out of processing while a worker is still updating them. */
export const VIDEO_DOWNLOAD_STALE_PROCESSING_MS = 6 * 60 * 1000;
/** Cap in-flight jobs (queued + processing) so waiters stay inside the 15-minute UI timeout. */
export const VIDEO_DOWNLOAD_MAX_ACTIVE_JOBS_GLOBAL = 12;
export const VIDEO_DOWNLOAD_MAX_ACTIVE_JOBS_PER_USER = 4;
export const VIDEO_DOWNLOAD_REMAINDER_ENQUEUE_ATTEMPTS = 5;

/** Atomically move one payload from processing → queue (never leave it in neither list). */
const REQUEUE_FROM_PROCESSING_LUA = `
local removed = redis.call('LREM', KEYS[1], 1, ARGV[1])
if removed > 0 then
  redis.call('LPUSH', KEYS[2], ARGV[1])
end
return removed
`;

export type VideoDownloadItem = {
  url: string;
  filename: string;
  isInstagram: boolean;
};

export type VideoDownloadJob = {
  jobId: string;
  userId: string;
  items: VideoDownloadItem[];
  attempt?: number;
  zipFilename?: string;
  /** Same-job leftover wave: ZIP already stored, remaining items still to download. */
  partialStoragePath?: string;
  originalTotal?: number;
  completedSoFar?: number;
  failedSoFar?: number;
  errorsSoFar?: string[];
};

export type VideoDownloadJobStatus = {
  jobId: string;
  userId: string;
  status: "queued" | "processing" | "ready" | "failed";
  total: number;
  completed: number;
  failed: number;
  errors: string[];
  storagePath?: string;
  zipBytes?: number;
  zipFilename?: string;
  createdAt: string;
  updatedAt: string;
};

export type VideoDownloadRecoveryAction = "keep-processing" | "requeue" | "drop";

export type VideoDownloadRecoveryPlanItem = {
  raw: string;
  action: VideoDownloadRecoveryAction;
};

/**
 * Decide what recovery should do with a job found in the processing list.
 * ready/failed jobs must be dropped so they are not re-downloaded.
 * Live processing jobs stay put until they go stale.
 */
export function classifyRecoveredVideoDownloadJob(
  status: VideoDownloadJobStatus | null,
  nowMs: number = Date.now(),
): VideoDownloadRecoveryAction {
  if (status?.status === "ready" || status?.status === "failed") {
    return "drop";
  }
  const updatedAt = status?.updatedAt ? Date.parse(status.updatedAt) : 0;
  if (
    status?.status === "processing" &&
    Number.isFinite(updatedAt) &&
    nowMs - updatedAt < VIDEO_DOWNLOAD_STALE_PROCESSING_MS
  ) {
    return "keep-processing";
  }
  return "requeue";
}

/**
 * Inspect a processing-list snapshot without mutating Redis.
 * Live jobs stay in processing; only stale/finished/invalid rows are acted on.
 */
export function planRecoveredVideoDownloadJobs(
  rawItems: unknown[],
  getStatus: (jobId: string) => VideoDownloadJobStatus | null,
  nowMs: number = Date.now(),
): VideoDownloadRecoveryPlanItem[] {
  return rawItems.map((raw) => {
    const str = toRawString(raw);
    const job = parseVideoDownloadJob(str);
    if (!job) return { raw: str, action: "drop" };
    return {
      raw: str,
      action: classifyRecoveredVideoDownloadJob(getStatus(job.jobId), nowMs),
    };
  });
}

/** Partial ZIP must not be marked ready unless leftover videos were requeued on the same job. */
export function requireVideoDownloadRemainderRequeued(
  deferredCount: number,
  requeued: boolean,
): void {
  if (deferredCount > 0 && !requeued) {
    throw new Error("Failed to requeue leftover videos");
  }
}

function statusKey(jobId: string): string {
  return `${REDIS_PREFIX}:status:${jobId}`;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    if (!url) console.warn("[video-download-queue] UPSTASH_REDIS_REST_URL is missing");
    if (!token) console.warn("[video-download-queue] UPSTASH_REDIS_REST_TOKEN is missing");
    return null;
  }
  try {
    return Redis.fromEnv();
  } catch (e) {
    console.error("[video-download-queue] Redis client creation failed:", e);
    return null;
  }
}

export function isVideoDownloadQueueEnabled(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

export function videoDownloadStoragePath(userId: string, jobId: string): string {
  return `${userId}/${jobId}.zip`;
}

export function parseVideoDownloadJob(raw: unknown): VideoDownloadJob | null {
  let parsed: VideoDownloadJob;
  try {
    parsed =
      typeof raw === "string"
        ? (JSON.parse(raw) as VideoDownloadJob)
        : (raw as VideoDownloadJob);
  } catch {
    return null;
  }
  if (!parsed?.jobId || !parsed?.userId || !Array.isArray(parsed.items)) {
    return null;
  }
  const items = parsed.items.filter(
    (item) =>
      item &&
      typeof item.url === "string" &&
      typeof item.filename === "string" &&
      typeof item.isInstagram === "boolean",
  );
  if (items.length === 0) return null;
  const zipFilename =
    typeof parsed.zipFilename === "string" && parsed.zipFilename.trim()
      ? parsed.zipFilename.trim()
      : undefined;
  const partialStoragePath =
    typeof parsed.partialStoragePath === "string" && parsed.partialStoragePath.trim()
      ? parsed.partialStoragePath.trim()
      : undefined;
  const originalTotal =
    typeof parsed.originalTotal === "number" && Number.isFinite(parsed.originalTotal)
      ? Math.max(0, Math.floor(parsed.originalTotal))
      : undefined;
  const completedSoFar =
    typeof parsed.completedSoFar === "number" && Number.isFinite(parsed.completedSoFar)
      ? Math.max(0, Math.floor(parsed.completedSoFar))
      : undefined;
  const failedSoFar =
    typeof parsed.failedSoFar === "number" && Number.isFinite(parsed.failedSoFar)
      ? Math.max(0, Math.floor(parsed.failedSoFar))
      : undefined;
  const errorsSoFar = Array.isArray(parsed.errorsSoFar)
    ? parsed.errorsSoFar.filter((value): value is string => typeof value === "string")
    : undefined;
  return {
    jobId: parsed.jobId,
    userId: parsed.userId,
    items,
    zipFilename,
    partialStoragePath,
    originalTotal,
    completedSoFar,
    failedSoFar,
    errorsSoFar,
    attempt:
      typeof parsed.attempt === "number" && Number.isFinite(parsed.attempt)
        ? Math.max(0, Math.floor(parsed.attempt))
        : 0,
  };
}

function toRawString(raw: unknown): string {
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}

export async function setVideoDownloadJobStatus(
  status: VideoDownloadJobStatus,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(statusKey(status.jobId), JSON.stringify(status), {
    ex: VIDEO_DOWNLOAD_JOB_TTL_SECONDS,
  });
}

export async function getVideoDownloadJobStatus(
  jobId: string,
): Promise<VideoDownloadJobStatus | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.get<string | VideoDownloadJobStatus>(statusKey(jobId));
  if (!raw) return null;
  if (typeof raw === "object") return raw as VideoDownloadJobStatus;
  try {
    return JSON.parse(raw) as VideoDownloadJobStatus;
  } catch {
    return null;
  }
}

export async function clearVideoDownloadJobStatus(jobId: string): Promise<void> {
  const redis = getRedis();
  if (!redis || !jobId) return;
  try {
    await redis.del(statusKey(jobId));
  } catch (e) {
    console.error("[video-download-queue] clear status failed:", e);
  }
}

export function videoDownloadActiveJobLimitError(options: {
  total: number;
  userCount: number;
}): { error: string; status: 429 } | null {
  if (options.total >= VIDEO_DOWNLOAD_MAX_ACTIVE_JOBS_GLOBAL) {
    return {
      error:
        "Download queue is busy. Wait for current ZIP jobs to finish, then try again.",
      status: 429,
    };
  }
  if (options.userCount >= VIDEO_DOWNLOAD_MAX_ACTIVE_JOBS_PER_USER) {
    return {
      error:
        "You already have download jobs in progress. Wait for them to finish before starting another.",
      status: 429,
    };
  }
  return null;
}

async function listActiveVideoDownloadJobs(): Promise<VideoDownloadJob[]> {
  const redis = getRedis();
  if (!redis) return [];
  const [queued, processing] = await Promise.all([
    redis.lrange(REDIS_QUEUE_KEY, 0, 199),
    redis.lrange(REDIS_PROCESSING_KEY, 0, 199),
  ]);
  return [...(queued || []), ...(processing || [])]
    .map((raw) => parseVideoDownloadJob(toRawString(raw)))
    .filter((job): job is VideoDownloadJob => job != null);
}

export async function enqueueVideoDownloadJob(
  job: VideoDownloadJob,
): Promise<{ error?: string; status?: number }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  const lockKey = `${REDIS_PREFIX}:enqueue_lock`;
  let locked = false;
  try {
    for (let i = 0; i < 12; i++) {
      const ok = await redis.set(lockKey, "1", { nx: true, ex: 8 });
      if (ok) {
        locked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50 + i * 25));
    }
    if (!locked) {
      return {
        error:
          "Download queue is busy. Wait for current ZIP jobs to finish, then try again.",
        status: 429,
      };
    }

    const active = await listActiveVideoDownloadJobs();
    const limitError = videoDownloadActiveJobLimitError({
      total: active.length,
      userCount: active.filter((item) => item.userId === job.userId).length,
    });
    if (limitError) return limitError;

    const normalized: VideoDownloadJob = {
      ...job,
      attempt: Number.isFinite(job.attempt) ? Number(job.attempt) : 0,
    };
    const now = new Date().toISOString();
    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(normalized));
    await setVideoDownloadJobStatus({
      jobId: normalized.jobId,
      userId: normalized.userId,
      status: "queued",
      total: normalized.items.length,
      completed: 0,
      failed: 0,
      errors: [],
      zipFilename: normalized.zipFilename,
      createdAt: now,
      updatedAt: now,
    });
    console.log(
      `[video-download-queue] Enqueued jobId=${normalized.jobId} items=${normalized.items.length}`,
    );
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[video-download-queue] rpush failed:", message);
    return { error: message };
  } finally {
    if (locked) {
      await redis.del(lockKey).catch(() => {});
    }
  }
}

/** Requeue leftover videos on the same job so the client still gets one ZIP. */
export async function requeueVideoDownloadRemainder(options: {
  rawJobString: string;
  job: VideoDownloadJob;
}): Promise<{ error?: string }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  if (options.job.items.length === 0) {
    return { error: "Failed to requeue leftover videos" };
  }

  let lastError: string | undefined;
  for (let attempt = 0; attempt < VIDEO_DOWNLOAD_REMAINDER_ENQUEUE_ATTEMPTS; attempt++) {
    try {
      const nextJob: VideoDownloadJob = {
        ...options.job,
        attempt: 0,
      };
      await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(nextJob));
      await removeVideoDownloadFromProcessing(options.rawJobString);
      const existing = await getVideoDownloadJobStatus(nextJob.jobId);
      const now = new Date().toISOString();
      await setVideoDownloadJobStatus({
        jobId: nextJob.jobId,
        userId: nextJob.userId,
        status: "queued",
        total: nextJob.originalTotal || existing?.total || nextJob.items.length,
        completed: nextJob.completedSoFar ?? existing?.completed ?? 0,
        failed: nextJob.failedSoFar ?? existing?.failed ?? 0,
        errors: nextJob.errorsSoFar ?? existing?.errors ?? [],
        storagePath: nextJob.partialStoragePath || existing?.storagePath,
        zipBytes: existing?.zipBytes,
        zipFilename: existing?.zipFilename ?? nextJob.zipFilename,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      console.log(
        `[video-download-queue] Requeued remainder jobId=${nextJob.jobId} leftover=${nextJob.items.length}`,
      );
      return {};
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  return { error: lastError || "Failed to requeue leftover videos" };
}

export async function popVideoDownloadJob(): Promise<{
  job: VideoDownloadJob;
  raw: string;
} | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    for (let attempt = 0; attempt < 25; attempt++) {
      const raw = await redis.lmove(
        REDIS_QUEUE_KEY,
        REDIS_PROCESSING_KEY,
        "left",
        "left",
      );
      if (raw === null || raw === undefined) return null;
      const str = toRawString(raw);
      const job = parseVideoDownloadJob(str);
      if (job) return { job, raw: str };
      await redis.lrem(REDIS_PROCESSING_KEY, 1, str);
      console.warn(
        "[video-download-queue] Dropped invalid payload from queue; continuing",
      );
    }
    return null;
  } catch (e) {
    console.error("[video-download-queue] popJob (lmove) failed:", e);
    return null;
  }
}

export async function removeVideoDownloadFromProcessing(
  rawJobString: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.lrem(REDIS_PROCESSING_KEY, 1, rawJobString);
  } catch (e) {
    console.error("[video-download-queue] removeFromProcessing failed:", e);
  }
}

export async function retryOrDeadLetterVideoDownload(options: {
  rawJobString: string;
  reason?: string;
}): Promise<{ requeued: boolean; deadLettered: boolean; attempts: number; error?: string }> {
  const redis = getRedis();
  if (!redis) {
    return { requeued: false, deadLettered: false, attempts: 0, error: "Redis not configured" };
  }
  try {
    const parsed = parseVideoDownloadJob(options.rawJobString);
    if (!parsed) {
      await removeVideoDownloadFromProcessing(options.rawJobString);
      return { requeued: false, deadLettered: true, attempts: 0 };
    }
    const nextAttempts = Math.max(1, (parsed.attempt || 0) + 1);
    const nextJob: VideoDownloadJob = { ...parsed, attempt: nextAttempts };
    const now = new Date().toISOString();

    if (nextAttempts >= MAX_RETRY_ATTEMPTS) {
      await redis.lpush(
        REDIS_DEAD_LETTER_KEY,
        JSON.stringify({
          ...nextJob,
          deadLetteredAt: now,
          deadLetterReason: options.reason ?? "unknown",
        }),
      );
      await redis.ltrim(REDIS_DEAD_LETTER_KEY, 0, REDIS_DEAD_LETTER_MAX - 1);
      await removeVideoDownloadFromProcessing(options.rawJobString);
      await setVideoDownloadJobStatus({
        jobId: parsed.jobId,
        userId: parsed.userId,
        status: "failed",
        total: parsed.originalTotal || parsed.items.length,
        completed: 0,
        failed: parsed.originalTotal || parsed.items.length,
        errors: [options.reason || "Download job failed after retries"],
        zipFilename: parsed.zipFilename,
        createdAt: now,
        updatedAt: now,
      });
      console.error(
        `[video-download-queue] Dead-lettered jobId=${parsed.jobId} attempts=${nextAttempts}`,
      );
      return { requeued: false, deadLettered: true, attempts: nextAttempts };
    }

    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(nextJob));
    await removeVideoDownloadFromProcessing(options.rawJobString);
    const existing = await getVideoDownloadJobStatus(parsed.jobId);
    await setVideoDownloadJobStatus({
      jobId: parsed.jobId,
      userId: parsed.userId,
      status: "queued",
      total: existing?.total || parsed.originalTotal || parsed.items.length,
      completed: existing?.completed ?? parsed.completedSoFar ?? 0,
      failed: existing?.failed ?? parsed.failedSoFar ?? 0,
      errors: existing?.errors ?? parsed.errorsSoFar ?? [],
      storagePath: existing?.storagePath ?? parsed.partialStoragePath,
      zipFilename: existing?.zipFilename ?? parsed.zipFilename,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    console.warn(
      `[video-download-queue] Re-queued jobId=${parsed.jobId} attempts=${nextAttempts}`,
    );
    return { requeued: true, deadLettered: false, attempts: nextAttempts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[video-download-queue] retryOrDeadLetter failed:", message);
    return { requeued: false, deadLettered: false, attempts: 0, error: message };
  }
}

async function requeueVideoDownloadFromProcessing(
  redis: Redis,
  rawJobString: string,
): Promise<boolean> {
  try {
    const removed = await redis.eval(
      REQUEUE_FROM_PROCESSING_LUA,
      [REDIS_PROCESSING_KEY, REDIS_QUEUE_KEY],
      [rawJobString],
    );
    return Number(removed) > 0;
  } catch (error) {
    console.warn(
      "[video-download-queue] atomic requeue eval failed; copy then remove:",
      error,
    );
    // Duplicate in both lists is recoverable; missing from both is not.
    await redis.lpush(REDIS_QUEUE_KEY, rawJobString);
    await redis.lrem(REDIS_PROCESSING_KEY, 1, rawJobString);
    return true;
  }
}

/**
 * Requeue stale processing jobs without RPOP'ing the live list into memory.
 * Live workers are left in processing. Finished jobs are LREM'd. Stale jobs
 * move queue←processing atomically so a crashed recovery cannot drop them.
 */
export async function recoverVideoDownloadProcessingToQueue(options?: {
  maxToMove?: number;
}): Promise<{ moved: number; error?: string }> {
  const redis = getRedis();
  if (!redis) return { moved: 0, error: "Redis not configured" };
  const maxToMove = Math.max(1, Math.min(options?.maxToMove ?? 25, 200));
  try {
    const rawItems = await redis.lrange(REDIS_PROCESSING_KEY, 0, maxToMove - 1);
    if (!rawItems?.length) return { moved: 0 };

    const statuses = new Map<string, VideoDownloadJobStatus | null>();
    for (const raw of rawItems) {
      const job = parseVideoDownloadJob(toRawString(raw));
      if (!job || statuses.has(job.jobId)) continue;
      statuses.set(job.jobId, await getVideoDownloadJobStatus(job.jobId));
    }

    const plan = planRecoveredVideoDownloadJobs(
      rawItems,
      (jobId) => statuses.get(jobId) ?? null,
    );

    let moved = 0;
    let dropped = 0;
    for (const item of plan) {
      if (item.action === "keep-processing") continue;
      if (item.action === "drop") {
        await redis.lrem(REDIS_PROCESSING_KEY, 1, item.raw);
        dropped += 1;
        continue;
      }
      const requeued = await requeueVideoDownloadFromProcessing(redis, item.raw);
      if (requeued) moved += 1;
    }

    if (moved > 0 || dropped > 0) {
      console.warn(
        `[video-download-queue] Re-queued ${moved} stale job(s) from processing; dropped ${dropped} finished/invalid job(s)`,
      );
    }
    return { moved };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[video-download-queue] recoverProcessingJobsToQueue failed:", message);
    return { moved: 0, error: message };
  }
}
