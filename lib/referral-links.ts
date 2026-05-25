export type ReferralLinks = {
  general: string;
  creators: string;
  brands: string;
};

/** Same rules as ReferralCapture — URL-safe ref param without over-encoding. */
export function sanitizeReferralCodeForUrl(code: string): string {
  return code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

export function getReferralCode(
  referralCode: string | null | undefined,
  username: string | null | undefined,
): string {
  return sanitizeReferralCodeForUrl(referralCode || username || "");
}

function referralUrl(
  origin: string,
  pathname: string,
  ref: string,
): string {
  const url = new URL(pathname, origin.replace(/\/$/, "/"));
  url.searchParams.set("ref", ref);
  return url.toString();
}

export function buildReferralLinks(
  code: string,
  origin = "https://www.gameofcreators.com",
): ReferralLinks | null {
  const ref = sanitizeReferralCodeForUrl(code);
  if (!ref) return null;

  const base = origin.replace(/\/$/, "");
  return {
    general: referralUrl(base, "/", ref),
    creators: referralUrl(base, "/creators", ref),
    brands: referralUrl(base, "/brands", ref),
  };
}
