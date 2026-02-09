/**
 * Twitter metrics refresh queue using Upstash Redis.
 * Jobs are pushed to a Redis list; the processor (/api/cron/process-metrics-queue) is triggered
 * by QStash (when configured) or by direct POST after each enqueue. Pops and processes one job
 * per run (raid or one batch of awareness). Enables background refresh without Vercel timeout.
 *
 * Required env (when queue is used for Twitter refresh):
 * - UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (Upstash Redis)
 * Optional: QSTASH_TOKEN (+ signing keys) for event-driven triggers; else CRON_SECRET + direct POST.
 * - CRON_SECRET (auth for processor and internal calls to twitter-refresh-tweets / fetch-raid-engagements)
 * - VERCEL_URL or NEXT_PUBLIC_APP_URL (base URL for internal API calls)
 */

import { Redis } from "@upstash/redis";

const REDIS_PREFIX = "metrics_refresh";
const REDIS_QUEUE_KEY = `${REDIS_PREFIX}:queue`;
const REDIS_STATE_TTL_SEC = 60 * 60 * 2; // 2 hours

export type MetricsRefreshJob =
  | { contestId: string; isRaid: true; batchIndex?: number; totalBatches?: number }
  | {
      contestId: string;
      isRaid: false;
      batchIndex: number;
      totalBatches: number;
    };

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    if (!url)
      console.warn(
        "[metrics-refresh-queue] UPSTASH_REDIS_REST_URL is missing"
      );
    if (!token)
      console.warn(
        "[metrics-refresh-queue] UPSTASH_REDIS_REST_TOKEN is missing"
      );
    return null;
  }
  try {
    if (typeof process !== "undefined" && process?.env) {
      return Redis.fromEnv();
    }
    return new Redis({ url, token });
  } catch (e) {
    console.error("[metrics-refresh-queue] Redis client creation failed:", e);
    return null;
  }
}

/** Check if queue is configured (Redis only). */
export function isMetricsQueueEnabled(): boolean {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return !!(redisUrl && redisToken);
}

/** Returns which env vars are missing (for logging). Call only when isMetricsQueueEnabled() is false. */
export function getMissingQueueEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.UPSTASH_REDIS_REST_URL?.trim())
    missing.push("UPSTASH_REDIS_REST_URL");
  if (!process.env.UPSTASH_REDIS_REST_TOKEN?.trim())
    missing.push("UPSTASH_REDIS_REST_TOKEN");
  return missing;
}

/**
 * Enqueue a Twitter metrics refresh job (push to Redis list).
 * For raid: one job (or first batch job with batchIndex 0); processor will push next batches.
 * For awareness: first job (batchIndex 0); processor will push next batches.
 */
export async function enqueueMetricsRefreshJob(
  job: MetricsRefreshJob,
  _baseUrl?: string
): Promise<{ messageId?: string; error?: string }> {
  const redis = getRedis();
  if (!redis) {
    return { error: "Redis not configured" };
  }
  try {
    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(job));
    console.log(
      `[metrics-refresh-queue] Enqueued job contestId=${job.contestId} (Redis)`
    );
    return { messageId: `redis:${Date.now()}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[metrics-refresh-queue] Redis rpush failed:", message);
    return { error: message };
  }
}

/**
 * Pop one job from the Redis queue (LIFO - newest first).
 * So the contest the user just clicked "Refresh" for gets processed, not an older job from another contest.
 */
export async function popJob(): Promise<MetricsRefreshJob | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.rpop(REDIS_QUEUE_KEY);
    if (raw === null || raw === undefined) return null;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed?.contestId) return parsed as MetricsRefreshJob;
    return null;
  } catch (e) {
    console.error("[metrics-refresh-queue] popJob failed:", e);
    return null;
  }
}

/** Redis key for batch state (freshTweetIds, fetchedCreatorIds) for a contest. */
function stateKey(contestId: string): string {
  return `${REDIS_PREFIX}:state:${contestId}`;
}

export type BatchState = {
  freshTweetIds: string[];
  fetchedCreatorIds: string[];
};

export async function getBatchState(
  contestId: string
): Promise<BatchState | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(stateKey(contestId));
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "string") return JSON.parse(raw) as BatchState;
    return raw as BatchState;
  } catch (e) {
    console.error("[metrics-refresh-queue] getBatchState failed:", e);
    return null;
  }
}

export async function mergeBatchState(
  contestId: string,
  freshTweetIds: string[],
  fetchedCreatorIds: string[]
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const key = stateKey(contestId);
  try {
    const existing = await getBatchState(contestId);
    const merged: BatchState = {
      freshTweetIds: [
        ...new Set([...(existing?.freshTweetIds ?? []), ...freshTweetIds]),
      ],
      fetchedCreatorIds: [
        ...new Set([
          ...(existing?.fetchedCreatorIds ?? []),
          ...fetchedCreatorIds,
        ]),
      ],
    };
    await redis.set(key, JSON.stringify(merged), { ex: REDIS_STATE_TTL_SEC });
  } catch (err) {
    console.error("[metrics-refresh-queue] mergeBatchState failed:", err);
  }
}

export async function clearBatchState(contestId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(stateKey(contestId));
  } catch (err) {
    console.error("[metrics-refresh-queue] clearBatchState failed:", err);
  }
}

/** Initialize state for a new multi-batch run (call before first batch). */
export async function initBatchState(contestId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(
      stateKey(contestId),
      JSON.stringify({
        freshTweetIds: [],
        fetchedCreatorIds: [],
      } as BatchState),
      { ex: REDIS_STATE_TTL_SEC }
    );
  } catch (err) {
    console.error("[metrics-refresh-queue] initBatchState failed:", err);
  }
}
