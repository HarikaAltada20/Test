import { NextRequest, NextResponse } from "next/server";
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

    console.log("[TikTok Auth Callback] Received callback with params:", {
      code: code ? "present" : "missing",
      state: state ? "present" : "missing",
      error: error || "none",
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

    console.log(
      "[TikTok Auth Callback] Stored code_verifier (first 10):",
      storedVerifier ? storedVerifier.substring(0, 10) : "missing",
    );

    console.log(
      "[TikTok Auth Callback] Stored state:",
      storedState ? "present" : "missing",
    );
    console.log(
      "[TikTok Auth Callback] Stored verifier:",
      storedVerifier ? "present" : "missing",
    );

    if (!storedState || state !== storedState) {
      console.error("[TikTok Auth Callback] CSRF token mismatch or expired");
      console.log("[TikTok Auth Callback] Received state:", state);
      console.log("[TikTok Auth Callback] Stored state:", storedState);
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
        `${settingsUrl}?error=tiktok_token_exchange_failed&details=${encodeURIComponent(tokenError.message)}`,
      );
    }

    console.log("[TikTok Auth Callback] Code exchanged successfully. Tokens:", {
      accessToken: tokens.accessToken ? "present" : "missing",
      refreshToken: tokens.refreshToken ? "present" : "missing",
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

    // Fetch existing profile to preserve other fields (like 'marketing')
    const { data: existingProfile } = await supabase
      .from("creator_profiles")
      .select("tiktok_account")
      .eq("id", user.id)
      .single();

    console.log("[TikTok Auth Callback] User authenticated:", user.id);

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

    const finalTikTokAccount = {
      ...(existingProfile?.tiktok_account || {}),
      ...connectionData,
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
        `${settingsUrl}?error=tiktok_db_error&details=${encodeURIComponent(dbError.message)}`,
      );
    }

    console.log("[TikTok Auth Callback] Connection stored successfully!");
    
    // 6. Final Redirect: If marketing is not connected, go to marketing auth. 
    // Otherwise go back to settings.
    const hasMarketing = !!existingProfile?.tiktok_account?.marketing;
    let finalRedirectUrl = `${settingsUrl}?success=true&platform=tiktok`;
    
    if (!hasMarketing) {
      console.log("[TikTok Auth Callback] Marketing not connected, redirecting to Marketing Auth...");
      finalRedirectUrl = `${origin}/api/auth/tiktok/marketing/authorize`;
    } else {
      console.log("[TikTok Auth Callback] Marketing already connected, redirecting to settings.");
    }

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
      `${origin}/dashboard/settings?error=tiktok_oauth_failed&details=${encodeURIComponent(error.message)}`,
    );
  }
}