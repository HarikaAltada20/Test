/**
 * Bulk payment queue (Upstash Redis).
 * LMOVE queue → processing, LREM after success,
 * bounded retry + dead-letter on failures.
 *
 * One Redis job = one creator payout batch (offset into items[]).
 *
 * Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from "@upstash/redis";
import { createAdminClient } from "@/utils/supabase/admin";
import { recoverStaleBulkProcessingJobs } from "@/lib/queue/bulk-job-recovery";
import { BULK_PAYMENT_MAX_ACTIVE_JOBS_GLOBAL } from "@/lib/queue/bulk-job-limits";

const REDIS_PREFIX = "bulk_payment";
const REDIS_QUEUE_KEY = `${REDIS_PREFIX}:queue`;
const REDIS_PROCESSING_KEY = `${REDIS_PREFIX}:processing`;
const REDIS_DEAD_LETTER_KEY = `${REDIS_PREFIX}:dead_letter`;
const MAX_RETRY_ATTEMPTS = 5;

/** Creators processed per queue hop (serial to avoid wallet races). */
export const BULK_PAYMENT_BATCH_SIZE = 1;

export type BulkPaymentType = "standard" | "bonus" | "both";
export type BulkPaymentPayoutChannel =
  | "submissions"
  | "twitter_cpm"
  | "twitter_creator";

export interface BulkPaymentQueueItem {
  creatorId: string;
  submissionIds: string[];
}

export interface BulkPaymentQueueJob {
  contestId: string;
  jobId: string;
  paymentType: BulkPaymentType;
  payoutChannel: BulkPaymentPayoutChannel;
  batchIndex: number;
  batchSize: number;
  totalBatches: number;
  /** Full creator pay list — persisted in Postgres; optional on Redis slim refs. */
  items?: BulkPaymentQueueItem[];
  /** Index into items for this chunk. Prefer DB queue_offset when processing. */
  offset?: number;
  attempt?: number;
}

/** Minimal Redis queue entry (payload lives in bulk_payment_jobs.payload). */
export type BulkPaymentQueueJobRef = Pick<
  BulkPaymentQueueJob,
  "contestId" | "jobId" | "batchIndex" | "attempt"
>;

function toSlimBulkPaymentQueueRef(
  job: Pick<BulkPaymentQueueJob, "contestId" | "jobId" | "batchIndex" | "attempt">,
): BulkPaymentQueueJobRef {
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
      console.warn("[bulk-payment-queue] UPSTASH_REDIS_REST_URL is missing");
    }
    if (!token) {
      console.warn("[bulk-payment-queue] UPSTASH_REDIS_REST_TOKEN is missing");
    }
    return null;
  }
  try {
    return Redis.fromEnv();
  } catch (e) {
    console.error("[bulk-payment-queue] Redis client creation failed:", e);
    return null;
  }
}

export function isBulkPaymentQueueEnabled(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

export function computeBulkPaymentTotalBatches(
  totalCount: number,
  batchSize: number = BULK_PAYMENT_BATCH_SIZE,
): number {
  const size = Math.max(1, batchSize);
  const total = Math.max(0, totalCount);
  return total === 0 ? 0 : Math.ceil(total / size);
}

function normalizeItems(raw: unknown): BulkPaymentQueueItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const creatorId = String(
        (item as BulkPaymentQueueItem).creatorId || "",
      ).trim();
      const submissionIds = Array.isArray(
        (item as BulkPaymentQueueItem).submissionIds,
      )
        ? (item as BulkPaymentQueueItem).submissionIds
            .map(String)
            .map((id) => id.trim())
            .filter(Boolean)
        : [];
      if (!creatorId || submissionIds.length === 0) return null;
      return { creatorId, submissionIds };
    })
    .filter((item): item is BulkPaymentQueueItem => item != null);
}

async function countActiveBulkPaymentJobIds(): Promise<Set<string>> {
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

export async function enqueueBulkPaymentJob(
  job: BulkPaymentQueueJobRef &
    Partial<Omit<BulkPaymentQueueJob, keyof BulkPaymentQueueJobRef>>,
): Promise<{ error?: string }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  try {
    const slim = toSlimBulkPaymentQueueRef({
      ...job,
      attempt: Number.isFinite(job.attempt) ? Number(job.attempt) : 0,
    });
    if (slim.batchIndex === 0) {
      const activeJobIds = await countActiveBulkPaymentJobIds();
      if (
        activeJobIds.size >= BULK_PAYMENT_MAX_ACTIVE_JOBS_GLOBAL &&
        !activeJobIds.has(slim.jobId)
      ) {
        return {
          error:
            "Too many bulk payment jobs are in progress. Wait for current jobs to finish, then try again.",
        };
      }
    }
    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(slim));
    console.log(
      `[bulk-payment-queue] Enqueued jobId=${slim.jobId} batchIndex=${slim.batchIndex} attempt=${slim.attempt}`,
    );
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[bulk-payment-queue] rpush failed:", message);
    return { error: message };
  }
}

export async function popBulkPaymentJob(): Promise<{
  job: BulkPaymentQueueJob;
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
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = JSON.parse(str) as BulkPaymentQueueJobRef & BulkPaymentQueueJob;
    if (parsed?.jobId && parsed?.contestId) {
      const legacyItems = normalizeItems(parsed.items);
      const normalized: BulkPaymentQueueJob = {
        contestId: String(parsed.contestId),
        jobId: String(parsed.jobId),
        paymentType:
          parsed.paymentType === "bonus" || parsed.paymentType === "both"
            ? parsed.paymentType
            : "standard",
        payoutChannel:
          parsed.payoutChannel === "twitter_cpm"
            ? "twitter_cpm"
            : parsed.payoutChannel === "twitter_creator"
              ? "twitter_creator"
              : "submissions",
        batchIndex:
          typeof parsed.batchIndex === "number" &&
          Number.isFinite(parsed.batchIndex)
            ? Math.max(0, Math.floor(parsed.batchIndex))
            : 0,
        batchSize:
          typeof parsed.batchSize === "number" &&
          Number.isFinite(parsed.batchSize)
            ? Math.max(1, Math.floor(parsed.batchSize))
            : BULK_PAYMENT_BATCH_SIZE,
        totalBatches:
          typeof parsed.totalBatches === "number" &&
          Number.isFinite(parsed.totalBatches)
            ? Math.max(0, Math.floor(parsed.totalBatches))
            : 0,
        items: legacyItems.length > 0 ? legacyItems : undefined,
        offset:
          typeof parsed.offset === "number" && Number.isFinite(parsed.offset)
            ? Math.max(0, Math.floor(parsed.offset))
            : undefined,
        attempt:
          typeof parsed.attempt === "number" && Number.isFinite(parsed.attempt)
            ? Math.max(0, Math.floor(parsed.attempt))
            : 0,
      };
      return { job: normalized, raw: str };
    }
    return null;
  } catch (e) {
    console.error("[bulk-payment-queue] popJob (lmove) failed:", e);
    return null;
  }
}

export async function removeBulkPaymentFromProcessing(
  rawJobString: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.lrem(REDIS_PROCESSING_KEY, 1, rawJobString);
  } catch (e) {
    console.error("[bulk-payment-queue] removeFromProcessing failed:", e);
  }
}

export async function retryOrDeadLetterBulkPayment(options: {
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
    const parsed = JSON.parse(options.rawJobString) as BulkPaymentQueueJobRef &
      BulkPaymentQueueJob;
    const nextAttempts = Math.max(
      1,
      (typeof parsed.attempt === "number" && Number.isFinite(parsed.attempt)
        ? Math.floor(parsed.attempt)
        : 0) + 1,
    );
    const slim = toSlimBulkPaymentQueueRef({
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
      await removeBulkPaymentFromProcessing(options.rawJobString);
      console.error(
        `[bulk-payment-queue] Dead-lettered jobId=${slim.jobId} batchIndex=${slim.batchIndex} attempts=${nextAttempts}`,
      );
      return { requeued: false, deadLettered: true, attempts: nextAttempts };
    }

    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(slim));
    await removeBulkPaymentFromProcessing(options.rawJobString);
    console.warn(
      `[bulk-payment-queue] Re-queued jobId=${slim.jobId} batchIndex=${slim.batchIndex} attempts=${nextAttempts}`,
    );
    return { requeued: true, deadLettered: false, attempts: nextAttempts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[bulk-payment-queue] retryOrDeadLetter failed:", message);
    return {
      requeued: false,
      deadLettered: false,
      attempts: 0,
      error: message,
    };
  }
}

function parseBulkPaymentJobId(raw: unknown): string | null {
  try {
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = JSON.parse(str) as BulkPaymentQueueJob;
    return parsed?.jobId ? String(parsed.jobId) : null;
  } catch {
    return null;
  }
}

export async function recoverBulkPaymentProcessingToQueue(options?: {
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
    parseJobId: parseBulkPaymentJobId,
    logPrefix: "bulk-payment-queue",
    getHeartbeat: async (jobId) => {
      const { data } = await supabaseAdmin
        .from("bulk_payment_jobs")
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
