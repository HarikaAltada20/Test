/**
 * Short-lived Redis cache for campaign/opportunity list API responses.
 * Freshness contract: list views may lag up to TTL; detail/payout screens stay live.
 *
 * Uses the same Upstash Redis as metrics queues when configured; no-ops otherwise.
 *
 * Opportunities invalidation uses a generation counter (INCR) so publish does not
 * SCAN every creator × page × filter key. Stale keys expire via TTL.
 */

import { Redis } from "@upstash/redis";

const KEY_PREFIX = "campaign_list:v2";
const OPPORTUNITIES_GEN_KEY = `${KEY_PREFIX}:opportunities:_gen`;

/** Brand / admin dashboards — 1 min so publish/approve still feel fresh. */
export const CAMPAIGN_LIST_CACHE_TTL_BRAND_SEC = 60;
/** Opportunities / discover — 2 min; higher creator traffic benefits from longer sharing. */
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

async function getOpportunitiesCacheGeneration(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    const value = await redis.get<number | string>(OPPORTUNITIES_GEN_KEY);
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (e) {
    console.warn("[campaign-list-cache] gen get failed:", e);
    return 0;
  }
}

/**
 * Stable cache key: list:{scope}:{owner}:{tab}:{sort}:{page}:{filters}
 * For opportunities, callers should prefer buildCampaignListCacheKeyAsync so the
 * generation segment is included (publish bumps gen instead of SCAN+DEL).
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
  /** Opportunities generation — omit only for non-opportunities scopes. */
  opportunitiesGen?: number;
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

  const ownerSegment =
    parts.scope === "opportunities"
      ? `g${parts.opportunitiesGen ?? 0}:${parts.ownerId}`
      : parts.ownerId;

  return [
    KEY_PREFIX,
    parts.scope,
    ownerSegment,
    parts.tab || "all",
    parts.sort,
    String(parts.page),
    String(parts.limit),
    filters,
  ].join(":");
}

/** Opportunities keys include the current generation (O(1) invalidate via INCR). */
export async function buildCampaignListCacheKeyAsync(parts: {
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
  countriesKey?: string;
}): Promise<string> {
  const opportunitiesGen =
    parts.scope === "opportunities"
      ? await getOpportunitiesCacheGeneration()
      : undefined;
  return buildCampaignListCacheKey({ ...parts, opportunitiesGen });
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

/**
 * Invalidate opportunity shelves for all creators without SCAN.
 * Bumps generation so new reads miss; old keys expire via TTL.
 */
export async function invalidateOpportunitiesListCache(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    await redis.incr(OPPORTUNITIES_GEN_KEY);
    return 1;
  } catch (e) {
    console.warn("[campaign-list-cache] opportunities gen bump failed:", e);
    return 0;
  }
}

/** Invalidate one creator’s opportunity list pages only (still SCAN — narrow prefix). */
export async function invalidateOpportunitiesListCacheForUser(
  userId: string | null | undefined,
): Promise<number> {
  if (!userId) return 0;
  // Keys are …:opportunities:g{N}:{userId}:… — match any generation for this user.
  return invalidateCampaignListCacheByPrefix(
    `${KEY_PREFIX}:opportunities:`,
    `*:${userId}:`,
  );
}

export async function invalidateAllCampaignListCache(): Promise<number> {
  // SCAN clears advertiser/admin/legacy opportunities keys; then bump gen so
  // new opportunities writes use a fresh namespace (also recreates _gen if deleted).
  const rest = await invalidateCampaignListCacheByPrefix(`${KEY_PREFIX}:`);
  const opportunities = await invalidateOpportunitiesListCache();
  return rest + opportunities;
}

/**
 * After a contest create/update/delete/publish/status change:
 * always clear that advertiser + admin lists; clear opportunities when
 * visibility to creators may change (publish, unpublish, delete, region, etc.).
 */
export async function invalidateCampaignListCachesAfterMutation(options: {
  advertiserId: string | null | undefined;
  /** Default true — brand-only draft edits can pass false. */
  touchOpportunities?: boolean;
}): Promise<{ advertiser: number; admin: number; opportunities: number }> {
  const touchOpportunities = options.touchOpportunities !== false;
  const [advertiser, admin, opportunities] = await Promise.all([
    invalidateCampaignListCacheForAdvertiser(options.advertiserId),
    invalidateAdminCampaignListCache(),
    touchOpportunities
      ? invalidateOpportunitiesListCache()
      : Promise.resolve(0),
  ]);
  return { advertiser, admin, opportunities };
}

async function invalidateCampaignListCacheByPrefix(
  prefix: string,
  /** Optional secondary glob after prefix* (e.g. `*:userId:` for gen keys). */
  matchSuffix?: string,
): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;

  const match = matchSuffix ? `${prefix}${matchSuffix}*` : `${prefix}*`;

  let cleared = 0;
  try {
    let cursor: number | string = 0;
    do {
      const result = (await redis.scan(cursor, {
        match,
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
