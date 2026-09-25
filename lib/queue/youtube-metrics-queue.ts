/**
 * YouTube metrics refresh queue (Upstash Redis).
 * Mirrors LMOVE queue → processing, LREM after success.
 * Uses FIFO order and bounded retry/dead-letter handling for failures.
 *
 * Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from "@upstash/redis";

const REDIS_PREFIX = "youtube_metrics_refresh";
const REDIS_QUEUE_KEY = `${REDIS_PREFIX}:queue`;
const REDIS_PROCESSING_KEY = `${REDIS_PREFIX}:processing`;
const REDIS_DEAD_LETTER_KEY = `${REDIS_PREFIX}:dead_letter`;
const MAX_RETRY_ATTEMPTS = 3;

export type YouTubeRefreshScope =
  | "basic"
  | "core"
  | "traffic"
  | "demographics"
  | "all"
  | "all_standard";

export interface YouTubeMetricsJobCursor {
  id: string;
}

export interface YouTubeMetricsJob {
  contestId: string;
  runId: string;
  scope: YouTubeRefreshScope;
  batchIndex: number;
  batchSize: number;
  totalBatches: number;
  cursor?: YouTubeMetricsJobCursor;
  attempt?: number;
  /**
   * When "post_campaign", batch reads/writes post_campaign_submission_metrics
   * and bypasses post-contest metrics lock. Default: submissions.
   */
  metricsTarget?: "submissions" | "post_campaign";
}

function getYouTubeRedisEnv(): { url?: string; token?: string } {
  const sharedUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const sharedToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return { url: sharedUrl, token: sharedToken };
}

function getRedis(): Redis | null {
  const { url, token } = getYouTubeRedisEnv();
  if (!url || !token) {
    if (!url) console.warn("[youtube-metrics-queue] UPSTASH_REDIS_REST_URL is missing");
    if (!token) console.warn("[youtube-metrics-queue] UPSTASH_REDIS_REST_TOKEN is missing");
    return null;
  }
  try {
    // If running in a Node.js environment with shared env vars, use fromEnv() for optimal client reuse if needed,
    // otherwise construct with specific credentials.
    if (typeof process !== "undefined" && process?.env?.UPSTASH_REDIS_REST_URL === url) {
      return Redis.fromEnv();
    }
    return new Redis({ url, token });
  } catch (e) {
    console.error("[youtube-metrics-queue] Redis client creation failed:", e);
    return null;
  }
}

export function isYouTubeMetricsQueueEnabled(): boolean {
  const { url, token } = getYouTubeRedisEnv();
  return !!(url && token);
}

export async function enqueueYouTubeMetricsJob(
  job: YouTubeMetricsJob
): Promise<{ error?: string }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  try {
    const normalizedJob: YouTubeMetricsJob = {
      ...job,
      attempt: Number.isFinite(job.attempt) ? Number(job.attempt) : 0,
    };
    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(normalizedJob));
    console.log(
      `[youtube-metrics-queue] Enqueued runId=${normalizedJob.runId} batchIndex=${normalizedJob.batchIndex} scope=${normalizedJob.scope} attempt=${normalizedJob.attempt}`
    );
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[youtube-metrics-queue] rpush failed:", message);
    return { error: message };
  }
}

export async function popYouTubeMetricsJob(): Promise<{ job: YouTubeMetricsJob; raw: string } | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    // FIFO: append with RPUSH, consume from LEFT.
    const raw = await redis.lmove(REDIS_QUEUE_KEY, REDIS_PROCESSING_KEY, "left", "left");
    if (raw === null || raw === undefined) return null;
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = JSON.parse(str);
    if (parsed?.contestId && parsed?.runId != null && parsed?.scope) {
      const normalized: YouTubeMetricsJob = {
        ...(parsed as YouTubeMetricsJob),
        attempt:
          typeof parsed.attempt === "number" && Number.isFinite(parsed.attempt)
            ? Math.max(0, Math.floor(parsed.attempt))
            : 0,
      };
      return { job: normalized, raw: str };
    }
    return null;
  } catch (e) {
    console.error("[youtube-metrics-queue] popJob (lmove) failed:", e);
    return null;
  }
}

export async function removeFromProcessingYouTube(rawJobString: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.lrem(REDIS_PROCESSING_KEY, 1, rawJobString);
  } catch (e) {
    console.error("[youtube-metrics-queue] removeFromProcessing failed:", e);
  }
}

export async function retryOrDeadLetterFromProcessingYouTube(options: {
  rawJobString: string;
  reason?: string;
}): Promise<{ requeued: boolean; deadLettered: boolean; attempts: number; error?: string }> {
  const redis = getRedis();
  if (!redis) {
    return {
      requeued: false,
      deadLettered: false,
      attempts: 0,
      error: "Redis not configured",
    };
  }
  try {
    const parsed = JSON.parse(options.rawJobString) as YouTubeMetricsJob;
    const nextAttempts = Math.max(
      1,
      (typeof parsed.attempt === "number" && Number.isFinite(parsed.attempt)
        ? Math.floor(parsed.attempt)
        : 0) + 1
    );
    const normalizedJob: YouTubeMetricsJob = {
      ...parsed,
      attempt: nextAttempts,
    };

    if (nextAttempts >= MAX_RETRY_ATTEMPTS) {
      await redis.lpush(
        REDIS_DEAD_LETTER_KEY,
        JSON.stringify({
          ...normalizedJob,
          deadLetteredAt: new Date().toISOString(),
          deadLetterReason: options.reason ?? "unknown",
        })
      );
      await removeFromProcessingYouTube(options.rawJobString);
      console.error(
        `[youtube-metrics-queue] Dead-lettered runId=${normalizedJob.runId} batchIndex=${normalizedJob.batchIndex} attempts=${nextAttempts}`
      );
      return { requeued: false, deadLettered: true, attempts: nextAttempts };
    }

    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(normalizedJob));
    await removeFromProcessingYouTube(options.rawJobString);
    console.warn(
      `[youtube-metrics-queue] Re-queued runId=${normalizedJob.runId} batchIndex=${normalizedJob.batchIndex} attempts=${nextAttempts}`
    );
    return { requeued: true, deadLettered: false, attempts: nextAttempts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[youtube-metrics-queue] retryOrDeadLetter failed:", message);
    return { requeued: false, deadLettered: false, attempts: 0, error: message };
  }
}

export type YouTubeProcessingRecoveryDecision = "recover" | "remove" | "keep";

/**
 * Recover only jobs whose run is known to be stale. A processing list also
 * contains healthy, currently executing jobs; moving those when the main queue
 * is momentarily empty runs the same batch twice and multiplies API calls.
 */
export async function recoverProcessingJobsToQueueYouTube(options: {
  maxToMove?: number;
  classifyJob: (
    job: YouTubeMetricsJob,
  ) => Promise<YouTubeProcessingRecoveryDecision>;
}): Promise<{ moved: number; removed: number; error?: string }> {
  const redis = getRedis();
  if (!redis) return { moved: 0, removed: 0, error: "Redis not configured" };
  const maxToMove = Math.max(1, Math.min(options.maxToMove ?? 25, 200));
  try {
    // Processing is LIFO at the head, so inspect the oldest jobs at the tail.
    const rawItems = await redis.lrange(REDIS_PROCESSING_KEY, -maxToMove, -1);
    if (!rawItems?.length) return { moved: 0, removed: 0 };

    let moved = 0;
    let removed = 0;
    for (const item of rawItems) {
      const raw = typeof item === "string" ? item : JSON.stringify(item);
      let job: YouTubeMetricsJob | null = null;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.contestId && parsed?.runId && parsed?.scope) {
          job = parsed as YouTubeMetricsJob;
        }
      } catch {
        // Invalid entries cannot be resumed safely.
      }

      const decision = job ? await options.classifyJob(job) : "remove";
      if (decision === "keep") continue;

      if (decision === "remove") {
        const count = await redis.lrem(REDIS_PROCESSING_KEY, 1, raw);
        if (Number(count) > 0) removed += 1;
        continue;
      }

      // Atomically remove the inspected stale entry and place it back on the
      // queue. A healthy worker's item remains in processing.
      const count = await redis.eval(
        "local removed = redis.call('LREM', KEYS[1], 1, ARGV[1]); if removed > 0 then redis.call('LPUSH', KEYS[2], ARGV[1]); end; return removed",
        [REDIS_PROCESSING_KEY, REDIS_QUEUE_KEY],
        [raw],
      );
      if (Number(count) > 0) moved += 1;
    }
    if (moved > 0 || removed > 0) {
      console.warn(
        `[youtube-metrics-queue] Re-queued ${moved} stale job(s); removed ${removed} terminal/invalid job(s)`,
      );
    }
    return { moved, removed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[youtube-metrics-queue] recoverProcessingJobsToQueue failed:", message);
    return { moved: 0, removed: 0, error: message };
  }
}
