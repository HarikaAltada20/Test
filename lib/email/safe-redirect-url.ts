/** Allow only http(s) redirect targets from email click tracking. */
export function resolveSafeRedirectUrl(
  rawUrl: string | null | undefined,
  fallbackUrl: string,
): string {
  if (!rawUrl?.trim()) return fallbackUrl;

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawUrl.trim());
  } catch {
    return fallbackUrl;
  }

  try {
    const parsed = new URL(decoded);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fallbackUrl;
    }
    return parsed.toString();
  } catch {
    return fallbackUrl;
  }
}
