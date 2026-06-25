/**
 * QStash integration for metrics refresh queue.
 * When enabled, jobs trigger the process-metrics-queue endpoint via QStash
 * (retries, rate limiting, no Vercel cron needed). Falls back to CRON_SECRET
 * or direct fetch when QStash is not configured.
 *
 * Env: QSTASH_TOKEN (publish), QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY (verify).
 */

import { Client, Receiver } from "@upstash/qstash";

function sanitizeEnvValue(value: string | undefined): string {
  if (!value?.trim()) return "";
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .split(/\s+#/)[0]
    .trim()
    .replace(/["']$/g, "");
}

function getBaseUrl(): string {
  const url = sanitizeEnvValue(process.env.NEXT_PUBLIC_APP_URL);
  return (url || "http://localhost:3000").replace(/\/$/, "");
}

function getCronSecret(): string {
  return sanitizeEnvValue(process.env.CRON_SECRET);
}

function getQStashAuthHeaders(): Record<string, string> | undefined {
  const cronSecret = getCronSecret();
  if (!cronSecret) return undefined;
  return { Authorization: `Bearer ${cronSecret}` };
}

function getForwardedOrigin(request: Request): string | null {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host")?.split(",")[0]?.trim();
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
  const bodies = uniqueStrings([
    rawBody,
    rawBody.trim(),
    rawBody.trim() === "" ? "{}" : null,
    rawBody.trim() === "{}" ? "" : null,
  ]);

  for (const url of urls) {
    for (const body of bodies) {
      try {
        await receiver.verify({ signature, body, url });
        return true;
      } catch {
        // try next body/url
      }
    }
  }
  return false;
}

/**
 * Public HTTPS origin for callbacks (QStash). Prefer the incoming request
 * (Cloudflare tunnel / proxy) over NEXT_PUBLIC_APP_URL so the URL matches
 * what the browser is actually using.
 */
export function resolvePublicBaseUrl(request?: Request): string {
  if (request) {
    const forwarded = getForwardedOrigin(request);
    if (forwarded && !isLoopbackUrl(forwarded)) {
      return forwarded.replace(/\/$/, "");
    }
    try {
      const origin = new URL(request.url).origin;
      if (!isLoopbackUrl(origin)) {
        return origin.replace(/\/$/, "");
      }
    } catch {
      // ignore
    }
  }
  return getBaseUrl().replace(/\/$/, "");
}

/**
 * Base URL QStash will POST to. Uses NEXT_PUBLIC_APP_URL, then the incoming request origin.
 */
export function getQStashPublishBaseUrl(request?: Request): string {
  const fromEnv = getBaseUrl().replace(/\/$/, "");
  if (!isLoopbackUrl(fromEnv)) {
    return fromEnv;
  }

  return resolvePublicBaseUrl(request);
}

export function resolveQstashBaseUrl(
  explicit?: string,
  request?: Request,
): string {
  if (explicit) {
    const normalized = explicit.replace(/\/$/, "");
    if (!isLoopbackUrl(normalized)) {
      return normalized;
    }
  }
  return getQStashPublishBaseUrl(request).replace(/\/$/, "");
}

/**
 * Prefer the incoming request origin when running on localhost, even if
 * NEXT_PUBLIC_APP_URL points at production. Used for direct delivery processor
 * triggers during local development.
 */
export function resolveLocalAwareBaseUrl(request?: Request): string {
  if (request) {
    try {
      return new URL(request.url).origin.replace(/\/$/, "");
    } catch {
      // fall through
    }
  }
  return getQStashPublishBaseUrl(request);
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
      forwardedOrigin
        ? `${forwardedOrigin}/api/cron/process-metrics-queue`
        : null,
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
    console.error("[qstash] triggerProcessTikTokMetricsQueue failed:", message);
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
    console.error(
      "[qstash] triggerProcessYouTubeMetricsQueue failed:",
      message,
    );
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
    console.error("[qstash] triggerProcessTokenRefreshQueue failed:", message);
    return { error: message };
  }
}

function getProcessAdminNotificationDeliveryQueueUrl(): string {
  return `${getQStashPublishBaseUrl()}/api/cron/process-admin-notification-delivery-queue`;
}

function getProcessAdminEmailDeliveryQueueUrl(): string {
  return `${getQStashPublishBaseUrl()}/api/cron/process-admin-email-delivery-queue`;
}

/**
 * Trigger the admin notification delivery queue processor via QStash.
 */
/**
 * Trigger the admin email delivery queue processor via QStash.
 */
export async function triggerProcessAdminEmailDeliveryQueue(
  baseUrl?: string,
): Promise<{ messageId?: string; error?: string }> {
  const client = getQStashClient();
  if (!client) return { error: "QStash not configured" };
  const url = `${baseUrl ?? getQStashPublishBaseUrl()}/api/cron/process-admin-email-delivery-queue`;
  if (isLoopbackUrl(url))
    return { error: "Loopback URL; QStash cannot reach localhost" };
  try {
    const res = await client.publishJSON({
      url,
      body: {},
      method: "POST",
      headers: getQStashAuthHeaders(),
    });
    const messageId = (res as { messageId?: string }).messageId;
    console.log("[qstash] triggered admin email delivery queue", {
      messageId,
      publishUrl: url,
    });
    return { messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[qstash] triggerProcessAdminEmailDeliveryQueue failed:",
      message,
    );
    return { error: message };
  }
}

export async function triggerProcessAdminEmailDeliveryQueueDelayed(
  baseUrl: string | undefined,
  campaignId: string,
  retryAt: Date,
): Promise<{ messageId?: string; error?: string }> {
  const client = getQStashClient();
  if (!client) return { error: "QStash not configured" };
  const url = `${(baseUrl ?? getQStashPublishBaseUrl()).replace(/\/$/, "")}/api/cron/process-admin-email-delivery-queue`;
  if (isLoopbackUrl(url)) {
    return { error: "Loopback URL; QStash cannot reach localhost" };
  }

  const msUntil = retryAt.getTime() - Date.now();
  const body = { campaignId };
  const deduplicationId = `admin-email-delivery-${campaignId}-${retryAt.getTime()}`;

  const publishOptions = {
    url,
    body,
    method: "POST" as const,
    deduplicationId,
    retries: 5,
    label: "admin-email-delivery-deferred",
    headers: getQStashAuthHeaders(),
  };

  try {
    const res =
      msUntil <= 0
        ? await client.publishJSON(publishOptions)
        : await client.publishJSON({
            ...publishOptions,
            notBefore: Math.floor(retryAt.getTime() / 1000),
          });
    const messageId = (res as { messageId?: string }).messageId;
    console.log("[qstash] scheduled admin email delivery", {
      campaignId,
      messageId,
      publishUrl: url,
      notBefore:
        msUntil > 0 ? new Date(retryAt.getTime()).toISOString() : "immediate",
    });
    return { messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[qstash] triggerProcessAdminEmailDeliveryQueueDelayed failed:",
      message,
    );
    return { error: message };
  }
}

export async function triggerProcessAdminNotificationDeliveryQueue(
  baseUrl?: string,
  campaignId?: string,
): Promise<{ messageId?: string; error?: string }> {
  const client = getQStashClient();
  if (!client) return { error: "QStash not configured" };
  const url = `${baseUrl ?? getBaseUrl()}/api/cron/process-admin-notification-delivery-queue`;
  if (isLoopbackUrl(url))
    return { error: "Loopback URL; QStash cannot reach localhost" };
  try {
    const body = campaignId ? { campaignId } : {};
    const res = await client.publishJSON({
      url,
      body,
      method: "POST",
    });
    return { messageId: (res as { messageId?: string }).messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[qstash] triggerProcessAdminNotificationDeliveryQueue failed:",
      message,
    );
    return { error: message };
  }
}

async function verifyQStashSignatureAdminNotificationDelivery(
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
      getProcessAdminNotificationDeliveryQueueUrl(),
      forwardedOrigin
        ? `${forwardedOrigin}/api/cron/process-admin-notification-delivery-queue`
        : null,
      requestUrl
        ? `${requestUrl.origin}/api/cron/process-admin-notification-delivery-queue`
        : null,
      requestUrl?.toString() ?? null,
    ]);
    return verifyQStashAgainstUrls(receiver, signature, rawBody, candidates);
  } catch {
    return false;
  }
}

async function verifyQStashSignatureAdminEmailDelivery(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  const signature = request.headers.get("Upstash-Signature");
  if (!signature || typeof signature !== "string") return false;
  const currentKey = sanitizeEnvValue(process.env.QSTASH_CURRENT_SIGNING_KEY);
  const nextKey = sanitizeEnvValue(process.env.QSTASH_NEXT_SIGNING_KEY);
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
      getProcessAdminEmailDeliveryQueueUrl(),
      `${getBaseUrl()}/api/cron/process-admin-email-delivery-queue`,
      forwardedOrigin
        ? `${forwardedOrigin}/api/cron/process-admin-email-delivery-queue`
        : null,
      requestUrl
        ? `${requestUrl.origin}/api/cron/process-admin-email-delivery-queue`
        : null,
      requestUrl?.toString() ?? null,
    ]);
    return verifyQStashAgainstUrls(receiver, signature, rawBody, candidates);
  } catch {
    return false;
  }
}

/**
 * Authorize process-admin-notification-delivery-queue: QStash signature or Bearer CRON_SECRET.
 */
export async function authorizeProcessAdminNotificationDeliveryQueue(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  if (request.headers.get("Upstash-Signature")) {
    return verifyQStashSignatureAdminNotificationDelivery(request, rawBody);
  }
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("Authorization");
  if (cronSecret) return auth === `Bearer ${cronSecret}`;
  return process.env.NODE_ENV === "development";
}

/**
 * Authorize process-admin-email-delivery-queue: QStash signature or Bearer CRON_SECRET.
 */
export async function authorizeProcessAdminEmailDeliveryQueue(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  const cronSecret = getCronSecret();
  const auth = request.headers.get("Authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return true;
  }

  if (request.headers.get("Upstash-Signature")) {
    const verified = await verifyQStashSignatureAdminEmailDelivery(
      request,
      rawBody,
    );
    if (!verified) {
      console.warn("[qstash] admin email delivery signature rejected", {
        forwardedOrigin: getForwardedOrigin(request),
        bodyLength: rawBody.length,
      });
    }
    return verified;
  }

  if (cronSecret) return false;
  return process.env.NODE_ENV === "development";
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
      forwardedOrigin
        ? `${forwardedOrigin}/api/cron/process-instagram-insights-queue`
        : null,
      requestUrl
        ? `${requestUrl.origin}/api/cron/process-instagram-insights-queue`
        : null,
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
      forwardedOrigin
        ? `${forwardedOrigin}/api/cron/process-tiktok-metrics-queue`
        : null,
      requestUrl
        ? `${requestUrl.origin}/api/cron/process-tiktok-metrics-queue`
        : null,
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
      forwardedOrigin
        ? `${forwardedOrigin}/api/cron/process-youtube-metrics-queue`
        : null,
      requestUrl
        ? `${requestUrl.origin}/api/cron/process-youtube-metrics-queue`
        : null,
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
        forwardedOrigin
          ? `${forwardedOrigin}/api/cron/process-token-refresh-queue`
          : null,
        requestUrl
          ? `${requestUrl.origin}/api/cron/process-token-refresh-queue`
          : null,
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

/** Canonical URL for the scheduled admin notifications processor. */
export function getProcessScheduledNotificationsUrl(): string {
  return `${getBaseUrl()}/api/cron/process-scheduled-notifications`;
}

async function verifyQStashSignatureScheduledNotifications(
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
      requestUrl?.toString() ?? null,
      requestUrl
        ? `${requestUrl.origin}/api/cron/process-scheduled-notifications`
        : null,
      forwardedOrigin
        ? `${forwardedOrigin}/api/cron/process-scheduled-notifications`
        : null,
      getProcessScheduledNotificationsUrl(),
    ]);
    return verifyQStashAgainstUrls(receiver, signature, rawBody, candidates);
  } catch {
    return false;
  }
}

/**
 * Authorize process-scheduled-notifications: QStash signature or Bearer CRON_SECRET.
 */
export async function authorizeProcessScheduledNotifications(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  if (request.headers.get("Upstash-Signature")) {
    return verifyQStashSignatureScheduledNotifications(request, rawBody);
  }
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("Authorization");
  if (cronSecret) {
    return auth === `Bearer ${cronSecret}`;
  }
  return process.env.NODE_ENV === "development";
}

/**
 * Schedule a one-shot QStash delivery for an admin notification campaign at scheduled_at.
 */
export async function scheduleAdminNotificationCampaign(
  campaignId: string,
  scheduledAt: Date,
  baseUrl?: string,
): Promise<{ messageId?: string; error?: string; publishUrl?: string }> {
  const client = getQStashClient();
  if (!client) {
    return { error: "QStash not configured" };
  }
  const origin = (baseUrl ?? getQStashPublishBaseUrl()).replace(/\/$/, "");
  const publishUrl = `${origin}/api/cron/process-scheduled-notifications`;
  if (isLoopbackUrl(publishUrl)) {
    return {
      error:
        "Loopback URL; set NEXT_PUBLIC_APP_URL to your public tunnel",
      publishUrl,
    };
  }

  const deduplicationId = `admin-notification-campaign-${campaignId}-${scheduledAt.getTime()}`;
  const msUntil = scheduledAt.getTime() - Date.now();
  const body = { campaignId };

  try {
    let res: { messageId?: string };
    if (msUntil <= 0) {
      res = (await client.publishJSON({
        url: publishUrl,
        body,
        method: "POST",
        deduplicationId,
        retries: 5,
        label: "admin-notification-scheduled",
      })) as { messageId?: string };
    } else {
      res = (await client.publishJSON({
        url: publishUrl,
        body,
        method: "POST",
        notBefore: Math.floor(scheduledAt.getTime() / 1000),
        deduplicationId,
        retries: 5,
        label: "admin-notification-scheduled",
      })) as { messageId?: string };
    }
    console.log("[qstash] scheduled admin notification", {
      campaignId,
      messageId: res.messageId,
      publishUrl,
      notBefore:
        msUntil > 0
          ? new Date(scheduledAt.getTime()).toISOString()
          : "immediate",
    });
    return {
      messageId: res.messageId,
      publishUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      "[qstash] scheduleAdminNotificationCampaign failed:",
      message,
      { campaignId, publishUrl },
    );
    return { error: message, publishUrl };
  }
}

/** Cancel a pending QStash message when an admin cancels a scheduled campaign. */
export async function cancelAdminNotificationQStashSchedule(
  messageId: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = getQStashClient();
  if (!client) {
    return { ok: false, error: "QStash not configured" };
  }
  try {
    await client.messages.delete(messageId);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[qstash] cancelAdminNotificationQStashSchedule:", message);
    return { ok: false, error: message };
  }
}

function getProcessWarmUpSendsUrl(): string {
  return `${getQStashPublishBaseUrl()}/api/cron/process-warm-up-sends`;
}

async function verifyQStashSignatureWarmUp(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  const signature = request.headers.get("Upstash-Signature");
  if (!signature || typeof signature !== "string") return false;
  const currentKey = sanitizeEnvValue(process.env.QSTASH_CURRENT_SIGNING_KEY);
  const nextKey = sanitizeEnvValue(process.env.QSTASH_NEXT_SIGNING_KEY);
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
      getProcessWarmUpSendsUrl(),
      `${getBaseUrl()}/api/cron/process-warm-up-sends`,
      forwardedOrigin
        ? `${forwardedOrigin}/api/cron/process-warm-up-sends`
        : null,
      requestUrl ? `${requestUrl.origin}/api/cron/process-warm-up-sends` : null,
      requestUrl?.toString() ?? null,
    ]);
    return verifyQStashAgainstUrls(receiver, signature, rawBody, candidates);
  } catch {
    return false;
  }
}

/**
 * Authorize process-warm-up-sends: QStash signature or Bearer CRON_SECRET.
 */
export async function authorizeProcessWarmUpSends(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  const cronSecret = getCronSecret();
  const auth = request.headers.get("Authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return true;
  }

  if (request.headers.get("Upstash-Signature")) {
    return verifyQStashSignatureWarmUp(request, rawBody);
  }

  // Vercel Cron (legacy) or local dev
  if (request.headers.get("x-vercel-cron")) return true;
  if (cronSecret) return false;
  return process.env.NODE_ENV === "development";
}
