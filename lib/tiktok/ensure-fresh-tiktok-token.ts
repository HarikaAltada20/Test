import type { SupabaseClient } from "@supabase/supabase-js";
import { TikTokProvider } from "@/lib/tiktok/provider/TikTokProvider";
import type { CreatorProfile } from "@/lib/core/interfaces/IPlatformProvider";

export type EnsureFreshTikTokTokenResult =
  | { ok: true; accessToken: string; tiktokAccount: Record<string, unknown> }
  | { ok: false; error: string; expired?: boolean };

export type EnsureFreshTikTokTokenOptions = {
  /** Always exchange refresh_token for a new access token (ignore expires_at). */
  forceRefresh?: boolean;
  /** Fetch and persist username/followers/avatar after a valid access token is available. */
  syncProfile?: boolean;
};

async function persistTiktokAccount(
  supabase: SupabaseClient,
  creatorId: string,
  tiktokAccount: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("creator_profiles")
    .update({
      tiktok_account: tiktokAccount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", creatorId);
  if (error) {
    console.error(
      "[ensureFreshTikTokToken] Failed to persist tiktok_account:",
      error,
    );
  }
}

/** Merge Display API profile fields into the stored tiktok_account blob. */
export function mergeTikTokProfileIntoAccount(
  connection: Record<string, unknown>,
  profile: CreatorProfile,
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...connection,
    last_synced_at: new Date().toISOString(),
    needs_reconnect: false,
  };

  if (profile.id) {
    next.platform_user_id = profile.id;
  }
  if (profile.username) {
    next.username = profile.username;
  }
  if (profile.displayName) {
    next.display_name = profile.displayName;
  }
  if (profile.avatarUrl) {
    next.avatar_url = profile.avatarUrl;
  }
  if (typeof profile.followerCount === "number") {
    next.follower_count = profile.followerCount;
  }
  if (typeof profile.followingCount === "number") {
    next.following_count = profile.followingCount;
  }
  if (typeof profile.likesCount === "number") {
    next.likes_count = profile.likesCount;
  }
  if (typeof profile.videoCount === "number") {
    next.video_count = profile.videoCount;
  }

  return next;
}

async function fetchAndMergeProfile(
  provider: TikTokProvider,
  accessToken: string,
  connection: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    const profile = await provider.getProfile(accessToken);
    return mergeTikTokProfileIntoAccount(connection, profile);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      "[ensureFreshTikTokToken] Profile sync failed (tokens kept):",
      msg,
    );
    return {
      ...connection,
      last_synced_at: new Date().toISOString(),
    };
  }
}

/**
 * Ensures a valid TikTok user access token for Display API calls.
 * Refreshes using Login Kit refresh_token when expired (or when forceRefresh)
 * and persists to creator_profiles.
 * When syncProfile is true (or a token refresh just ran), also refreshes
 * username / avatar / follower stats from the Display API.
 * On refresh failure (or missing refresh token), sets tiktok_account.needs_reconnect so
 * settings can prompt for full OAuth again.
 * @see https://developers.tiktok.com/doc/server-api-user-access-token-management
 */
export async function ensureFreshTikTokToken(
  supabase: SupabaseClient,
  creatorId: string,
  options?: EnsureFreshTikTokTokenOptions,
): Promise<EnsureFreshTikTokTokenResult> {
  const forceRefresh = options?.forceRefresh === true;
  const syncProfile = options?.syncProfile === true;

  const { data: profile, error } = await supabase
    .from("creator_profiles")
    .select("tiktok_account")
    .eq("id", creatorId)
    .single();

  if (error || !profile?.tiktok_account) {
    return {
      ok: false,
      error: `TikTok connection not found: ${error?.message ?? "unknown"}`,
    };
  }

  let connection = profile.tiktok_account as Record<string, unknown>;
  let access_token = connection.access_token as string;
  const refresh_token = connection.refresh_token as string;
  const expires_at = connection.expires_at as string | undefined;

  if (!access_token && !refresh_token) {
    await persistTiktokAccount(supabase, creatorId, {
      ...connection,
      needs_reconnect: true,
    });
    return { ok: false, error: "Missing TikTok access_token", expired: true };
  }

  const expirationDate = expires_at ? new Date(expires_at) : null;
  // Use a 1-hour buffer to refresh proactively before actual expiration
  const BUFFER_MS = 3600 * 1000;
  const isExpired =
    !expirationDate ||
    Number.isNaN(expirationDate.getTime()) ||
    expirationDate.getTime() <= Date.now() + BUFFER_MS;

  let didRefreshToken = false;
  const provider = new TikTokProvider();

  if (forceRefresh || isExpired) {
    if (!refresh_token) {
      await persistTiktokAccount(supabase, creatorId, {
        ...connection,
        needs_reconnect: true,
      });
      return {
        ok: false,
        error:
          "TikTok token expired and no refresh token stored. Reconnect in settings.",
        expired: true,
      };
    }
    try {
      const newTokens = await provider.refreshAccessToken(refresh_token);
      access_token = newTokens.accessToken;
      const newRefresh = newTokens.refreshToken || refresh_token;
      const newExpires = new Date(
        Date.now() + (newTokens.expiresIn || 86400) * 1000,
      ).toISOString();
      connection = {
        ...connection,
        access_token,
        refresh_token: newRefresh,
        expires_at: newExpires,
        last_synced_at: new Date().toISOString(),
        needs_reconnect: false,
      };
      if (newTokens.scope) {
        connection.scopes = Array.isArray(newTokens.scope)
          ? newTokens.scope
          : String(newTokens.scope)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
      }
      didRefreshToken = true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await persistTiktokAccount(supabase, creatorId, {
        ...connection,
        needs_reconnect: true,
      });
      return {
        ok: false,
        error: `TikTok token refresh failed: ${msg}`,
        expired: true,
      };
    }
  }

  if (!access_token) {
    await persistTiktokAccount(supabase, creatorId, {
      ...connection,
      needs_reconnect: true,
    });
    return { ok: false, error: "Missing TikTok access_token", expired: true };
  }

  // Always sync profile after a token refresh; also when caller asks for it.
  if (didRefreshToken || syncProfile) {
    connection = await fetchAndMergeProfile(provider, access_token, connection);
    await persistTiktokAccount(supabase, creatorId, connection);
  }

  return { ok: true, accessToken: access_token, tiktokAccount: connection };
}
