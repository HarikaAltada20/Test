import { NextRequest, NextResponse } from "next/server";
import { TikTokBusinessApiClient } from "@/lib/tiktok/api/TikTokBusinessApiClient";
import { createClient } from "@/utils/supabase/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const authCode =
    searchParams.get("auth_code") ?? searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const origin = new URL(req.url).origin;
  const settingsUrl = `${origin}/dashboard/settings`;

  console.log("[TikTok Marketing Callback] Received callback:", {
    authCode: authCode ? "present" : "missing",
    state: state ? "present" : "missing",
    error: error || "none",
  });

  if (error) {
    return NextResponse.redirect(`${settingsUrl}?error=marketing_auth_failed&details=${encodeURIComponent(error)}`);
  }

  // 1. Verify State
  const storedState = req.cookies.get("tiktok_marketing_auth_state")?.value;
  if (!storedState || state !== storedState) {
    console.error("[TikTok Marketing Callback] CSRF mismatch");
    return NextResponse.redirect(`${settingsUrl}?error=csrf_token_mismatch`);
  }

  // 2. Clear state cookie
  const response = NextResponse.redirect(`${settingsUrl}?success=true&platform=tiktok_marketing`);
  response.cookies.delete("tiktok_marketing_auth_state");

  try {
    const client = new TikTokBusinessApiClient();
    
    // 3. Exchange code for tokens
    console.log("[TikTok Marketing Callback] Exchanging code for tokens...");
    const tokenData = await client.getAccessToken(authCode!);
    
    if (tokenData.code !== 0) {
        throw new Error(tokenData.message || "Failed to exchange marketing token");
    }

    const raw = tokenData.data as Record<string, unknown>;
    const str = (v: unknown): string | undefined => {
      if (v == null) return undefined;
      const s = String(v);
      return s.length ? s : undefined;
    };

    const access_token = str(raw.access_token);
    if (!access_token) {
      throw new Error("Marketing token response missing access_token");
    }

    const refresh_token = str(raw.refresh_token);
    const expiresIn = Number(raw.expires_in ?? raw.expires ?? 86400);
    const access_token_expires_at = new Date(
      Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 86400) * 1000,
    ).toISOString();

    const creator_ids = Array.isArray(raw.creator_ids)
      ? (raw.creator_ids as unknown[]).map((x) => String(x)).filter(Boolean)
      : [];
    const advertiser_ids = Array.isArray(raw.advertiser_ids)
      ? (raw.advertiser_ids as unknown[]).map((x) => String(x)).filter(Boolean)
      : [];

    console.log("[TikTok Marketing Callback] Token response keys:", Object.keys(raw));
    console.log(
      "[TikTok Marketing Callback] creator_ids count:",
      creator_ids.length,
      "advertiser_ids count:",
      advertiser_ids.length,
    );

    // 4. Get User Profile to link
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[TikTok Marketing Callback] Unauthenticated user");
      return NextResponse.redirect(`${origin}/auth/signin`);
    }

    // 5. Fetch existing tiktok_account to preserve it
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("tiktok_account")
      .eq("id", user.id)
      .single();

    const prev = (profile?.tiktok_account?.marketing ?? {}) as Record<
      string,
      unknown
    >;

    const business_id =
      str(raw.business_id) ??
      str(raw.core_user_id) ??
      str(raw.open_id) ??
      creator_ids[0] ??
      str(prev.business_id) ??
      null;

    const creator_id =
      creator_ids[0] ??
      str(raw.creator_id) ??
      str(prev.creator_id) ??
      null;

    /** TCM endpoints require tto_tcm_account_id; fall back to creator/business id from OAuth. */
    const tto_tcm_account_id =
      str(raw.tto_tcm_account_id) ??
      str(raw.tto_tcm_account) ??
      str(raw.tcm_account_id) ??
      creator_id ??
      business_id ??
      str(prev.tto_tcm_account_id) ??
      null;

    const advertiser_id =
      advertiser_ids[0] ??
      str(raw.advertiser_id) ??
      str(prev.advertiser_id) ??
      null;

    const marketingData = {
      ...prev,
      access_token,
      refresh_token: refresh_token ?? str(prev.refresh_token) ?? null,
      access_token_expires_at,
      creator_id,
      advertiser_id,
      business_id,
      tto_tcm_account_id,
      connected_at: str(prev.connected_at) ?? new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    const updatedTikTokAccount = {
      ...(profile?.tiktok_account || {}),
      marketing: marketingData,
    };

    // 6. Update database
    const { error: dbError } = await supabase
      .from("creator_profiles")
      .update({
        tiktok_account: updatedTikTokAccount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (dbError) {
      console.error("[TikTok Marketing Callback] DB Update failed:", dbError);
      return NextResponse.redirect(`${settingsUrl}?error=tiktok_db_error`);
    }

    console.log("[TikTok Marketing Callback] Marketing account linked successfully!");
    return response;

  } catch (err: any) {
    console.error("[TikTok Marketing Callback] Error:", err);
    return NextResponse.redirect(`${settingsUrl}?error=tiktok_marketing_failed&details=${encodeURIComponent(err.message)}`);
  }
}
