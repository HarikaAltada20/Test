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

const YT_ANALYTICS_RATE_REDIS_KEY = "youtube_analytics_rate_limit:v2";

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
let analyticsRedisClient: Redis | null | undefined;
let rateLimitForTests: number | null = null;
let forceLocalForTests = false;

export class YoutubeAnalyticsRateLimitError extends Error {
  readonly status = 429;
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(
      `YouTube Analytics rate limit reached; retry after ${Math.max(0, retryAfterMs)}ms`,
    );
    this.name = "YoutubeAnalyticsRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

function getLimit(): number {
  return rateLimitForTests ?? YT_ANALYTICS_DEFAULT_RATE_LIMIT;
}

function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

function getAnalyticsRedis(): Redis | null {
  if (forceLocalForTests) {
    return null;
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

function parseEvalResult(result: unknown): { ok: boolean; retryAfterMs: number } {
  if (Array.isArray(result) && result.length >= 2) {
    return {
      ok: Number(result[0]) === 1,
      retryAfterMs: Math.max(50, Number(result[1]) || YT_ANALYTICS_RATE_WINDOW_MS),
    };
  }
  // Unexpected shape — treat as limited to stay under Google's quota.
  return { ok: false, retryAfterMs: 1_000 };
}

async function acquireRedisSlidingWindow(redis: Redis): Promise<void> {
  const now = Date.now();
  const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
  const result = await redis.eval(
    SLIDING_WINDOW_LUA,
    [YT_ANALYTICS_RATE_REDIS_KEY],
    [
      String(now),
      String(YT_ANALYTICS_RATE_WINDOW_MS),
      String(getLimit()),
      member,
    ],
  );
  const parsed = parseEvalResult(result);
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
      throw new YoutubeAnalyticsRateLimitError(5_000);
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
      throw new YoutubeAnalyticsRateLimitError(5_000);
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

/** Test helper: clear in-memory window state. */
export function resetYoutubeAnalyticsRateLimitForTests(): void {
  analyticsCallTimestamps.length = 0;
  rateLimitForTests = null;
  forceLocalForTests = false;
}
