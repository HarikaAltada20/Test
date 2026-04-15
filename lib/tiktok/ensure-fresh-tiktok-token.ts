import type { SupabaseClient } from "@supabase/supabase-js";
import { TikTokProvider } from "@/lib/tiktok/provider/TikTokProvider";

export type EnsureFreshTikTokTokenResult =
  | { ok: true; accessToken: string; tiktokAccount: Record<string, unknown> }
  | { ok: false; error: string; expired?: boolean };

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

/**
 * Ensures a valid TikTok user access token for Display API calls.
 * Refreshes using Login Kit refresh_token when expired and persists to creator_profiles.
 * On refresh failure (or missing refresh token), sets tiktok_account.needs_reconnect so
 * settings can prompt for full OAuth again.
 * @see https://developers.tiktok.com/doc/server-api-user-access-token-management
 */
export async function ensureFreshTikTokToken(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<EnsureFreshTikTokTokenResult> {
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

  if (!access_token) {
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

  if (isExpired) {
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
      const provider = new TikTokProvider();
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
      await persistTiktokAccount(supabase, creatorId, connection);
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

  return { ok: true, accessToken: access_token, tiktokAccount: connection };
}
