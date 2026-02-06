/**
 * QStash integration for metrics refresh queue.
 * When enabled, jobs trigger the process-metrics-queue endpoint via QStash
 * (retries, rate limiting, no Vercel cron needed). Falls back to CRON_SECRET
 * or direct fetch when QStash is not configured.
 *
 * Env: QSTASH_TOKEN (publish), QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY (verify).
 */

import { Client, Receiver } from "@upstash/qstash";

function getBaseUrl(): string {
  const url = process.env.VERCEL_URL;
  if (url) return `https://${url}`;
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/** QStash cannot deliver to localhost; detect loopback so callers can fall back to direct POST. */
export function isLoopbackUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1")
      return true;
    if (host.startsWith("127.") || host.endsWith(".localhost")) return true;
    return false;
  } catch {
    return true;
  }
}

/** Whether QStash is configured for publishing (trigger process-metrics-queue). */
export function isQStashEnabled(): boolean {
  return !!process.env.QSTASH_TOKEN?.trim();
}

/** Get QStash client or null if not configured. */
function getQStashClient(): Client | null {
  if (!isQStashEnabled()) return null;
  try {
    return new Client({ token: process.env.QSTASH_TOKEN! });
  } catch {
    return null;
  }
}

/**
 * Trigger the process-metrics-queue endpoint via QStash so one job gets processed.

 * Call after enqueueing a job (or after enqueueing the next batch in the processor).
 */
export async function triggerProcessMetricsQueue(
  baseUrl?: string
): Promise<{ messageId?: string; error?: string }> {
  const client = getQStashClient();
  if (!client) {
    return { error: "QStash not configured" };
  }
  const url = `${baseUrl ?? getBaseUrl()}/api/cron/process-metrics-queue`;
  if (isLoopbackUrl(url)) {
    return { error: "Loopback URL; QStash cannot reach localhost" };
  }
  try {
    const res = await client.publishJSON({
      url,
      body: {},
      method: "POST",
    });
    return { messageId: (res as { messageId?: string }).messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[qstash] triggerProcessMetricsQueue failed:", message);
    return { error: message };
  }
}

/**
 * Canonical URL for the process-metrics-queue endpoint (used when publishing and when verifying).

 * public URL, so we verify with this canonical URL so signature verification succeeds.
 */
function getProcessMetricsQueueUrl(): string {
  return `${getBaseUrl()}/api/cron/process-metrics-queue`;
}

/**
 * Verify that the request is from QStash (Upstash-Signature).
 * Use with the raw body string; call before consuming the body.
 * Verifies against the canonical public URL (from env) so it works behind tunnels (ngrok).
 */
export async function verifyQStashSignature(
  request: Request,
  rawBody: string
): Promise<boolean> {
  const signature = request.headers.get("Upstash-Signature");
  if (!signature || typeof signature !== "string") return false;
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  if (!currentKey && !nextKey) return false;
  try {
    const receiver = new Receiver({
      currentSigningKey: currentKey,
      nextSigningKey: nextKey,
    });
    // Use canonical URL so verification works when request.url is localhost (e.g. ngrok → localhost)
    const url = getProcessMetricsQueueUrl();
    await receiver.verify({
      signature,
      body: rawBody,
      url,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Authorize process-metrics-queue: either valid QStash signature or Bearer CRON_SECRET.
 * Pass the raw body (from await request.text()).
 */
export async function authorizeProcessMetricsQueue(
  request: Request,
  rawBody: string
): Promise<boolean> {
  if (request.headers.get("Upstash-Signature")) {
    return verifyQStashSignature(request, rawBody);
  }
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("Authorization");
  if (cronSecret) {
    return auth === `Bearer ${cronSecret}`;
  }
  // No CRON_SECRET and no QStash: allow for local dev (same as current behavior when secret unset)
  return true;
}
