/**
 * Exact YouTube host allowlist for desktop v1 manifests.
 * Plan: youtube.com / www / m / youtu.be only.
 */

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

export type YoutubeUrlResult =
  | { ok: true; normalized: string; host: string }
  | { ok: false; reason: string };

export function isAllowedYoutubeHost(host: string): boolean {
  return ALLOWED_HOSTS.has(host.toLowerCase());
}

export function parseAllowedYoutubeUrl(raw: unknown): YoutubeUrlResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, reason: "URL is required" };
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "URL must be http(s)" };
  }
  const host = url.hostname.toLowerCase();
  if (!isAllowedYoutubeHost(host)) {
    return {
      ok: false,
      reason: `Host not allowed for desktop download: ${host}`,
    };
  }
  // Strip hash; keep query (needed for watch?v=)
  url.hash = "";
  return { ok: true, normalized: url.toString(), host };
}

export function isAllowedYoutubeUrl(raw: unknown): boolean {
  return parseAllowedYoutubeUrl(raw).ok;
}

/** Alias used by manifest builders. */
export function isAllowedYoutubeDownloadUrl(raw: unknown): boolean {
  return isAllowedYoutubeUrl(raw);
}
