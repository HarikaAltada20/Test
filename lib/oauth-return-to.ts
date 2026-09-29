import { NextResponse } from "next/server";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export const OAUTH_RETURN_TO_COOKIE = "oauth_return_to";

const SUBMIT_PATH_PATTERN = /^\/dashboard\/opportunities\/[^/]+\/submit$/;

/** Path to return to after connecting an account from a contest submit page. */
export function getContestSubmitReturnPath(
  contestId: string,
  platform?: string | null,
): string {
  const base = `/dashboard/opportunities/${contestId}/submit`;
  if (platform) {
    return `${base}?platform=${encodeURIComponent(platform)}`;
  }
  return base;
}

/** Settings URL that preserves the post-OAuth return destination. */
export function getSettingsUrlWithReturnTo(returnPath: string): string {
  return `/dashboard/settings?returnTo=${encodeURIComponent(returnPath)}`;
}

/** Only allow relative submit-page paths (prevents open redirects). */
export function getSafeReturnTo(
  returnTo: string | null | undefined,
): string | null {
  if (!returnTo || typeof returnTo !== "string") return null;

  const trimmed = returnTo.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;

  let pathname: string;
  try {
    pathname = new URL(trimmed, "http://localhost").pathname;
  } catch {
    return null;
  }

  if (!SUBMIT_PATH_PATTERN.test(pathname)) return null;

  return trimmed;
}

export function setOAuthReturnToCookie(
  response: NextResponse,
  returnTo: string | null | undefined,
): void {
  const safe = getSafeReturnTo(returnTo);
  if (!safe) return;

  response.cookies.set(OAUTH_RETURN_TO_COOKIE, safe, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 15,
  });
}

export function readOAuthReturnToCookie(
  cookieStore: ReadonlyRequestCookies,
): string | null {
  const raw = cookieStore.get(OAUTH_RETURN_TO_COOKIE)?.value;
  return getSafeReturnTo(raw);
}

export function clearOAuthReturnToCookie(response: NextResponse): void {
  response.cookies.set({
    name: OAUTH_RETURN_TO_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
  });
}

type PostOAuthParams = {
  success?: string;
  error?: string;
  message?: string;
  platform?: string;
};

/** Success → submit page when returnTo is set; errors keep returnTo on settings. */
export function buildPostOAuthRedirectUrl(
  origin: string,
  returnTo: string | null,
  params: PostOAuthParams,
): string {
  const safeReturnTo = getSafeReturnTo(returnTo);
  const base = origin.replace(/\/$/, "");

  if (safeReturnTo && params.success && !params.error) {
    return `${base}${safeReturnTo}`;
  }

  const url = new URL("/dashboard/settings", base);
  if (safeReturnTo) {
    url.searchParams.set("returnTo", safeReturnTo);
  }
  if (params.success) url.searchParams.set("success", params.success);
  if (params.platform) url.searchParams.set("platform", params.platform);
  if (params.error) url.searchParams.set("error", params.error);
  if (params.message) url.searchParams.set("message", params.message);

  return url.toString();
}
