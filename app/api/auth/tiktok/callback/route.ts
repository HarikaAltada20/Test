import { NextRequest, NextResponse } from "next/server";
import { duplicateSocialAccountLinkedMessage } from "@/lib/duplicate-social-account-message";
import { TikTokProvider } from "@/lib/tiktok/provider/TikTokProvider";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    const provider = new TikTokProvider();
    const customRedirectUri = provider.getRedirectUri();
    const origin = new URL(req.url).origin;
    const settingsUrl = `${origin}/dashboard/settings`;

    console.log("[TikTok Auth Callback] Received callback", {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
    });

    if (error) {
      console.error(
        "[TikTok Auth Callback] User denied access or error:",
        error,
      );
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      console.error("[TikTok Auth Callback] Missing code or state");
      return NextResponse.redirect(
        `${settingsUrl}?error=invalid_tiktok_callback`,
      );
    }

    // 1. Verify CSRF state token
    const storedState = req.cookies.get("tiktok_auth_state")?.value;
    const storedVerifier = req.cookies.get("tiktok_auth_verifier")?.value;

    console.log("[TikTok Auth Callback] Validating OAuth cookies", {
      hasStoredState: !!storedState,
      hasStoredVerifier: !!storedVerifier,
    });

    if (!storedState || state !== storedState) {
      console.error("[TikTok Auth Callback] CSRF token mismatch or expired");
      return NextResponse.redirect(`${settingsUrl}?error=csrf_token_mismatch`);
    }

    // 2. Clear state cookies - we'll create the final response at the end
    // but we need to track that these cookies should be deleted.
    const tiktokCookiesToRemove = ["tiktok_auth_state", "tiktok_auth_verifier"];

    // 3. Initialize Provider and exchange code
    console.log("[TikTok Auth Callback] Exchanging code for token...");

    // Pass the stored verifier for PKCE validation
    let tokens;
    try {
      tokens = await provider.exchangeCodeForToken(
        code,
        storedVerifier,
        customRedirectUri,
      );
      console.log("[TikTok Auth Callback] Token exchange successful");
    } catch (tokenError: any) {
      console.error(
        "[TikTok Auth Callback] Token exchange failed:",
        tokenError,
      );
      return NextResponse.redirect(
        `${settingsUrl}?error=tiktok_token_exchange_failed`,
      );
    }

    console.log("[TikTok Auth Callback] Code exchanged successfully", {
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });

    console.log("[TikTok Auth Callback] Fetching profile...");

    // 4. Get Creator Profile using the new Access Token
    // Don't block connection save if profile fetch fails - save tokens regardless
    interface ProfileType {
      id: string;
      username: string;
      displayName?: string | undefined;
      avatarUrl?: string | undefined;
      followerCount?: number | undefined;
      followingCount?: number | undefined;
      likesCount?: number | undefined;
      videoCount?: number | undefined;
    }

    let profile: ProfileType = {
      id: "",
      username: "",
      displayName: undefined,
      avatarUrl: undefined,
      followerCount: undefined,
      followingCount: undefined,
      likesCount: undefined,
      videoCount: undefined,
    };
    try {
      profile = await provider.getProfile(tokens.accessToken);
      console.log("[TikTok Auth Callback] Profile fetched successfully");
    } catch (profileError: any) {
      console.warn(
        "[TikTok Auth Callback] Profile fetch failed, will save connection with tokens only:",
        profileError.message,
      );
    }

    console.log("[TikTok Auth Callback] Profile data:", {
      id: profile.id || "not available",
      username: profile.username || "not available",
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      likesCount: profile.likesCount,
      videoCount: profile.videoCount,
    });

    // 5. Store in Supabase
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(
        "[TikTok Auth Callback] Unauthenticated user attempt:",
        userError,
      );
      return NextResponse.redirect(
        `${origin}/auth/signin?redirect=/dashboard/settings`,
      );
    }

    const { data: existingProfile } = await supabase
      .from("creator_profiles")
      .select("tiktok_account")
      .eq("id", user.id)
      .single();

    console.log("[TikTok Auth Callback] User authenticated:", user.id);

    // --- REFINED: Check for duplicate connection within the switcher group ---
    if (profile.id) {
      const { data: vaultLinks } = await supabase
        .from('user_sessions_vault')
        .select('target_user_id')
        .eq('owner_user_id', user.id);

      const linkedAccountIds = vaultLinks?.map(link => link.target_user_id) || [];

      const { data: duplicateAccount, error: duplicateCheckError } = await supabase
          .from('creator_profiles')
          .select('id')
          .eq('tiktok_account->>platform_user_id', profile.id)
          .neq('id', user.id)
          .maybeSingle();

      if (duplicateCheckError) {
          console.error('[TikTok Auth Callback] Error checking for duplicate TikTok account:', duplicateCheckError);
          throw new Error(`Failed to verify account uniqueness: ${duplicateCheckError.message}`);
      }

      if (duplicateAccount && linkedAccountIds.includes(duplicateAccount.id)) {
          console.warn(`[TikTok Auth Callback] TikTok account ${profile.id} is already linked to user ${duplicateAccount.id} in the same switcher group`);
          // Log the blocked attempt
          try {
              const adminSupabase = (await import('@/utils/supabase/admin')).createAdminClient();
              await adminSupabase.rpc("log_action", { 
                  p_action: "social_link_blocked", 
                  p_metadata: { 
                      platform: 'tiktok',
                      platform_user_id: profile.id,
                      existing_owner_id: duplicateAccount.id,
                      reason: 'duplicate_within_switcher_group'
                  },
                  p_user_id: user.id
              });
          } catch (logErr) {
              console.warn('[TikTok Auth Callback] Failed to log blocked connection attempt:', logErr);
          }

          const dupUrl = new URL(settingsUrl);
          dupUrl.searchParams.set("error", "duplicate_account");
          dupUrl.searchParams.set(
            "message",
            await duplicateSocialAccountLinkedMessage(
              duplicateAccount.id,
              "TikTok",
            ),
          );
          return NextResponse.redirect(dupUrl);
      }
    }
    // --- END REFINED ---

    const connectionData = {
      platform_user_id: profile.id,
      username: profile.username,
      avatar_url: profile.avatarUrl,
      follower_count: profile.followerCount,
      following_count: profile.followingCount,
      likes_count: profile.likesCount,
      video_count: profile.videoCount,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: new Date(
        Date.now() + (tokens.expiresIn || 86400) * 1000,
      ).toISOString(),
      scopes: tokens.scope ? [tokens.scope] : [],
      last_synced_at: new Date().toISOString(),
    };

    const prev = {
      ...(existingProfile?.tiktok_account || {}),
    } as Record<string, unknown>;
    delete prev.marketing;
    const finalTikTokAccount = {
      ...prev,
      ...connectionData,
      needs_reconnect: false,
    };

    console.log("[TikTok Auth Callback] Updating creator_profiles:", {
      creator_id: user.id,
      username: connectionData.username,
    });

    const { error: dbError } = await supabase
      .from("creator_profiles")
      .update({
        tiktok_account: finalTikTokAccount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (dbError) {
      console.error(
        "[TikTok Auth Callback] Database error updating creator_profiles:",
        dbError,
      );
      return NextResponse.redirect(
        `${settingsUrl}?error=tiktok_db_error`,
      );
    }

    console.log("[TikTok Auth Callback] Connection stored successfully!");

    const finalRedirectUrl = `${settingsUrl}?success=true&platform=tiktok`;
    const finalResponse = NextResponse.redirect(finalRedirectUrl);
    
    // Apply cookie deletions
    tiktokCookiesToRemove.forEach(cookieName => {
      finalResponse.cookies.delete(cookieName);
    });

    return finalResponse;
  } catch (error: any) {
    console.error("[TikTok Auth Callback] Unhandled Error:", error);
    console.error("[TikTok Auth Callback] Error stack:", error.stack);

    const origin = new URL(req.url).origin;
    return NextResponse.redirect(
      `${origin}/dashboard/settings?error=tiktok_oauth_failed`,
    );
  }
}