export type ReferralLinks = {
  general: string;
  creators: string;
  brands: string;
};

export function getReferralCode(
  referralCode: string | null | undefined,
  username: string | null | undefined,
): string {
  return (referralCode || username || "").trim();
}

export function buildReferralLinks(
  code: string,
  origin = "https://www.gameofcreators.com",
): ReferralLinks {
  const base = origin.replace(/\/$/, "");
  const encoded = encodeURIComponent(code);
  return {
    general: `${base}/?ref=${encoded}`,
    creators: `${base}/creators?ref=${encoded}`,
    brands: `${base}/brands?ref=${encoded}`,
  };
}
