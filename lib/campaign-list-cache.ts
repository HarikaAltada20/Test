/**
 * Short-lived Redis cache for campaign/opportunity list API responses.
 * Freshness contract: list views may lag up to TTL; detail/payout screens stay live.
 *
 * Uses the same Upstash Redis as metrics queues when configured; no-ops otherwise.
 */

import { Redis } from "@upstash/redis";

const KEY_PREFIX = "campaign_list:v1";

/** Brand / admin dashboards — short TTL so publish/approve feel snappy. */
export const CAMPAIGN_LIST_CACHE_TTL_BRAND_SEC = 45;
/** Opportunities / discover — slightly longer shared cache. */
export const CAMPAIGN_LIST_CACHE_TTL_OPPORTUNITIES_SEC = 120;

export type CampaignListCacheScope = "advertiser" | "admin" | "opportunities";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    if (typeof process !== "undefined" && process?.env) {
      return Redis.fromEnv();
    }
    return new Redis({ url, token });
  } catch (e) {
    console.error("[campaign-list-cache] Redis client creation failed:", e);
    return null;
  }
}

export function isCampaignListCacheEnabled(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

function ttlForScope(scope: CampaignListCacheScope): number {
  return scope === "opportunities"
    ? CAMPAIGN_LIST_CACHE_TTL_OPPORTUNITIES_SEC
    : CAMPAIGN_LIST_CACHE_TTL_BRAND_SEC;
}

/**
 * Stable cache key: list:{scope}:{owner}:{tab}:{sort}:{page}:{filters}
 */
export function buildCampaignListCacheKey(parts: {
  scope: CampaignListCacheScope;
  ownerId: string;
  tab: string;
  sort: string;
  page: number;
  limit: number;
  platform?: string;
  contestType?: string;
  contestFormat?: string;
  postContestPhase?: string;
  search?: string;
  mediaType?: string;
  eligibleOnly?: boolean;
  /** Hash or joined countries for opportunities geo. */
  countriesKey?: string;
}): string {
  const filters = [
    parts.platform || "all",
    parts.contestType || "all",
    parts.contestFormat || "all",
    parts.postContestPhase || "all",
    (parts.search || "").trim().toLowerCase().slice(0, 80),
    parts.mediaType || "all",
    parts.eligibleOnly ? "1" : "0",
    parts.countriesKey || "",
  ].join("|");

  return [
    KEY_PREFIX,
    parts.scope,
    parts.ownerId,
    parts.tab || "all",
    parts.sort,
    String(parts.page),
    String(parts.limit),
    filters,
  ].join(":");
}

export async function getCampaignListCache<T>(
  key: string,
): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch (e) {
    console.warn("[campaign-list-cache] get failed:", e);
    return null;
  }
}

export async function setCampaignListCache<T>(
  key: string,
  value: T,
  scope: CampaignListCacheScope,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlForScope(scope) });
  } catch (e) {
    console.warn("[campaign-list-cache] set failed:", e);
  }
}

/** Invalidate brand list keys after publish / approve / end. */
export async function invalidateCampaignListCacheForAdvertiser(
  advertiserId: string | null | undefined,
): Promise<number> {
  if (!advertiserId) return 0;
  return invalidateCampaignListCacheByPrefix(
    `${KEY_PREFIX}:advertiser:${advertiserId}:`,
  );
}

/** Invalidate admin list pages (shared across admins). */
export async function invalidateAdminCampaignListCache(): Promise<number> {
  return invalidateCampaignListCacheByPrefix(`${KEY_PREFIX}:admin:`);
}

/** Invalidate opportunity shelves (shared-ish; keyed by creator). */
export async function invalidateOpportunitiesListCache(): Promise<number> {
  return invalidateCampaignListCacheByPrefix(`${KEY_PREFIX}:opportunities:`);
}

export async function invalidateAllCampaignListCache(): Promise<number> {
  return invalidateCampaignListCacheByPrefix(`${KEY_PREFIX}:`);
}

async function invalidateCampaignListCacheByPrefix(
  prefix: string,
): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  let cleared = 0;
  try {
    let cursor: number | string = 0;
    do {
      const result = (await redis.scan(cursor, {
        match: `${prefix}*`,
        count: 100,
      })) as [string | number, string[]];
      cursor = result[0];
      const keys = result[1] || [];
      if (keys.length > 0) {
        await redis.del(...keys);
        cleared += keys.length;
      }
    } while (String(cursor) !== "0");
  } catch (e) {
    console.warn("[campaign-list-cache] invalidate failed:", e);
  }
  return cleared;
}
