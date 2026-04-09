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

    const {
      access_token,
      advertiser_ids,
      creator_ids,
      business_id,
      core_user_id,
    } = tokenData.data as {
      access_token?: string;
      advertiser_ids?: string[];
      creator_ids?: string[];
      business_id?: string;
      core_user_id?: string;
    };
    
    console.log("[TikTok Marketing Callback] Success! Received tokens for creators:", creator_ids);

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

    const marketingData = {
      access_token,
      creator_id: creator_ids?.[0],
      advertiser_id: advertiser_ids?.[0],
      /** Required for GET …/business/video/list/ — set from token when TikTok returns it. */
      business_id:
        business_id ?? core_user_id ?? creator_ids?.[0] ?? null,
      connected_at: new Date().toISOString(),
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
