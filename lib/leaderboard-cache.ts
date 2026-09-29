import { revalidateTag } from "next/cache";

/** Aligns with creator metrics refresh cooldown (2h) — see METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES */
export const LEADERBOARD_CACHE_SECONDS = 7200;

export function leaderboardCacheTag(contestId: string): string {
  return `leaderboard-contest-${contestId}`;
}

/**
 * Bust Next.js data cache for this contest's public leaderboard API.
 * Call after: new submission, Twitter join-campaign (`/api/twitter-apis/join-campaign`),
 * after `twitter-refresh-tweets` / `fetch-raid-engagements` persist data (feed or leaderboard refresh),
 * successful sync metrics refresh, or explicit "fresh data" actions.
 * Not when only enqueueing a Twitter / Instagram metrics queue job — wait for the worker
 * (twitter-refresh-tweets, fetch-raid-engagements). Instagram insights: revalidate once the
 * run finishes and `contests.last_metrics_updated` is set (runs typically complete within ~2 minutes;
 * the UI reloads / shows fresh data after that, so per-batch invalidation is unnecessary).
 */
export function revalidateLeaderboardCache(contestId: string): void {
  try {
    revalidateTag(leaderboardCacheTag(contestId));
  } catch (e) {
    console.warn("[leaderboard-cache] revalidateTag failed:", e);
  }
}
