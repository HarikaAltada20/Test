/**
 * Shared stale-processing recovery for Redis-backed bulk job queues
 * (payment, moderation). Mirrors video-download recovery semantics.
 */

import type { Redis } from "@upstash/redis";

/** Must exceed maxDuration (300s) with buffer for slow batches. */
export const BULK_JOB_STALE_PROCESSING_MS = 6 * 60 * 1000;

export type BulkJobRecoveryAction = "keep-processing" | "requeue" | "drop";

export type BulkJobDbHeartbeat = {
  status: "queued" | "running" | "completed" | "failed" | string | null;
  updatedAt: string | null;
};

export type BulkJobRecoveryPlanItem = {
  raw: string;
  action: BulkJobRecoveryAction;
};

const REQUEUE_FROM_PROCESSING_LUA = `
local removed = redis.call('LREM', KEYS[1], 1, ARGV[1])
if removed > 0 then
  redis.call('LPUSH', KEYS[2], ARGV[1])
end
return removed
`;

export function classifyRecoveredBulkJob(
  heartbeat: BulkJobDbHeartbeat | null,
  nowMs: number = Date.now(),
): BulkJobRecoveryAction {
  const status = heartbeat?.status ?? null;
  if (status === "completed" || status === "failed") {
    return "drop";
  }
  const updatedAt = heartbeat?.updatedAt ? Date.parse(heartbeat.updatedAt) : 0;
  if (
    (status === "running" || status === "queued") &&
    Number.isFinite(updatedAt) &&
    nowMs - updatedAt < BULK_JOB_STALE_PROCESSING_MS
  ) {
    return "keep-processing";
  }
  return "requeue";
}

export function planRecoveredBulkJobs(
  rawItems: unknown[],
  getHeartbeat: (jobId: string) => BulkJobDbHeartbeat | null,
  parseJobId: (raw: unknown) => string | null,
  nowMs: number = Date.now(),
): BulkJobRecoveryPlanItem[] {
  const heartbeats = new Map<string, BulkJobDbHeartbeat | null>();
  return rawItems.map((raw) => {
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    const jobId = parseJobId(raw);
    if (!jobId) return { raw: str, action: "drop" as const };
    if (!heartbeats.has(jobId)) {
      heartbeats.set(jobId, getHeartbeat(jobId));
    }
    return {
      raw: str,
      action: classifyRecoveredBulkJob(heartbeats.get(jobId) ?? null, nowMs),
    };
  });
}

export async function requeueFromProcessingList(
  redis: Redis,
  processingKey: string,
  queueKey: string,
  rawJobString: string,
): Promise<boolean> {
  try {
    const removed = await redis.eval(
      REQUEUE_FROM_PROCESSING_LUA,
      [processingKey, queueKey],
      [rawJobString],
    );
    return Number(removed) > 0;
  } catch (error) {
    console.warn(
      "[bulk-job-recovery] atomic requeue eval failed; copy then remove:",
      error,
    );
    await redis.lpush(queueKey, rawJobString);
    await redis.lrem(processingKey, 1, rawJobString);
    return true;
  }
}

export async function recoverStaleBulkProcessingJobs(options: {
  redis: Redis;
  processingKey: string;
  queueKey: string;
  maxToInspect?: number;
  parseJobId: (raw: unknown) => string | null;
  getHeartbeat: (jobId: string) => Promise<BulkJobDbHeartbeat | null>;
  logPrefix: string;
}): Promise<{ moved: number; dropped: number; error?: string }> {
  const maxToInspect = Math.max(
    1,
    Math.min(options.maxToInspect ?? 25, 200),
  );
  try {
    const rawItems = await redis.lrange(
      options.processingKey,
      0,
      maxToInspect - 1,
    );
    if (!rawItems?.length) return { moved: 0, dropped: 0 };

    const heartbeats = new Map<string, BulkJobDbHeartbeat | null>();
    for (const raw of rawItems) {
      const jobId = options.parseJobId(raw);
      if (!jobId || heartbeats.has(jobId)) continue;
      heartbeats.set(jobId, await options.getHeartbeat(jobId));
    }

    const plan = planRecoveredBulkJobs(
      rawItems,
      (jobId) => heartbeats.get(jobId) ?? null,
      options.parseJobId,
    );

    let moved = 0;
    let dropped = 0;
    for (const item of plan) {
      if (item.action === "keep-processing") continue;
      if (item.action === "drop") {
        await redis.lrem(options.processingKey, 1, item.raw);
        dropped += 1;
        continue;
      }
      const requeued = await requeueFromProcessingList(
        options.redis,
        options.processingKey,
        options.queueKey,
        item.raw,
      );
      if (requeued) moved += 1;
    }

    if (moved > 0 || dropped > 0) {
      console.warn(
        `[${options.logPrefix}] Re-queued ${moved} stale job(s) from processing; dropped ${dropped} finished/invalid job(s)`,
      );
    }
    return { moved, dropped };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${options.logPrefix}] recoverProcessingJobsToQueue failed:`, message);
    return { moved: 0, dropped: 0, error: message };
  }
}
