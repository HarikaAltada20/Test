/**
 * Rate limiting for desktop status callbacks.
 * Uses Upstash Redis when available; falls back to a process-local map.
 * Redis failures fail-open so temporary outages do not block callbacks.
 */

import { Redis } from "@upstash/redis";

const WINDOW_MS = 60_000;
const DEFAULT_PER_JOB_LIMIT = 120;
const DEFAULT_PER_USER_LIMIT = 300;

let redisClient: Redis | null | undefined;
const localBuckets = new Map<string, number[]>();

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  try {
    redisClient = Redis.fromEnv();
  } catch {
    redisClient = null;
  }
  return redisClient;
}

function pruneLocal(key: string, now: number): number[] {
  const existing = localBuckets.get(key) || [];
  const kept = existing.filter((ts) => ts > now - WINDOW_MS);
  localBuckets.set(key, kept);
  return kept;
}

async function hitBucket(
  key: string,
  limit: number,
): Promise<{ ok: true; failOpen?: boolean } | { ok: false; retryAfterMs: number }> {
  const redis = getRedis();
  const now = Date.now();
  if (!redis) {
    const kept = pruneLocal(key, now);
    if (kept.length >= limit) {
      const retryAfterMs = kept[0] - (now - WINDOW_MS) + 50;
      return { ok: false, retryAfterMs: Math.max(50, retryAfterMs) };
    }
    kept.push(now);
    localBuckets.set(key, kept);
    return { ok: true };
  }

  try {
    const bucket = Math.floor(now / WINDOW_MS);
    const redisKey = `goc-desktop-status:${key}:${bucket}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, WINDOW_MS);
    }
    if (count > limit) {
      return { ok: false, retryAfterMs: WINDOW_MS - (now % WINDOW_MS) };
    }
    return { ok: true };
  } catch (error) {
    console.warn(
      "[desktop-status-rate-limit] Redis unavailable; failing open",
      error,
    );
    return { ok: true, failOpen: true };
  }
}

/**
 * Cap events relative to job size: roughly 2 * items + archives + overhead,
 * but never above DEFAULT_PER_JOB_LIMIT per minute.
 */
export function maxEventsPerMinuteForJob(itemCount: number): number {
  const soft = Math.max(20, itemCount * 2 + 20);
  return Math.min(DEFAULT_PER_JOB_LIMIT, soft);
}

export async function acquireDesktopStatusRateLimit(options: {
  jobId: string;
  userId: string;
  itemCount: number;
}): Promise<
  | { ok: true; failOpen?: boolean }
  | { ok: false; retryAfterMs: number; reason: string }
> {
  const perJob = maxEventsPerMinuteForJob(options.itemCount);
  const jobHit = await hitBucket(`job:${options.jobId}`, perJob);
  if (!jobHit.ok) {
    return {
      ok: false,
      retryAfterMs: jobHit.retryAfterMs,
      reason: "Per-job status callback rate limit exceeded",
    };
  }
  const userHit = await hitBucket(`user:${options.userId}`, DEFAULT_PER_USER_LIMIT);
  if (!userHit.ok) {
    return {
      ok: false,
      retryAfterMs: userHit.retryAfterMs,
      reason: "Per-user status callback rate limit exceeded",
    };
  }
  return {
    ok: true,
    failOpen: Boolean(
      ("failOpen" in jobHit && jobHit.failOpen) ||
        ("failOpen" in userHit && userHit.failOpen),
    ),
  };
}

/** Test helper: clear in-memory buckets. */
export function resetDesktopStatusRateLimitForTests(): void {
  localBuckets.clear();
}
