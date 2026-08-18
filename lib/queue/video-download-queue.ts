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
const MAX_RETRY_ATTEMPTS = 3;
export const VIDEO_DOWNLOAD_JOB_TTL_SECONDS = 2 * 60 * 60;
export const VIDEO_DOWNLOAD_STORAGE_BUCKET = "contest-assets";
/** Don't pull live jobs out of processing while a worker is still updating them. */
const VIDEO_DOWNLOAD_STALE_PROCESSING_MS = 6 * 60 * 1000;

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
  return `video-downloads/${userId}/${jobId}.zip`;
}

export function parseVideoDownloadJob(raw: unknown): VideoDownloadJob | null {
  const parsed =
    typeof raw === "string"
      ? (JSON.parse(raw) as VideoDownloadJob)
      : (raw as VideoDownloadJob);
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
  return {
    jobId: parsed.jobId,
    userId: parsed.userId,
    items,
    zipFilename,
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

export async function enqueueVideoDownloadJob(
  job: VideoDownloadJob,
): Promise<{ error?: string }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  try {
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
  }
}

export async function popVideoDownloadJob(): Promise<{
  job: VideoDownloadJob;
  raw: string;
} | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.lmove(
      REDIS_QUEUE_KEY,
      REDIS_PROCESSING_KEY,
      "left",
      "left",
    );
    if (raw === null || raw === undefined) return null;
    const str = toRawString(raw);
    const job = parseVideoDownloadJob(str);
    if (!job) return null;
    return { job, raw: str };
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
      await removeVideoDownloadFromProcessing(options.rawJobString);
      await setVideoDownloadJobStatus({
        jobId: parsed.jobId,
        userId: parsed.userId,
        status: "failed",
        total: parsed.items.length,
        completed: 0,
        failed: parsed.items.length,
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
      total: parsed.items.length,
      completed: existing?.completed ?? 0,
      failed: existing?.failed ?? 0,
      errors: existing?.errors ?? [],
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

export async function recoverVideoDownloadProcessingToQueue(options?: {
  maxToMove?: number;
}): Promise<{ moved: number; error?: string }> {
  const redis = getRedis();
  if (!redis) return { moved: 0, error: "Redis not configured" };
  const maxToMove = Math.max(1, Math.min(options?.maxToMove ?? 25, 200));
  try {
    let moved = 0;
    const stillRunningJobs: string[] = [];
    for (let i = 0; i < maxToMove; i++) {
      const raw = await redis.rpop(REDIS_PROCESSING_KEY);
      if (raw === null || raw === undefined) break;
      const str = toRawString(raw);
      const job = parseVideoDownloadJob(str);
      const status = job ? await getVideoDownloadJobStatus(job.jobId) : null;
      const updatedAt = status?.updatedAt ? Date.parse(status.updatedAt) : 0;
      const stillRunning =
        status?.status === "processing" &&
        Number.isFinite(updatedAt) &&
        Date.now() - updatedAt < VIDEO_DOWNLOAD_STALE_PROCESSING_MS;
      if (stillRunning) {
        stillRunningJobs.push(str);
        continue;
      }
      await redis.lpush(REDIS_QUEUE_KEY, str);
      moved += 1;
    }
    for (let i = stillRunningJobs.length - 1; i >= 0; i--) {
      await redis.lpush(REDIS_PROCESSING_KEY, stillRunningJobs[i]);
    }
    if (moved > 0) {
      console.warn(`[video-download-queue] Re-queued ${moved} stale job(s) from processing`);
    }
    return { moved };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[video-download-queue] recoverProcessingJobsToQueue failed:", message);
    return { moved: 0, error: message };
  }
}
