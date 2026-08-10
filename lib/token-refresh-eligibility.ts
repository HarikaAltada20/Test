/**
 * Weekly social-account refresh eligibility for the token-refresh queue.
 * Creators are due only after 7 days from connection (or last successful details refresh).
 */

export const TOKEN_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export type SocialAccountTimestamps = {
  connected_at?: string | null;
  last_details_refresh_at?: string | null;
  next_details_refresh_at?: string | null;
  updated_at?: string | null;
  last_synced_at?: string | null;
} | null | undefined;

function parseIsoMs(value: string | null | undefined): number | null {
  if (!value || typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Anchor for the 7-day cadence:
 * 1) last successful details refresh
 * 2) original connection time
 * 3) legacy fallbacks (updated_at / last_synced_at)
 */
export function getAccountRefreshAnchorMs(
  account: SocialAccountTimestamps,
): number | null {
  if (!account || typeof account !== "object") return null;
  return (
    parseIsoMs(account.last_details_refresh_at) ??
    parseIsoMs(account.connected_at) ??
    parseIsoMs(account.updated_at) ??
    parseIsoMs(account.last_synced_at)
  );
}

export function isPlatformAccountDueForWeeklyRefresh(
  account: SocialAccountTimestamps,
  now: Date = new Date(),
): boolean {
  if (!account || typeof account !== "object") return false;

  const nextDue = parseIsoMs(account.next_details_refresh_at);
  if (nextDue != null) {
    return now.getTime() >= nextDue;
  }

  const anchor = getAccountRefreshAnchorMs(account);
  if (anchor == null) {
    // Connected blob with no usable timestamps — treat as due so we backfill.
    return true;
  }
  return now.getTime() >= anchor + TOKEN_REFRESH_INTERVAL_MS;
}

export function isCreatorDueForWeeklyTokenRefresh(
  profile: {
    tiktok_account?: SocialAccountTimestamps;
    instagram_account?: SocialAccountTimestamps;
    youtube_account?: SocialAccountTimestamps;
  },
  now: Date = new Date(),
): boolean {
  return (
    isPlatformAccountDueForWeeklyRefresh(profile.tiktok_account, now) ||
    isPlatformAccountDueForWeeklyRefresh(profile.instagram_account, now) ||
    isPlatformAccountDueForWeeklyRefresh(profile.youtube_account, now)
  );
}

/** Preserve first connection time; set on first connect only. */
export function resolveConnectedAt(
  existing: SocialAccountTimestamps,
  now: Date = new Date(),
): string {
  const existingConnected = parseIsoMs(existing?.connected_at);
  if (existingConnected != null && existing?.connected_at) {
    return existing.connected_at;
  }
  return now.toISOString();
}

/** Stamp successful weekly refresh so the daily sweeper waits another 7 days. */
export function withWeeklyRefreshTimestamps<T extends Record<string, unknown>>(
  account: T,
  now: Date = new Date(),
): T & {
  last_details_refresh_at: string;
  next_details_refresh_at: string;
  connected_at: string;
} {
  const nowIso = now.toISOString();
  const nextIso = new Date(now.getTime() + TOKEN_REFRESH_INTERVAL_MS).toISOString();
  return {
    ...account,
    connected_at: resolveConnectedAt(
      account as SocialAccountTimestamps,
      now,
    ),
    last_details_refresh_at: nowIso,
    next_details_refresh_at: nextIso,
  };
}
