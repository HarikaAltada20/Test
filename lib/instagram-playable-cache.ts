/**
 * Cached, rate-limited wrapper around the unofficial Instagram public lookup
 * used by Review Mode to get a playable video file.
 *
 * Uses Upstash Redis when configured so cache and limits are shared across
 * instances; falls back to process memory (and fails open to it on Redis errors).
 */

import { Redis } from "@upstash/redis";
import {
  resolveInstagramVideoUrl,
  type ResolveInstagramVideoResult,
} from "@/lib/instagram-download/graphql";

/** Instagram CDN URLs expire, so successes are kept briefly. */
export const PLAYABLE_SUCCESS_TTL_MS = 30 * 60_000;
/** Blocked / removed / non-video reels rarely change; don't re-ask Instagram. */
export const PLAYABLE_NEGATIVE_TTL_MS = 6 * 60 * 60_000;
/** Transient Instagram errors: short back-off per reel. */
export const PLAYABLE_ERROR_TTL_MS = 2 * 60_000;
/** After Instagram answers 429, skip all lookups for a while. */
export const PLAYABLE_COOLDOWN_MS = 5 * 60_000;
export const PLAYABLE_PER_USER_PER_MINUTE = 60;
export const PLAYABLE_GLOBAL_PER_MINUTE = 200;

const WINDOW_MS = 60_000;
const MEMORY_MAX_ENTRIES = 5_000;
const KEY_PREFIX = "goc-ig-playable";

export type PlayableInstagramResult =
  | { ok: true; videoUrl: string; thumbnailUrl: string | null }
  | {
      ok: false;
      reason: "notFound" | "notVideo" | "error" | "rateLimited" | "cooldown";
    };

type CachedEntry = PlayableInstagramResult;
type Resolver = (shortcode: string) => Promise<ResolveInstagramVideoResult>;

let resolver: Resolver = resolveInstagramVideoUrl;
let redisDisabled = false;
let redisClient: Redis | null | undefined;
const memory = new Map<string, { value: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<PlayableInstagramResult>>();

function getRedis(): Redis | null {
  if (redisDisabled) return null;
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  try {
    redisClient = Redis.fromEnv();
  } catch {
    redisClient = null;
  }
  return redisClient;
}

function memoryGet<T>(key: string): T | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value as T;
}

function memorySet(key: string, value: unknown, ttlMs: number) {
  if (memory.size >= MEMORY_MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest !== undefined) memory.delete(oldest);
  }
  memory.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function storeGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    try {
      return ((await redis.get<T>(`${KEY_PREFIX}:${key}`)) ?? null) as T | null;
    } catch (error) {
      console.warn("[instagram-playable-cache] Redis get failed", error);
    }
  }
  return memoryGet<T>(key);
}

async function storeSet(key: string, value: unknown, ttlMs: number) {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`${KEY_PREFIX}:${key}`, value, { px: ttlMs });
      return;
    } catch (error) {
      console.warn("[instagram-playable-cache] Redis set failed", error);
    }
  }
  memorySet(key, value, ttlMs);
}

/** Fixed-window counter; returns false once `limit` is exceeded this minute. */
async function hitLimit(key: string, limit: number): Promise<boolean> {
  const bucket = Math.floor(Date.now() / WINDOW_MS);
  const bucketKey = `rl:${key}:${bucket}`;
  const redis = getRedis();
  if (redis) {
    try {
      const fullKey = `${KEY_PREFIX}:${bucketKey}`;
      const count = await redis.incr(fullKey);
      if (count === 1) await redis.pexpire(fullKey, WINDOW_MS);
      return count <= limit;
    } catch (error) {
      console.warn("[instagram-playable-cache] Redis limit failed", error);
    }
  }
  const count = (memoryGet<number>(bucketKey) ?? 0) + 1;
  memorySet(bucketKey, count, WINDOW_MS);
  return count <= limit;
}

function toEntry(result: ResolveInstagramVideoResult): {
  entry: CachedEntry;
  ttlMs: number | null;
  cooldown: boolean;
} {
  if (result.ok) {
    const media = result.data.xdt_shortcode_media;
    return {
      entry: {
        ok: true,
        videoUrl: result.videoUrl,
        thumbnailUrl: media.display_url || media.thumbnail_src || null,
      },
      ttlMs: PLAYABLE_SUCCESS_TTL_MS,
      cooldown: false,
    };
  }
  switch (result.error) {
    case "notFound":
    case "notVideo":
      return {
        entry: { ok: false, reason: result.error },
        ttlMs: PLAYABLE_NEGATIVE_TTL_MS,
        cooldown: false,
      };
    case "tooManyRequests":
      return { entry: { ok: false, reason: "cooldown" }, ttlMs: null, cooldown: true };
    case "noShortcode":
      return {
        entry: { ok: false, reason: "notFound" },
        ttlMs: PLAYABLE_NEGATIVE_TTL_MS,
        cooldown: false,
      };
    default:
      return {
        entry: { ok: false, reason: "error" },
        ttlMs: PLAYABLE_ERROR_TTL_MS,
        cooldown: false,
      };
  }
}

async function lookup(shortcode: string, userId: string): Promise<PlayableInstagramResult> {
  if (await storeGet<boolean>("cooldown")) {
    return { ok: false, reason: "cooldown" };
  }
  const userOk = await hitLimit(`user:${userId}`, PLAYABLE_PER_USER_PER_MINUTE);
  if (!userOk) return { ok: false, reason: "rateLimited" };
  const globalOk = await hitLimit("global", PLAYABLE_GLOBAL_PER_MINUTE);
  if (!globalOk) return { ok: false, reason: "rateLimited" };

  let result: ResolveInstagramVideoResult;
  try {
    result = await resolver(shortcode);
  } catch (error) {
    console.warn("[instagram-playable-cache] resolver threw", error);
    await storeSet(`entry:${shortcode}`, { ok: false, reason: "error" }, PLAYABLE_ERROR_TTL_MS);
    return { ok: false, reason: "error" };
  }

  const { entry, ttlMs, cooldown } = toEntry(result);
  if (cooldown) {
    await storeSet("cooldown", true, PLAYABLE_COOLDOWN_MS);
  } else if (ttlMs) {
    await storeSet(`entry:${shortcode}`, entry, ttlMs);
  }
  return entry;
}

/**
 * Playable video URL for a public reel, or a reason it isn't available.
 * Cached per shortcode; concurrent requests for one reel share a lookup;
 * only uncached lookups count toward the per-user and global limits.
 */
export async function getPlayableInstagramVideo(
  shortcode: string,
  userId: string,
): Promise<PlayableInstagramResult> {
  const code = shortcode.trim();
  if (!code) return { ok: false, reason: "notFound" };

  const cached = await storeGet<CachedEntry>(`entry:${code}`);
  if (cached) return cached;

  const pending = inflight.get(code);
  if (pending) return pending;

  const promise = lookup(code, userId).finally(() => inflight.delete(code));
  inflight.set(code, promise);
  return promise;
}

export function setInstagramPlayableResolverForTests(next: Resolver | null): void {
  resolver = next ?? resolveInstagramVideoUrl;
}

/** Test helper: memory-only mode with empty cache, limits and cooldown. */
export function resetInstagramPlayableCacheForTests(): void {
  redisDisabled = true;
  memory.clear();
  inflight.clear();
  resolver = resolveInstagramVideoUrl;
}
