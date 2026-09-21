/**
 * Shared sliding-window rate limiter for YouTube Analytics API calls.
 *
 * Google enforces a rolling queries-per-minute quota (~720). A fixed Redis
 * minute-bucket can admit nearly 2× that limit across a boundary; this module
 * uses a true rolling 60s window instead.
 *
 * Fail-fast when the cap is hit — serverless handlers must not sleep until
 * the next minute. In production, Redis is required (fail closed); locally we
 * fall back to an in-process sliding window for single-worker dev.
 */

import { Redis } from "@upstash/redis";

/** Stay under Google's typical 720 QPM Analytics quota. */
export const YT_ANALYTICS_DEFAULT_RATE_LIMIT = 710;
export const YT_ANALYTICS_RATE_WINDOW_MS = 60_000;

const YT_ANALYTICS_RATE_REDIS_KEY_PREFIX = "youtube_analytics_rate_limit:v3";

type AnalyticsRedisClient = Pick<Redis, "eval">;
type RateLimitFailureReason = "quota_exceeded" | "redis_unavailable";

/**
 * Atomic sliding-window acquire via ZSET.
 * Returns {1, 0} on success, or {0, retryAfterMs} when limited.
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local window_start = now - window

redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry_after = window
  if oldest and oldest[2] then
    retry_after = math.max(50, tonumber(oldest[2]) + window - now)
  end
  return {0, retry_after}
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, 0}
`;

const analyticsCallTimestamps: number[] = [];
let analyticsRedisClient: AnalyticsRedisClient | null | undefined;
let rateLimitForTests: number | null = null;
let forceLocalForTests = false;
let redisClientForTests: AnalyticsRedisClient | null | undefined;
let hasRedisClientOverrideForTests = false;

export class YoutubeAnalyticsRateLimitError extends Error {
  readonly status: 429 | 503;
  readonly retryAfterMs: number;
  readonly reason: RateLimitFailureReason;

  constructor(
    retryAfterMs: number,
    reason: RateLimitFailureReason = "quota_exceeded",
  ) {
    super(
      reason === "quota_exceeded"
        ? `YouTube Analytics rate limit reached; retry after ${Math.max(0, retryAfterMs)}ms`
        : `YouTube Analytics rate-limit service unavailable; retry after ${Math.max(0, retryAfterMs)}ms`,
    );
    this.name = "YoutubeAnalyticsRateLimitError";
    this.status = reason === "quota_exceeded" ? 429 : 503;
    this.retryAfterMs = retryAfterMs;
    this.reason = reason;
  }
}

function getLimit(): number {
  if (rateLimitForTests !== null) return rateLimitForTests;
  const configured = Number.parseInt(
    process.env.YT_ANALYTICS_RATE_LIMIT_QPM ?? "",
    10,
  );
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, YT_ANALYTICS_DEFAULT_RATE_LIMIT)
    : YT_ANALYTICS_DEFAULT_RATE_LIMIT;
}

function isProductionRuntime(): boolean {
  const vercelEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnvironment) return vercelEnvironment === "production";
  return process.env.NODE_ENV === "production";
}

function normalizeRedisKeyPart(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "default"
  );
}

function getRedisKey(): string {
  const explicitNamespace =
    process.env.YT_ANALYTICS_RATE_LIMIT_NAMESPACE?.trim();
  const environment =
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV?.trim() ||
    "development";
  const project =
    process.env.VERCEL_PROJECT_ID?.trim() ||
    process.env.VERCEL_GIT_REPO_SLUG?.trim() ||
    "app";
  const namespace = explicitNamespace || `${environment}-${project}`;
  return `${YT_ANALYTICS_RATE_REDIS_KEY_PREFIX}:${normalizeRedisKeyPart(namespace)}`;
}

function getAnalyticsRedis(): AnalyticsRedisClient | null {
  if (forceLocalForTests) {
    return null;
  }
  if (hasRedisClientOverrideForTests) {
    return redisClientForTests ?? null;
  }
  if (analyticsRedisClient !== undefined) {
    return analyticsRedisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    analyticsRedisClient = null;
    return analyticsRedisClient;
  }

  try {
    analyticsRedisClient =
      typeof process !== "undefined" &&
      process?.env?.UPSTASH_REDIS_REST_URL === url
        ? Redis.fromEnv()
        : new Redis({ url, token });
  } catch (error) {
    console.error("[youtube-analytics] Redis client creation failed:", error);
    analyticsRedisClient = null;
  }

  return analyticsRedisClient;
}

function acquireLocalAnalyticsRateLimit(): void {
  const now = Date.now();
  const limit = getLimit();
  while (
    analyticsCallTimestamps.length > 0 &&
    analyticsCallTimestamps[0] <= now - YT_ANALYTICS_RATE_WINDOW_MS
  ) {
    analyticsCallTimestamps.shift();
  }
  if (analyticsCallTimestamps.length < limit) {
    analyticsCallTimestamps.push(now);
    return;
  }
  const retryAfterMs =
    analyticsCallTimestamps[0] - (now - YT_ANALYTICS_RATE_WINDOW_MS) + 50;
  throw new YoutubeAnalyticsRateLimitError(Math.max(50, retryAfterMs));
}

function parseEvalResult(
  result: unknown,
): { ok: boolean; retryAfterMs: number } | null {
  if (Array.isArray(result) && result.length >= 2) {
    const accepted = Number(result[0]);
    const retryAfterMs = Number(result[1]);
    if ((accepted !== 0 && accepted !== 1) || !Number.isFinite(retryAfterMs)) {
      return null;
    }
    return {
      ok: accepted === 1,
      retryAfterMs: Math.max(
        50,
        retryAfterMs || YT_ANALYTICS_RATE_WINDOW_MS,
      ),
    };
  }
  // Unexpected shapes are infrastructure failures, not quota exhaustion.
  return null;
}

async function acquireRedisSlidingWindow(
  redis: AnalyticsRedisClient,
): Promise<void> {
  const now = Date.now();
  const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
  const result = await redis.eval(
    SLIDING_WINDOW_LUA,
    [getRedisKey()],
    [
      String(now),
      String(YT_ANALYTICS_RATE_WINDOW_MS),
      String(getLimit()),
      member,
    ],
  );
  const parsed = parseEvalResult(result);
  if (!parsed) {
    throw new Error("Unexpected Redis rate-limit response");
  }
  if (parsed.ok) {
    return;
  }
  throw new YoutubeAnalyticsRateLimitError(parsed.retryAfterMs);
}

/**
 * Acquire one YouTube Analytics API query slot for the rolling window.
 * Throws YoutubeAnalyticsRateLimitError when the shared cap is exhausted.
 */
export async function acquireAnalyticsRateLimit(): Promise<void> {
  const redis = getAnalyticsRedis();
  if (!redis) {
    if (isProductionRuntime() && !forceLocalForTests) {
      console.error(
        "[youtube-analytics] Redis unavailable in production; refusing Analytics calls",
      );
      throw new YoutubeAnalyticsRateLimitError(5_000, "redis_unavailable");
    }
    acquireLocalAnalyticsRateLimit();
    return;
  }

  try {
    await acquireRedisSlidingWindow(redis);
  } catch (error) {
    if (error instanceof YoutubeAnalyticsRateLimitError) {
      throw error;
    }
    console.error("[youtube-analytics] Redis rate-limit acquire failed:", error);
    if (isProductionRuntime()) {
      throw new YoutubeAnalyticsRateLimitError(5_000, "redis_unavailable");
    }
    acquireLocalAnalyticsRateLimit();
  }
}

/** Test helper: override the QPM cap (null restores default). */
export function setYoutubeAnalyticsRateLimitForTests(limit: number | null): void {
  rateLimitForTests = limit;
}

/** Test helper: force the in-process sliding window (skip Redis). */
export function setYoutubeAnalyticsRateLimitForceLocalForTests(
  force: boolean,
): void {
  forceLocalForTests = force;
}

/** Test helper: inject a Redis-compatible client without network access. */
export function setYoutubeAnalyticsRedisForTests(
  redis: AnalyticsRedisClient | null,
): void {
  hasRedisClientOverrideForTests = true;
  redisClientForTests = redis;
}

/** Test helper: expose the namespaced key used by the Lua script. */
export function getYoutubeAnalyticsRedisKeyForTests(): string {
  return getRedisKey();
}

/** Test helper: clear in-memory window state. */
export function resetYoutubeAnalyticsRateLimitForTests(): void {
  analyticsCallTimestamps.length = 0;
  rateLimitForTests = null;
  forceLocalForTests = false;
  redisClientForTests = undefined;
  hasRedisClientOverrideForTests = false;
  analyticsRedisClient = undefined;
}
