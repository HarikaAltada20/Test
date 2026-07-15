/**
 * Instagram insights refresh queue using Upstash Redis.
 * Separate key from Twitter metrics queue. Uses LMOVE (queue -> processing) for
 * crash-safe pop; after worker succeeds, LREM from processing.
 *
 * Env:
 * - UPSTASH_REDIS_INSTAGRAM_REST_URL, UPSTASH_REDIS_INSTAGRAM_REST_TOKEN (preferred)
 * - fallback: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from "@upstash/redis";

const REDIS_PREFIX = "instagram_insights_refresh";
const REDIS_QUEUE_KEY = `${REDIS_PREFIX}:queue`;
const REDIS_PROCESSING_KEY = `${REDIS_PREFIX}:processing`;

export interface InstagramInsightsJobCursor {
  last_insights_update: string | null;
  id: string;
}

export interface InstagramInsightsJob {
  contestId: string;
  runId: string;
  batchIndex: number;
  batchSize: number;
  totalBatches: number;
  cursor?: InstagramInsightsJobCursor;
  /**
   * When "post_campaign", batch reads/writes post_campaign_submission_metrics
   * and bypasses post-contest metrics lock. Default: submissions.
   */
  metricsTarget?: "submissions" | "post_campaign";
}

function getInstagramRedisEnv(): { url?: string; token?: string; using: "instagram" | "shared" } {
  const igUrl = process.env.UPSTASH_REDIS_INSTAGRAM_REST_URL?.trim();
  const igToken = process.env.UPSTASH_REDIS_INSTAGRAM_REST_TOKEN?.trim();
  if (igUrl && igToken) return { url: igUrl, token: igToken, using: "instagram" };

  const sharedUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const sharedToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return { url: sharedUrl, token: sharedToken, using: "shared" };
}

function getRedis(): Redis | null {
  const { url, token, using } = getInstagramRedisEnv();
  if (!url || !token) {
    if (using === "instagram") {
      if (!url)
        console.warn("[instagram-insights-queue] UPSTASH_REDIS_INSTAGRAM_REST_URL is missing");
      if (!token)
        console.warn("[instagram-insights-queue] UPSTASH_REDIS_INSTAGRAM_REST_TOKEN is missing");
    } else {
      if (!url) console.warn("[instagram-insights-queue] UPSTASH_REDIS_REST_URL is missing");
      if (!token) console.warn("[instagram-insights-queue] UPSTASH_REDIS_REST_TOKEN is missing");
    }
    return null;
  }
  try {
    // NOTE: Redis.fromEnv() only reads UPSTASH_REDIS_REST_URL/TOKEN.
    // For Instagram-specific env vars, construct the client manually.
    if (using === "shared" && typeof process !== "undefined" && process?.env) return Redis.fromEnv();
    return new Redis({ url, token });
  } catch (e) {
    console.error("[instagram-insights-queue] Redis client creation failed:", e);
    return null;
  }
}

export function isInstagramInsightsQueueEnabled(): boolean {
  const { url, token } = getInstagramRedisEnv();
  return !!(url && token);
}

/**
 * Enqueue a job (push to main queue).
 */
export async function enqueueInstagramInsightsJob(
  job: InstagramInsightsJob
): Promise<{ error?: string }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  try {
    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(job));
    console.log(`[instagram-insights-queue] Enqueued runId=${job.runId} batchIndex=${job.batchIndex}`);
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[instagram-insights-queue] rpush failed:", message);
    return { error: message };
  }
}

/**
 * Atomically pop one job from queue into processing list (LMOVE right -> left = RPOPLPUSH semantics).
 * Returns the job payload and raw string (use raw for removeFromProcessing so LREM matches).
 */
export async function popInstagramInsightsJob(): Promise<{ job: InstagramInsightsJob; raw: string } | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.lmove(REDIS_QUEUE_KEY, REDIS_PROCESSING_KEY, "right", "left");
    if (raw === null || raw === undefined) return null;
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = JSON.parse(str);
    if (parsed?.contestId && parsed?.runId != null) {
      return { job: parsed as InstagramInsightsJob, raw: str };
    }
    return null;
  } catch (e) {
    console.error("[instagram-insights-queue] popJob (lmove) failed:", e);
    return null;
  }
}

/**
 * Remove job from processing list after successful completion (LREM count 1).
 * Pass the raw string from popInstagramInsightsJob so the list element matches exactly.
 */
export async function removeFromProcessing(rawJobString: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.lrem(REDIS_PROCESSING_KEY, 1, rawJobString);
  } catch (e) {
    console.error("[instagram-insights-queue] removeFromProcessing failed:", e);
  }
}

/**
 * Best-effort recovery: move jobs from processing back into queue.
 *
 * Why: We use LMOVE(queue -> processing) for crash-safe pops. If the processor
 * crashes after moving an item but before `removeFromProcessing`, the job will
 * remain stuck in `:processing` and the queue appears empty. This function
 * re-queues those stranded jobs so the system can resume.
 *
 * NOTE: We do not have timestamps on list entries, so this is conservative and
 * bounded. Reprocessing is safe because the worker uses `current_batch_index`
 * to prevent double-counting and batch selection is guarded by `run.started_at`.
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
      // Move from processing back to queue.
      // We pop from the RIGHT of processing (oldest) and push to the LEFT of queue
      // so older stuck jobs are retried first.
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
      console.warn(`[instagram-insights-queue] Re-queued ${moved} job(s) from processing`);
    }
    return { moved };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[instagram-insights-queue] recoverProcessingJobsToQueue failed:", message);
    return { moved: 0, error: message };
  }
}
