/**
 * Merge disconnect snapshots and Instagram analytics into creator_profiles archive JSONB columns.
 * Never persist OAuth secrets in archives.
 */

const SECRET_KEYS = new Set([
  "access_token",
  "refresh_token",
  "token_secret",
  "oauth_token",
  "oauth_token_secret",
]);

export type SimplePlatformArchive = {
  version: 1;
  disconnect_snapshots: DisconnectSnapshot[];
};

export type InstagramArchive = {
  version: 2;
  analytics?: {
    entries: Record<string, InstagramAnalyticsEntry>;
  };
  disconnect_snapshots?: DisconnectSnapshot[];
};

export type DisconnectSnapshot = {
  archived_at: string;
  reason: "user_disconnect";
  account: Record<string, unknown>;
};

/** Safe snapshot of connected IG account (no tokens) stored with analytics rows. */
export type InstagramProfileSnapshot = {
  username?: string;
  name_of_account?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  account_type?: string;
  profile_picture_url?: string;
  app_scoped_user_id?: string;
  instagram_user_id?: string;
};

export type InstagramDemographicRow = { label: string; value: number };

export type InstagramDemographicsBundle = {
  timeframe: string;
  follower_demographics?: Partial<
    Record<"country" | "age" | "gender", InstagramDemographicRow[]>
  >;
  engaged_audience_demographics?: Partial<
    Record<"country" | "age" | "gender", InstagramDemographicRow[]>
  >;
  errors: string[];
  /** Explains that demographic windows differ from interaction metrics range. */
  note?: string;
};

/** Safe fields only — never includes tokens. */
export function buildInstagramProfileSnapshot(
  account: Record<string, unknown> | null | undefined
): InstagramProfileSnapshot | null {
  if (!account || typeof account !== "object") return null;
  const a = account as Record<string, unknown>;
  const num = (k: string) =>
    typeof a[k] === "number" ? (a[k] as number) : undefined;
  const str = (k: string) =>
    typeof a[k] === "string" ? (a[k] as string) : undefined;
  const snap: InstagramProfileSnapshot = {
    username: str("username"),
    name_of_account: str("name_of_account") ?? str("name"),
    followers_count: num("followers_count"),
    follows_count: num("follows_count"),
    media_count: num("media_count"),
    account_type: str("account_type"),
    profile_picture_url: str("profile_picture_url"),
    app_scoped_user_id: str("app_scoped_user_id"),
    instagram_user_id: str("instagram_user_id"),
  };
  const hasAny = Object.values(snap).some((v) => v !== undefined);
  return hasAny ? snap : null;
}

export type InstagramAnalyticsEntry = {
  fetched_at: string;
  since: number;
  until: number;
  preset?: string;
  metrics: Record<string, unknown>;
  error?: string;
  /** Demographics require lifetime + timeframe; fetched alongside interaction metrics when refreshing. */
  demographics?: InstagramDemographicsBundle;
  /** Profile at fetch time (or omit if disconnected). */
  profile?: InstagramProfileSnapshot;
};

/** Deep clone and remove known secret fields from account JSON. */
export function redactSocialAccountSecrets(
  account: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!account || typeof account !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(account)) {
    if (SECRET_KEYS.has(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactSocialAccountSecrets(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function parseSimpleArchive(raw: unknown): SimplePlatformArchive {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const snaps = o.disconnect_snapshots;
    if (Array.isArray(snaps)) {
      return {
        version: 1,
        disconnect_snapshots: snaps as DisconnectSnapshot[],
      };
    }
  }
  return { version: 1, disconnect_snapshots: [] };
}

export function parseInstagramArchive(raw: unknown): InstagramArchive {
  const base: InstagramArchive = {
    version: 2,
    analytics: { entries: {} },
    disconnect_snapshots: [],
  };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  if (o.version === 2 || o.analytics || o.disconnect_snapshots) {
    const analytics = o.analytics as Record<string, unknown> | undefined;
    const entries =
      analytics &&
      analytics.entries &&
      typeof analytics.entries === "object" &&
      !Array.isArray(analytics.entries)
        ? (analytics.entries as Record<string, InstagramAnalyticsEntry>)
        : {};
    const disconnect_snapshots = Array.isArray(o.disconnect_snapshots)
      ? (o.disconnect_snapshots as DisconnectSnapshot[])
      : [];
    return {
      version: 2,
      analytics: { entries },
      disconnect_snapshots,
    };
  }
  return base;
}

export function appendDisconnectSnapshotSimple(
  existing: unknown,
  account: Record<string, unknown> | null | undefined
): SimplePlatformArchive {
  const parsed = parseSimpleArchive(existing);
  const snapshot: DisconnectSnapshot = {
    archived_at: new Date().toISOString(),
    reason: "user_disconnect",
    account: redactSocialAccountSecrets(account ?? undefined),
  };
  return {
    version: 1,
    disconnect_snapshots: [...parsed.disconnect_snapshots, snapshot],
  };
}

export function appendInstagramDisconnectAndClearAccount(
  existingArchive: unknown,
  liveAccount: Record<string, unknown> | null | undefined
): InstagramArchive {
  const parsed = parseInstagramArchive(existingArchive);
  const snapshot: DisconnectSnapshot = {
    archived_at: new Date().toISOString(),
    reason: "user_disconnect",
    account: redactSocialAccountSecrets(liveAccount ?? undefined),
  };
  return {
    ...parsed,
    disconnect_snapshots: [...(parsed.disconnect_snapshots ?? []), snapshot],
  };
}

export function mergeInstagramAnalyticsEntry(
  existingArchive: unknown,
  entryKey: string,
  entry: InstagramAnalyticsEntry
): InstagramArchive {
  const parsed = parseInstagramArchive(existingArchive);
  return {
    ...parsed,
    analytics: {
      entries: {
        ...(parsed.analytics?.entries ?? {}),
        [entryKey]: entry,
      },
    },
  };
}
