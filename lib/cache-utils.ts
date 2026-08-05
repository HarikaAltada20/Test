/**
 * In-memory cache utility with TTL support
 * Used for caching expensive database queries and API responses
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly defaultTTL: number;

  constructor(defaultTTL: number = 600000) {
    // Default TTL: 10 minutes
    this.defaultTTL = defaultTTL;

    // Clean up expired entries
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set a value in cache with optional custom TTL
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data: value, expiresAt });
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries matching a prefix
   */
  clearPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
    };
  }
}

// Create singleton instances for different cache buckets
export const leaderboardCache = new MemoryCache(600000); // 10 minutes TTL
export const adminLeaderboardCache = new MemoryCache(600000); // 10 minutes TTL
export const dailyChallengeCache = new MemoryCache(3600000); // 1 hour TTL
export const contestCache = new MemoryCache(300000); // 5 minutes TTL
export const contestDetailsCache = new MemoryCache(300000); // 5 minutes TTL
/**
 * Generate cache key for leaderboard queries
 */
export function getLeaderboardCacheKey(params: {
  sortBy?: string;
  platform?: string;
  page?: number;
  limit?: number;
  isAdmin?: boolean;
}): string {
  const {
    sortBy = "winnings",
    platform = "all",
    page = 1,
    limit = 25,
    isAdmin = false,
  } = params;
  const prefix = isAdmin ? "admin_leaderboard" : "leaderboard";
  return `${prefix}:${sortBy}:${platform}:${page}:${limit}`;
}

/**
 * Generate cache key for users query (base data)
 */
export function getUsersCacheKey(): string {
  return "leaderboard:users:all";
}

/**
 * Generate cache key for platform-specific contest data
 */
export function getPlatformContestsCacheKey(platform: string): string {
  return `leaderboard:platform:${platform}:contests`;
}

/**
 * Generate cache key for platform-specific submissions data
 */
export function getPlatformSubmissionsCacheKey(platform: string): string {
  return `leaderboard:platform:${platform}:submissions:v3`;
}

/**
 * Clear all leaderboard-related cache
 */
export function clearLeaderboardCache(): void {
  leaderboardCache.clearPrefix("leaderboard:");
  adminLeaderboardCache.clearPrefix("admin_leaderboard:");
}

export function getDailyChallengeCacheKey(params: {
  period: string;
  scope: string;
  page: number;
  limit: number;
}): string {
  return `daily_challenge:${params.period}:${params.scope}:${params.page}:${params.limit}`;
}

/** Persist last successful gated `fresh=1` time; shared across page/limit for same event & user slice. Prefix must stay `daily_challenge:` for clears. */
export function getDailyChallengeLastFreshMetaKey(params: {
  eventSegmentId: string;
  userId: string;
  period: string;
  scope: string;
}): string {
  return `daily_challenge:lastFresh:${params.eventSegmentId}:user:${params.userId}:${params.period}:${params.scope}`;
}

export function clearDailyChallengeCache(): number {
  return dailyChallengeCache.clearPrefix("daily_challenge:");
}


/**
 * Generate cache key for contests queries
 */
export function getContestsCacheKey(params: {
  advertiserId?: string;
  includeAdvertiserProfile?: boolean;
}): string {
  const { advertiserId = "all", includeAdvertiserProfile = false } = params;
  return `contests:list:${advertiserId}:${includeAdvertiserProfile}`;
}

/**
 * Generate cache key for single contest details
 */
export function getContestDetailsCacheKey(contestId: string): string {
  return `contests:details:${contestId}`;
}

/**
 * Clear all contests-related cache
 */
export function clearContestsCache(): number {
  const listCount = contestCache.clearPrefix("contests:list:");
  const detailsCount = contestDetailsCache.clearPrefix("contests:details:");
  return listCount + detailsCount;
}
