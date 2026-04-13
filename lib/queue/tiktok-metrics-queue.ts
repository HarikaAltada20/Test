/**
 * TikTok metrics refresh queue using Upstash Redis.
 * Separate key from Twitter/Instagram metrics queue. Uses LMOVE (queue -> processing) for
 * crash-safe pop; after worker succeeds, LREM from processing.
 *
 * Env:
 * - UPSTASH_REDIS_TIKTOK_REST_URL, UPSTASH_REDIS_TIKTOK_REST_TOKEN (preferred)
 * - fallback: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from "@upstash/redis";

const REDIS_PREFIX = "tiktok_metrics_refresh";
const REDIS_QUEUE_KEY = `${REDIS_PREFIX}:queue`;
const REDIS_PROCESSING_KEY = `${REDIS_PREFIX}:processing`;

export interface TikTokMetricsJobCursor {
  last_insights_update: string | null;
  id: string;
}

export interface TikTokMetricsJob {
  contestId: string;
  runId: string;
  batchIndex: number;
  batchSize: number;
  totalBatches: number;
  cursor?: TikTokMetricsJobCursor;
}

function getTikTokRedisEnv(): { url?: string; token?: string; using: "tiktok" | "shared" } {
  const ttUrl = process.env.UPSTASH_REDIS_TIKTOK_REST_URL?.trim();
  const ttToken = process.env.UPSTASH_REDIS_TIKTOK_REST_TOKEN?.trim();
  if (ttUrl && ttToken) return { url: ttUrl, token: ttToken, using: "tiktok" };

  const sharedUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const sharedToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return { url: sharedUrl, token: sharedToken, using: "shared" };
}

function getRedis(): Redis | null {
  const { url, token, using } = getTikTokRedisEnv();
  if (!url || !token) {
    if (using === "tiktok") {
      if (!url)
        console.warn("[tiktok-metrics-queue] UPSTASH_REDIS_TIKTOK_REST_URL is missing");
      if (!token)
        console.warn("[tiktok-metrics-queue] UPSTASH_REDIS_TIKTOK_REST_TOKEN is missing");
    } else {
      if (!url) console.warn("[tiktok-metrics-queue] UPSTASH_REDIS_REST_URL is missing");
      if (!token) console.warn("[tiktok-metrics-queue] UPSTASH_REDIS_REST_TOKEN is missing");
    }
    return null;
  }
  try {
    if (using === "shared" && typeof process !== "undefined" && process?.env) return Redis.fromEnv();
    return new Redis({ url, token });
  } catch (e) {
    console.error("[tiktok-metrics-queue] Redis client creation failed:", e);
    return null;
  }
}

export function isTikTokMetricsQueueEnabled(): boolean {
  const { url, token } = getTikTokRedisEnv();
  return !!(url && token);
}

/**
 * Enqueue a job (push to main queue).
 */
export async function enqueueTikTokMetricsJob(
  job: TikTokMetricsJob
): Promise<{ error?: string }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  try {
    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(job));
    console.log(`[tiktok-metrics-queue] Enqueued runId=${job.runId} batchIndex=${job.batchIndex}`);
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tiktok-metrics-queue] rpush failed:", message);
    return { error: message };
  }
}

/**
 * Atomically pop one job from queue into processing list (LMOVE right -> left).
 */
export async function popTikTokMetricsJob(): Promise<{ job: TikTokMetricsJob; raw: string } | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.lmove(REDIS_QUEUE_KEY, REDIS_PROCESSING_KEY, "right", "left");
    if (raw === null || raw === undefined) return null;
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = JSON.parse(str);
    if (parsed?.contestId && parsed?.runId != null) {
      return { job: parsed as TikTokMetricsJob, raw: str };
    }
    return null;
  } catch (e) {
    console.error("[tiktok-metrics-queue] popJob (lmove) failed:", e);
    return null;
  }
}

/**
 * Remove job from processing list after successful completion (LREM count 1).
 */
export async function removeFromProcessing(rawJobString: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.lrem(REDIS_PROCESSING_KEY, 1, rawJobString);
  } catch (e) {
    console.error("[tiktok-metrics-queue] removeFromProcessing failed:", e);
  }
}

/**
 * Best-effort recovery: move jobs from processing back into queue.
 */
export async function recoverProcessingJobsToQueue(options?: {
  maxToMove?: number;
}): Promise<{ moved: number; error?: string }> {
  const redis = getRedis();
  if (!redis) return { moved: 0, error: "Redis not configured" };
  const maxToMove = Math.max(1, Math.min(options?.maxToMove ?? 25, 200));
  try {
    let moved = 0;
    for (let i = 0; i < maxToMove; i++) {
      const raw = await redis.lmove(
        REDIS_PROCESSING_KEY,
        REDIS_QUEUE_KEY,
        "right",
        "left"
      );
      if (raw === null || raw === undefined) break;
      moved += 1;
    }
    if (moved > 0) {
      console.warn(`[tiktok-metrics-queue] Re-queued ${moved} job(s) from processing`);
    }
    return { moved };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tiktok-metrics-queue] recoverProcessingJobsToQueue failed:", message);
    return { moved: 0, error: message };
  }
}
