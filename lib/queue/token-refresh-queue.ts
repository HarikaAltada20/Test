/**
 * Token refresh queue using Upstash Redis.
 * Uses LMOVE (queue -> processing) for crash-safe pop.
 */

import { Redis } from "@upstash/redis";

const REDIS_PREFIX = "token_refresh";
const REDIS_QUEUE_KEY = `${REDIS_PREFIX}:queue`;
const REDIS_PROCESSING_KEY = `${REDIS_PREFIX}:processing`;

export interface TokenRefreshJob {
  creatorId: string;
}

function getRedisEnv(): { url?: string; token?: string } {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return { url, token };
}

function getRedis(): Redis | null {
  const { url, token } = getRedisEnv();
  if (!url || !token) return null;
  try {
    return Redis.fromEnv();
  } catch (e) {
    console.error("[token-refresh-queue] Redis client creation failed:", e);
    return null;
  }
}

export function isTokenRefreshQueueEnabled(): boolean {
  const { url, token } = getRedisEnv();
  return !!(url && token);
}

/**
 * Enqueue a job (push to main queue).
 */
export async function enqueueTokenRefreshJob(
  job: TokenRefreshJob
): Promise<{ error?: string }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  try {
    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(job));
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[token-refresh-queue] rpush failed:", message);
    return { error: message };
  }
}

/**
 * Enqueue multiple jobs in one command.
 */
export async function enqueueTokenRefreshJobs(
  jobs: TokenRefreshJob[]
): Promise<{ error?: string }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  if (jobs.length === 0) return {};
  try {
    const payloads = jobs.map(j => JSON.stringify(j));
    await redis.rpush(REDIS_QUEUE_KEY, ...payloads);
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[token-refresh-queue] multi-rpush failed:", message);
    return { error: message };
  }
}

/**
 * Atomically pop one job from queue into processing list.
 */
export async function popTokenRefreshJob(): Promise<{ job: TokenRefreshJob; raw: string } | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.lmove(REDIS_QUEUE_KEY, REDIS_PROCESSING_KEY, "right", "left");
    if (raw === null || raw === undefined) return null;
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = JSON.parse(str);
    if (parsed?.creatorId) {
      return { job: parsed as TokenRefreshJob, raw: str };
    }
    return null;
  } catch (e) {
    console.error("[token-refresh-queue] popJob (lmove) failed:", e);
    return null;
  }
}

/**
 * Remove job from processing list after successful completion.
 */
export async function removeFromProcessing(rawJobString: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.lrem(REDIS_PROCESSING_KEY, 1, rawJobString);
  } catch (e) {
    console.error("[token-refresh-queue] removeFromProcessing failed:", e);
  }
}

/**
 * Recover jobs from processing back into queue.
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
      const raw = await redis.lmove(REDIS_PROCESSING_KEY, REDIS_QUEUE_KEY, "right", "left");
      if (raw === null || raw === undefined) break;
      moved += 1;
    }
    return { moved };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[token-refresh-queue] recoverProcessingJobsToQueue failed:", message);
    return { moved: 0, error: message };
  }
}
