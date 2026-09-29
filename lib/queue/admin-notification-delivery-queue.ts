/**
 * Admin notification campaign delivery queue (Upstash Redis).
 * Mirrors LMOVE queue → processing, LREM after success.
 *
 * Job payload is only { campaignId }; the worker loads the next pending batch from DB.
 *
 * Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from "@upstash/redis";

const REDIS_PREFIX = "admin_notification_delivery";
const REDIS_QUEUE_KEY = `${REDIS_PREFIX}:queue`;
const REDIS_PROCESSING_KEY = `${REDIS_PREFIX}:processing`;

export interface AdminNotificationDeliveryJob {
  campaignId: string;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    if (!url)
      console.warn(
        "[admin-notification-delivery-queue] UPSTASH_REDIS_REST_URL is missing",
      );
    if (!token)
      console.warn(
        "[admin-notification-delivery-queue] UPSTASH_REDIS_REST_TOKEN is missing",
      );
    return null;
  }
  try {
    return Redis.fromEnv();
  } catch (e) {
    console.error(
      "[admin-notification-delivery-queue] Redis client creation failed:",
      e,
    );
    return null;
  }
}

export function isAdminNotificationDeliveryQueueEnabled(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

export async function enqueueAdminNotificationDeliveryJob(
  job: AdminNotificationDeliveryJob,
): Promise<{ error?: string }> {
  const redis = getRedis();
  if (!redis) return { error: "Redis not configured" };
  try {
    await redis.rpush(REDIS_QUEUE_KEY, JSON.stringify(job));
    console.log(
      `[admin-notification-delivery-queue] Enqueued campaignId=${job.campaignId}`,
    );
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-notification-delivery-queue] rpush failed:", message);
    return { error: message };
  }
}

export async function popAdminNotificationDeliveryJob(): Promise<{
  job: AdminNotificationDeliveryJob;
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
    const parsed = JSON.parse(str) as AdminNotificationDeliveryJob;
    if (parsed?.campaignId) {
      return { job: parsed, raw: str };
    }
    return null;
  } catch (e) {
    console.error("[admin-notification-delivery-queue] popJob (lmove) failed:", e);
    return null;
  }
}

export async function removeAdminNotificationDeliveryFromProcessing(
  rawJobString: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.lrem(REDIS_PROCESSING_KEY, 1, rawJobString);
  } catch (e) {
    console.error(
      "[admin-notification-delivery-queue] removeFromProcessing failed:",
      e,
    );
  }
}

export async function recoverAdminNotificationDeliveryProcessingToQueue(options?: {
  maxToMove?: number;
}): Promise<{ moved: number; error?: string }> {
  const redis = getRedis();
  if (!redis) return { moved: 0, error: "Redis not configured" };
  const maxToMove = Math.max(1, Math.min(options?.maxToMove ?? 25, 200));
  try {
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
    if (moved > 0) {
      console.warn(
        `[admin-notification-delivery-queue] Re-queued ${moved} job(s) from processing`,
      );
    }
    return { moved };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[admin-notification-delivery-queue] recoverProcessingJobsToQueue failed:",
      message,
    );
    return { moved: 0, error: message };
  }
}
