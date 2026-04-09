import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { TikTokBusinessApiClient } from "@/lib/tiktok/api/TikTokBusinessApiClient";

export async function GET(req: NextRequest) {
  const client = new TikTokBusinessApiClient();

  // 1. Generate State for security
  const state = crypto.randomBytes(16).toString("hex");

  // 2. Build Business Auth URL
  const appId = client.getAppId();
  // Use the client's pre-configured redirect URI (based on NEXT_PUBLIC_APP_URL)
  const redirectUri = client.getRedirectUri();
  
  const authUrl = new URL("https://business-api.tiktok.com/portal/auth");
  authUrl.searchParams.append("app_id", appId);
  authUrl.searchParams.append("state", state);
  authUrl.searchParams.append("redirect_uri", redirectUri);
  
  // Note: TTO might use 'scope' or might just use the app's approved scopes automatically
  // For TCM, it's often automatic based on the app's approved features.

  console.log("[TikTok Marketing Auth] Initiating flow...");
  console.log("[TikTok Marketing Auth] Redirect URI:", redirectUri);
  console.log("[TikTok Marketing Auth] URL:", authUrl.toString());

  const response = NextResponse.redirect(authUrl.toString());

  // 3. Store State in cookie
  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set("tiktok_marketing_auth_state", state, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return response;
}
