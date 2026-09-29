import { NextRequest, NextResponse } from "next/server";
import { setOAuthReturnToCookie } from "@/lib/oauth-return-to";

export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo");
  const instagramClientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(
    /\/$/,
    "",
  );

  const settingsUrl = new URL("/dashboard/settings", request.url);

  if (!instagramClientId) {
    settingsUrl.searchParams.set("error", "instagram_config_missing");
    return NextResponse.redirect(settingsUrl);
  }

  const instagramRedirectUri = `${appBaseUrl}/api/instagram/callback`;
  const scopes = [
    "instagram_business_basic",
    "instagram_business_manage_insights",
  ].join(",");

  const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${instagramClientId}&redirect_uri=${encodeURIComponent(
    instagramRedirectUri,
  )}&response_type=code&scope=${encodeURIComponent(scopes)}&force_reauth=true`;

  const response = NextResponse.redirect(authUrl);
  setOAuthReturnToCookie(response, returnTo);

  return response;
}
