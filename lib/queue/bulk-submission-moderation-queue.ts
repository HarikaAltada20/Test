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
import { BULK_MODERATION_MAX_ACTIVE_JOBS_GLOBAL } from "@/lib/queue/bulk-job-limits";

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
  /** Persisted in Postgres; optional on Redis slim refs. */
  submissionIds?: string[];
  /** Prefer DB queue_offset when processing. */
  offset?: number;
  attempt?: number;
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

export type BulkSubmissionModerationQueueJobRef = Pick<
  BulkSubmissionModerationQueueJob,
  "contestId" | "jobId" | "batchIndex" | "attempt"
>;

function toSlimBulkModerationQueueRef(
  job: Pick<
    BulkSubmissionModerationQueueJob,
    "contestId" | "jobId" | "batchIndex" | "attempt"
  >,
): BulkSubmissionModerationQueueJobRef {
  return {
    contestId: job.contestId,
    jobId: job.jobId,
    batchIndex:
      typeof job.batchIndex === "number" && Number.isFinite(job.batchIndex)
        ? Math.max(0, Math.floor(job.batchIndex))
        : 0,
    attempt:
      typeof job.attempt === "number" && Number.isFinite(job.attempt)
        ? Math.max(0, Math.floor(job.attempt))
        : 0,
  };
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

async function countActiveBulkModerationJobIds(): Promise<Set<string>> {
  const redis = getRedis();
  if (!redis) return new Set();
  const [queuedLen, processingLen] = await Promise.all([
    redis.llen(REDIS_QUEUE_KEY),
    redis.llen(REDIS_PROCESSING_KEY),
  ]);
  const scanLimit = Math.max(
    Number(queuedLen) || 0,
    Number(processingLen) || 0,
    1,
  );
  const [queued, processing] = await Promise.all([
    redis.lrange(REDIS_QUEUE_KEY, 0, scanLimit - 1),
    redis.lrange(REDIS_PROCESSING_KEY, 0, scanLimit - 1),
  ]);
  const jobIds = new Set<string>();
  for (const raw of [...(queued || []), ...(processing || [])]) {
    try {
      const str = typeof raw === "string" ? raw : JSON.stringify(raw);
      const parsed = JSON.parse(str) as { jobId?: string };
      if (parsed?.jobId) jobIds.add(String(parsed.jobId));
    } catch {
      // ignore malformed queue entries
    }
  }
  return jobIds;
}

export async function enqueueBulkSubmissionModerationJob(
  job: BulkSubmissionModerationQueueJobRef &
    Partial<
      Omit<BulkSubmissionModerationQueueJob, keyof BulkSubmissionModerationQueueJobRef>
    >,
): Promise<{ error?: string }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  try {
    const slim = toSlimBulkModerationQueueRef({
      ...job,
      attempt: Number.isFinite(job.attempt) ? Number(job.attempt) : 0,
    });
    if (slim.batchIndex === 0) {
      const activeJobIds = await countActiveBulkModerationJobIds();
      if (
        activeJobIds.size >= BULK_MODERATION_MAX_ACTIVE_JOBS_GLOBAL &&
        !activeJobIds.has(slim.jobId)
      ) {
        return {
          error:
            "Too many bulk moderation jobs are in progress. Wait for current jobs to finish, then try again.",
        };
      }
    }
    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(slim));
    console.log(
      `[bulk-submission-moderation-queue] Enqueued jobId=${slim.jobId} batchIndex=${slim.batchIndex} attempt=${slim.attempt}`,
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
    const parsed = JSON.parse(str) as BulkSubmissionModerationQueueJobRef &
      BulkSubmissionModerationQueueJob;
    if (parsed?.jobId && parsed?.contestId) {
      const legacyIds = Array.isArray(parsed.submissionIds)
        ? parsed.submissionIds.map(String).filter(Boolean)
        : [];
      const normalized: BulkSubmissionModerationQueueJob = {
        contestId: String(parsed.contestId),
        jobId: String(parsed.jobId),
        action:
          parsed.action === "verified" ||
          parsed.action === "pending" ||
          parsed.action === "rejected"
            ? parsed.action
            : // Slim Redis refs omit action; processor reads it from the DB job row.
              "pending",
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
        submissionIds: legacyIds.length > 0 ? legacyIds : undefined,
        offset:
          typeof parsed.offset === "number" && Number.isFinite(parsed.offset)
            ? Math.max(0, Math.floor(parsed.offset))
            : undefined,
        attempt:
          typeof parsed.attempt === "number" && Number.isFinite(parsed.attempt)
            ? Math.max(0, Math.floor(parsed.attempt))
            : 0,
        walletPreflightDone: parsed.walletPreflightDone,
        walletSkipSubmissionIds: parsed.walletSkipSubmissionIds,
        walletRefundSummaries: parsed.walletRefundSummaries,
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
    ) as BulkSubmissionModerationQueueJobRef &
      BulkSubmissionModerationQueueJob;
    const nextAttempts = Math.max(
      1,
      (typeof parsed.attempt === "number" && Number.isFinite(parsed.attempt)
        ? Math.floor(parsed.attempt)
        : 0) + 1,
    );
    const slim = toSlimBulkModerationQueueRef({
      contestId: String(parsed.contestId),
      jobId: String(parsed.jobId),
      batchIndex:
        typeof parsed.batchIndex === "number" &&
        Number.isFinite(parsed.batchIndex)
          ? Math.max(0, Math.floor(parsed.batchIndex))
          : 0,
      attempt: nextAttempts,
    });

    if (nextAttempts >= MAX_RETRY_ATTEMPTS) {
      await redis.lpush(
        REDIS_DEAD_LETTER_KEY,
        JSON.stringify({
          ...slim,
          deadLetteredAt: new Date().toISOString(),
          deadLetterReason: options.reason ?? "unknown",
        }),
      );
      await removeBulkSubmissionModerationFromProcessing(options.rawJobString);
      console.error(
        `[bulk-submission-moderation-queue] Dead-lettered jobId=${slim.jobId} batchIndex=${slim.batchIndex} attempts=${nextAttempts}`,
      );
      return { requeued: false, deadLettered: true, attempts: nextAttempts };
    }

    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(slim));
    await removeBulkSubmissionModerationFromProcessing(options.rawJobString);
    console.warn(
      `[bulk-submission-moderation-queue] Re-queued jobId=${slim.jobId} batchIndex=${slim.batchIndex} attempts=${nextAttempts}`,
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
