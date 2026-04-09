import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { TikTokProvider } from "@/lib/tiktok/provider/TikTokProvider";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const country = searchParams.get("country") || "";
  const tz = searchParams.get("tz") || "";

  // Remove timezone-based blocking to allow VPN users to connect
  // Only block if explicitly set to India (not by timezone detection)
  const isFromIndia = country === "india" || country === "in";

  const origin = new URL(req.url).origin;

  if (isFromIndia) {
    return NextResponse.redirect(
      `${origin}/dashboard/settings?error=tiktok_not_allowed_india`,
    );
  }

  const provider = new TikTokProvider();

  // 1. Generate secure random State token to prevent CSRF
  const state = crypto.randomBytes(32).toString("hex");

  // 2. Generate PKCE values - required by TikTok app settings
  const codeVerifier = crypto.randomBytes(32).toString("base64url");

  console.log(
    "[TikTok Auth] Generated code_verifier (first 10):",
    codeVerifier.substring(0, 10),
  );

  const customRedirectUri = provider.getRedirectUri();

  // 3. Create Authorization URL from Provider
  const authorizationUrl = provider.generateAuthUrl(
    state,
    codeVerifier,
    customRedirectUri,
  );

  console.log("[TikTok Auth] Initiating OAuth flow...");
  console.log("[TikTok Auth] Timezone:", tz);
  console.log("[TikTok Auth] Country:", country);
  console.log("[TikTok Auth] Redirect URI:", customRedirectUri);
  console.log("[TikTok Auth] Auth URL:", authorizationUrl);

  // 4. Redirect with secure cookies for validation in Callback
  const response = NextResponse.redirect(authorizationUrl);

  // Store CSRF state with 10 minute expiry
  const isProd = process.env.NODE_ENV === "production";

  response.cookies.set("tiktok_auth_state", state, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  response.cookies.set("tiktok_auth_verifier", codeVerifier, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}