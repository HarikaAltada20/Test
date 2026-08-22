/**
 * Bulk submission moderation queue (Upstash Redis).
 * LMOVE queue → processing, LREM after success,
 * bounded retry + dead-letter on failures.
 *
 * Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from "@upstash/redis";
import { createAdminClient } from "@/utils/supabase/admin";
import { recoverStaleBulkProcessingJobs } from "@/lib/queue/bulk-job-recovery";

const REDIS_PREFIX = "bulk_submission_moderation";
const REDIS_QUEUE_KEY = `${REDIS_PREFIX}:queue`;
const REDIS_PROCESSING_KEY = `${REDIS_PREFIX}:processing`;
const REDIS_DEAD_LETTER_KEY = `${REDIS_PREFIX}:dead_letter`;
const MAX_RETRY_ATTEMPTS = 5;

export const BULK_MODERATION_BATCH_SIZE = 10;

export type BulkModerationAction = "verified" | "pending" | "rejected";

export interface BulkSubmissionModerationQueueJob {
  contestId: string;
  jobId: string;
  action: BulkModerationAction;
  batchIndex: number;
  batchSize: number;
  totalBatches: number;
  /** Full submission id list (DB no longer stores submission_ids). */
  submissionIds: string[];
  /** Index into submissionIds for this chunk (like YouTube cursor). */
  offset: number;
  attempt?: number;
  /**
   * After the first queue batch runs one full-selection wallet reversal,
   * later batches skip re-debit and reuse these skip ids / refund summaries.
   */
  walletPreflightDone?: boolean;
  walletSkipSubmissionIds?: string[];
  walletRefundSummaries?: Record<
    string,
    {
      reward_refunded_cents: number;
      bonus_refunded_cents: number;
      total_refunded_cents: number;
      cpm_refunded_cents: number;
      milestone_refunded_cents: number;
    }
  >;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    if (!url) {
      console.warn(
        "[bulk-submission-moderation-queue] UPSTASH_REDIS_REST_URL is missing",
      );
    }
    if (!token) {
      console.warn(
        "[bulk-submission-moderation-queue] UPSTASH_REDIS_REST_TOKEN is missing",
      );
    }
    return null;
  }
  try {
    return Redis.fromEnv();
  } catch (e) {
    console.error(
      "[bulk-submission-moderation-queue] Redis client creation failed:",
      e,
    );
    return null;
  }
}

export function isBulkSubmissionModerationQueueEnabled(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

export function computeBulkModerationTotalBatches(
  totalCount: number,
  batchSize: number = BULK_MODERATION_BATCH_SIZE,
): number {
  const size = Math.max(1, batchSize);
  const total = Math.max(0, totalCount);
  return total === 0 ? 0 : Math.ceil(total / size);
}

export async function enqueueBulkSubmissionModerationJob(
  job: BulkSubmissionModerationQueueJob,
): Promise<{ error?: string }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  try {
    const normalizedJob: BulkSubmissionModerationQueueJob = {
      ...job,
      attempt: Number.isFinite(job.attempt) ? Number(job.attempt) : 0,
    };
    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(normalizedJob));
    console.log(
      `[bulk-submission-moderation-queue] Enqueued jobId=${normalizedJob.jobId} batchIndex=${normalizedJob.batchIndex} action=${normalizedJob.action} attempt=${normalizedJob.attempt}`,
    );
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[bulk-submission-moderation-queue] rpush failed:",
      message,
    );
    return { error: message };
  }
}

export async function popBulkSubmissionModerationJob(): Promise<{
  job: BulkSubmissionModerationQueueJob;
  raw: string;
} | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    // FIFO: append with RPUSH, consume from LEFT (same as YouTube).
    const raw = await redis.lmove(
      REDIS_QUEUE_KEY,
      REDIS_PROCESSING_KEY,
      "left",
      "left",
    );
    if (raw === null || raw === undefined) return null;
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = JSON.parse(str) as BulkSubmissionModerationQueueJob;
    if (parsed?.jobId && parsed?.contestId) {
      const submissionIds = Array.isArray(parsed.submissionIds)
        ? parsed.submissionIds.map(String).filter(Boolean)
        : [];
      const normalized: BulkSubmissionModerationQueueJob = {
        ...parsed,
        submissionIds,
        batchIndex:
          typeof parsed.batchIndex === "number" &&
          Number.isFinite(parsed.batchIndex)
            ? Math.max(0, Math.floor(parsed.batchIndex))
            : 0,
        batchSize:
          typeof parsed.batchSize === "number" &&
          Number.isFinite(parsed.batchSize)
            ? Math.max(1, Math.floor(parsed.batchSize))
            : BULK_MODERATION_BATCH_SIZE,
        totalBatches:
          typeof parsed.totalBatches === "number" &&
          Number.isFinite(parsed.totalBatches)
            ? Math.max(0, Math.floor(parsed.totalBatches))
            : 0,
        offset:
          typeof parsed.offset === "number" && Number.isFinite(parsed.offset)
            ? Math.max(0, Math.floor(parsed.offset))
            : 0,
        attempt:
          typeof parsed.attempt === "number" && Number.isFinite(parsed.attempt)
            ? Math.max(0, Math.floor(parsed.attempt))
            : 0,
      };
      return { job: normalized, raw: str };
    }
    // Legacy payloads that only had { jobId } — cannot process without IDs in Redis.
    if (parsed?.jobId) {
      return {
        job: {
          contestId: "",
          jobId: String(parsed.jobId),
          action: "pending",
          batchIndex: 0,
          batchSize: BULK_MODERATION_BATCH_SIZE,
          totalBatches: 0,
          submissionIds: [],
          offset: 0,
          attempt: 0,
        },
        raw: str,
      };
    }
    return null;
  } catch (e) {
    console.error(
      "[bulk-submission-moderation-queue] popJob (lmove) failed:",
      e,
    );
    return null;
  }
}

export async function removeBulkSubmissionModerationFromProcessing(
  rawJobString: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.lrem(REDIS_PROCESSING_KEY, 1, rawJobString);
  } catch (e) {
    console.error(
      "[bulk-submission-moderation-queue] removeFromProcessing failed:",
      e,
    );
  }
}

export async function retryOrDeadLetterBulkSubmissionModeration(options: {
  rawJobString: string;
  reason?: string;
}): Promise<{
  requeued: boolean;
  deadLettered: boolean;
  attempts: number;
  error?: string;
}> {
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
    const parsed = JSON.parse(
      options.rawJobString,
    ) as BulkSubmissionModerationQueueJob;
    const nextAttempts = Math.max(
      1,
      (typeof parsed.attempt === "number" && Number.isFinite(parsed.attempt)
        ? Math.floor(parsed.attempt)
        : 0) + 1,
    );
    const normalizedJob: BulkSubmissionModerationQueueJob = {
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
        }),
      );
      await removeBulkSubmissionModerationFromProcessing(options.rawJobString);
      console.error(
        `[bulk-submission-moderation-queue] Dead-lettered jobId=${normalizedJob.jobId} batchIndex=${normalizedJob.batchIndex} attempts=${nextAttempts}`,
      );
      return { requeued: false, deadLettered: true, attempts: nextAttempts };
    }

    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(normalizedJob));
    await removeBulkSubmissionModerationFromProcessing(options.rawJobString);
    console.warn(
      `[bulk-submission-moderation-queue] Re-queued jobId=${normalizedJob.jobId} batchIndex=${normalizedJob.batchIndex} attempts=${nextAttempts}`,
    );
    return { requeued: true, deadLettered: false, attempts: nextAttempts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[bulk-submission-moderation-queue] retryOrDeadLetter failed:",
      message,
    );
    return {
      requeued: false,
      deadLettered: false,
      attempts: 0,
      error: message,
    };
  }
}

function parseBulkModerationJobId(raw: unknown): string | null {
  try {
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = JSON.parse(str) as BulkSubmissionModerationQueueJob;
    return parsed?.jobId ? String(parsed.jobId) : null;
  } catch {
    return null;
  }
}

export async function recoverBulkSubmissionModerationProcessingToQueue(options?: {
  maxToMove?: number;
}): Promise<{ moved: number; error?: string }> {
  const redis = getRedis();
  if (!redis) return { moved: 0, error: "Redis not configured" };
  const supabaseAdmin = createAdminClient();
  const result = await recoverStaleBulkProcessingJobs({
    redis,
    processingKey: REDIS_PROCESSING_KEY,
    queueKey: REDIS_QUEUE_KEY,
    maxToInspect: options?.maxToMove,
    parseJobId: parseBulkModerationJobId,
    logPrefix: "bulk-submission-moderation-queue",
    getHeartbeat: async (jobId) => {
      const { data } = await supabaseAdmin
        .from("bulk_submission_moderation_jobs")
        .select("status, updated_at")
        .eq("id", jobId)
        .maybeSingle();
      if (!data) return null;
      return {
        status: data.status as string,
        updatedAt: data.updated_at as string | null,
      };
    },
  });
  return { moved: result.moved, error: result.error };
}
