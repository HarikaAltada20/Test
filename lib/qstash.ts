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
  const url =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return url.replace(/\/$/, "");
}

function getForwardedOrigin(request: Request): string | null {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    ?? request.headers.get("host")?.split(",")[0]?.trim();
  if (!proto || !host) return null;
  return `${proto}://${host}`;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    const s = v.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

async function verifyQStashAgainstUrls(
  receiver: Receiver,
  signature: string,
  rawBody: string,
  urls: string[],
): Promise<boolean> {
  for (const url of urls) {
    try {
      await receiver.verify({ signature, body: rawBody, url });
      return true;
    } catch {
      // try next url
    }
  }
  return false;
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
  baseUrl?: string,
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
 * Public URL, so we verify with this canonical URL so signature verification succeeds.
 */
function getProcessMetricsQueueUrl(): string {
  return `${getBaseUrl()}/api/cron/process-metrics-queue`;
}

/** Canonical URL for the Instagram insights queue processor. */
function getProcessInstagramInsightsQueueUrl(): string {
  return `${getBaseUrl()}/api/cron/process-instagram-insights-queue`;
}

/** Canonical URL for the TikTok metrics queue processor. */
function getProcessTikTokMetricsQueueUrl(): string {
  return `${getBaseUrl()}/api/cron/process-tiktok-metrics-queue`;
}

/** Canonical URL for the YouTube metrics queue processor. */
function getProcessYouTubeMetricsQueueUrl(): string {
  return `${getBaseUrl()}/api/cron/process-youtube-metrics-queue`;
}

/** Canonical URL for the token refresh queue processor. */
function getProcessTokenRefreshQueueUrl(): string {
  return `${getBaseUrl()}/api/cron/process-token-refresh-queue`;
}

/**
 * Verify that the request is from QStash (Upstash-Signature).
 * Use with the raw body string; call before consuming the body.
 * Verifies against the canonical public URL (from env) so it works behind tunnels (ngrok).
 */
export async function verifyQStashSignature(
  request: Request,
  rawBody: string,
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
    // Prefer verifying against the *public* URL QStash called.
    // This supports Cloudflare Tunnel / proxies where request.url and NEXT_PUBLIC_APP_URL can differ.
    const forwardedOrigin = getForwardedOrigin(request);
    const requestUrl = (() => {
      try {
        return new URL(request.url);
      } catch {
        return null;
      }
    })();
    const candidates = uniqueStrings([
      getProcessMetricsQueueUrl(),
      forwardedOrigin ? `${forwardedOrigin}/api/cron/process-metrics-queue` : null,
      requestUrl ? `${requestUrl.origin}/api/cron/process-metrics-queue` : null,
      requestUrl?.toString() ?? null,
    ]);
    return verifyQStashAgainstUrls(receiver, signature, rawBody, candidates);
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
  rawBody: string,
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

/**
 * Trigger the process-instagram-insights-queue endpoint via QStash.
 */
export async function triggerProcessInstagramInsightsQueue(
  baseUrl?: string,
): Promise<{ messageId?: string; error?: string }> {
  const client = getQStashClient();
  if (!client) return { error: "QStash not configured" };
  const url = `${baseUrl ?? getBaseUrl()}/api/cron/process-instagram-insights-queue`;
  if (isLoopbackUrl(url))
    return { error: "Loopback URL; QStash cannot reach localhost" };
  try {
    const res = await client.publishJSON({
      url,
      body: {},
      method: "POST",
    });
    return { messageId: (res as { messageId?: string }).messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[qstash] triggerProcessInstagramInsightsQueue failed:",
      message,
    );
    return { error: message };
  }
}

/**
 * Trigger the process-tiktok-metrics-queue endpoint via QStash.
 */
export async function triggerProcessTikTokMetricsQueue(
  baseUrl?: string,
): Promise<{ messageId?: string; error?: string }> {
  const client = getQStashClient();
  if (!client) return { error: "QStash not configured" };
  const url = `${baseUrl ?? getBaseUrl()}/api/cron/process-tiktok-metrics-queue`;
  if (isLoopbackUrl(url))
    return { error: "Loopback URL; QStash cannot reach localhost" };
  try {
    const res = await client.publishJSON({
      url,
      body: {},
      method: "POST",
    });
    return { messageId: (res as { messageId?: string }).messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[qstash] triggerProcessTikTokMetricsQueue failed:",
      message,
    );
    return { error: message };
  }
}

/**
 * Trigger the process-youtube-metrics-queue endpoint via QStash.
 */
export async function triggerProcessYouTubeMetricsQueue(
  baseUrl?: string,
): Promise<{ messageId?: string; error?: string }> {
  const client = getQStashClient();
  if (!client) return { error: "QStash not configured" };
  const url = `${baseUrl ?? getBaseUrl()}/api/cron/process-youtube-metrics-queue`;
  if (isLoopbackUrl(url))
    return { error: "Loopback URL; QStash cannot reach localhost" };
  try {
    const res = await client.publishJSON({
      url,
      body: {},
      method: "POST",
    });
    return { messageId: (res as { messageId?: string }).messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[qstash] triggerProcessYouTubeMetricsQueue failed:", message);
    return { error: message };
  }
}

/**
 * Trigger the process-token-refresh-queue endpoint via QStash.
 */
export async function triggerProcessTokenRefreshQueue(
  baseUrl?: string,
): Promise<{ messageId?: string; error?: string }> {
  const client = getQStashClient();
  if (!client) return { error: "QStash not configured" };
  const url = `${baseUrl ?? getBaseUrl()}/api/cron/process-token-refresh-queue`;
  if (isLoopbackUrl(url))
    return { error: "Loopback URL; QStash cannot reach localhost" };
  try {
    const res = await client.publishJSON({
      url,
      body: {},
      method: "POST",
    });
    return { messageId: (res as { messageId?: string }).messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[qstash] triggerProcessTokenRefreshQueue failed:",
      message,
    );
    return { error: message };
  }
}

/**
 * Verify QStash signature for the Instagram processor URL (for use when request is to that endpoint).
 */
async function verifyQStashSignatureInstagram(
  request: Request,
  rawBody: string,
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
    const forwardedOrigin = getForwardedOrigin(request);
    const requestUrl = (() => {
      try {
        return new URL(request.url);
      } catch {
        return null;
      }
    })();
    const candidates = uniqueStrings([
      getProcessInstagramInsightsQueueUrl(),
      forwardedOrigin ? `${forwardedOrigin}/api/cron/process-instagram-insights-queue` : null,
      requestUrl ? `${requestUrl.origin}/api/cron/process-instagram-insights-queue` : null,
      requestUrl?.toString() ?? null,
    ]);
    return verifyQStashAgainstUrls(receiver, signature, rawBody, candidates);
  } catch {
    return false;
  }
}

/**
 * Authorize process-instagram-insights-queue: QStash signature (Instagram URL) or Bearer CRON_SECRET.
 */
export async function authorizeProcessInstagramInsightsQueue(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  if (request.headers.get("Upstash-Signature")) {
    return verifyQStashSignatureInstagram(request, rawBody);
  }
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("Authorization");
  if (cronSecret) return auth === `Bearer ${cronSecret}`;
  return true;
}

/**
 * Verify QStash signature for the TikTok processor URL.
 */
export async function verifyQStashSignatureTikTok(
  request: Request,
  rawBody: string,
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
    const forwardedOrigin = getForwardedOrigin(request);
    const requestUrl = (() => {
      try {
        return new URL(request.url);
      } catch {
        return null;
      }
    })();
    const candidates = uniqueStrings([
      getProcessTikTokMetricsQueueUrl(),
      forwardedOrigin ? `${forwardedOrigin}/api/cron/process-tiktok-metrics-queue` : null,
      requestUrl ? `${requestUrl.origin}/api/cron/process-tiktok-metrics-queue` : null,
      requestUrl?.toString() ?? null,
    ]);
    return verifyQStashAgainstUrls(receiver, signature, rawBody, candidates);
  } catch {
    return false;
  }
}

/**
 * Authorize process-tiktok-metrics-queue: QStash signature (TikTok URL) or Bearer CRON_SECRET.
 */
export async function authorizeProcessTikTokMetricsQueue(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  if (request.headers.get("Upstash-Signature")) {
    return verifyQStashSignatureTikTok(request, rawBody);
  }
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("Authorization");
  if (cronSecret) return auth === `Bearer ${cronSecret}`;
  return true;
}

async function verifyQStashSignatureYouTube(
  request: Request,
  rawBody: string,
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
    const forwardedOrigin = getForwardedOrigin(request);
    const requestUrl = (() => {
      try {
        return new URL(request.url);
      } catch {
        return null;
      }
    })();
    const candidates = uniqueStrings([
      getProcessYouTubeMetricsQueueUrl(),
      forwardedOrigin ? `${forwardedOrigin}/api/cron/process-youtube-metrics-queue` : null,
      requestUrl ? `${requestUrl.origin}/api/cron/process-youtube-metrics-queue` : null,
      requestUrl?.toString() ?? null,
    ]);
    return verifyQStashAgainstUrls(receiver, signature, rawBody, candidates);
  } catch {
    return false;
  }
}

/**
 * Authorize process-youtube-metrics-queue: QStash signature or Bearer CRON_SECRET.
 */
export async function authorizeProcessYouTubeMetricsQueue(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  if (request.headers.get("Upstash-Signature")) {
    return verifyQStashSignatureYouTube(request, rawBody);
  }
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("Authorization");
  if (cronSecret) return auth === `Bearer ${cronSecret}`;
  return true;
}

/**
 * Authorize process-token-refresh-queue: QStash signature or Bearer CRON_SECRET.
 */
export async function authorizeProcessTokenRefreshQueue(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  const signature = request.headers.get("Upstash-Signature");
  if (signature) {
    const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
    const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
    if (!currentKey && !nextKey) return false;
    try {
      const receiver = new Receiver({
        currentSigningKey: currentKey,
        nextSigningKey: nextKey,
      });
      const forwardedOrigin = getForwardedOrigin(request);
      const requestUrl = (() => {
        try {
          return new URL(request.url);
        } catch {
          return null;
        }
      })();
      const candidates = uniqueStrings([
        getProcessTokenRefreshQueueUrl(),
        forwardedOrigin ? `${forwardedOrigin}/api/cron/process-token-refresh-queue` : null,
        requestUrl ? `${requestUrl.origin}/api/cron/process-token-refresh-queue` : null,
        requestUrl?.toString() ?? null,
      ]);
      return verifyQStashAgainstUrls(receiver, signature, rawBody, candidates);
    } catch {
      return false;
    }
  }
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("Authorization");
  if (cronSecret) return auth === `Bearer ${cronSecret}`;
  return true;
}
