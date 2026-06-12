/**
 * Admin email campaign delivery queue (Upstash Redis).
 */

import { Redis } from "@upstash/redis";

const REDIS_PREFIX = "admin_email_delivery";
const REDIS_QUEUE_KEY = `${REDIS_PREFIX}:queue`;
const REDIS_PROCESSING_KEY = `${REDIS_PREFIX}:processing`;

export interface AdminEmailDeliveryJob {
  campaignId: string;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

export function isAdminEmailDeliveryQueueEnabled(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

export async function enqueueAdminEmailDeliveryJob(
  job: AdminEmailDeliveryJob,
): Promise<{ error?: string }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  try {
    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(job));
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

export async function popAdminEmailDeliveryJob(): Promise<{
  job: AdminEmailDeliveryJob;
  raw: string;
} | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.lmove(
      REDIS_QUEUE_KEY,
      REDIS_PROCESSING_KEY,
      "right",
      "left",
    );
    if (raw === null || raw === undefined) return null;
    const str = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = JSON.parse(str) as AdminEmailDeliveryJob;
    if (parsed?.campaignId) return { job: parsed, raw: str };
    return null;
  } catch {
    return null;
  }
}

export async function removeAdminEmailDeliveryFromProcessing(
  rawJobString: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.lrem(REDIS_PROCESSING_KEY, 1, rawJobString);
  } catch {
    // ignore
  }
}

export async function recoverAdminEmailDeliveryProcessingToQueue(options?: {
  maxToMove?: number;
}): Promise<{ moved: number }> {
  const redis = getRedis();
  if (!redis) return { moved: 0 };
  const maxToMove = Math.max(1, Math.min(options?.maxToMove ?? 25, 200));
  let moved = 0;
  for (let i = 0; i < maxToMove; i++) {
    const raw = await redis.lmove(
      REDIS_PROCESSING_KEY,
      REDIS_QUEUE_KEY,
      "right",
      "left",
    );
    if (raw === null || raw === undefined) break;
    moved += 1;
  }
  return { moved };
}
