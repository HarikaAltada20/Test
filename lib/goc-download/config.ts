/**
 * Feature flags and env config for Game of Creators Desktop Downloader.
 */

const DEFAULT_MANIFEST_TTL_SECONDS = 3600;
/** Status callback tokens must outlive long desktop jobs (default 7 days). */
const DEFAULT_STATUS_TOKEN_TTL_SECONDS = 7 * 24 * 3600;

/**
 * Public Windows x64 installer (Game.of.Creators.Downloader_0.1.0_x64-setup.exe).
 * Hosted on Drive so "Get the desktop app" downloads without opening GitHub.
 */
export const GOC_DOWNLOADER_INSTALL_URL =
  "https://drive.google.com/uc?export=download&id=1Jua2DZaZav2CZsUGxIIfFLNICxG3zPmm";

export function isDesktopDownloadEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_ENABLED === "true";
}

/**
 * Server-side kill switch for desktop manifest APIs.
 * Defaults to the public UI flag; set GOC_DOWNLOAD_DESKTOP_API_ENABLED=false to
 * disable API creation even if the client still has an old bundle.
 */
export function isDesktopDownloadApiEnabled(): boolean {
  const override = (process.env.GOC_DOWNLOAD_DESKTOP_API_ENABLED || "").trim();
  if (override === "false") return false;
  if (override === "true") return true;
  return isDesktopDownloadEnabled();
}

export function isCloudDownloadFallbackEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLOUD_DOWNLOAD_FALLBACK_ENABLED !== "false";
}

export function getDesktopDownloaderInstallUrl(): string {
  return GOC_DOWNLOADER_INSTALL_URL;
}

export function getManifestTtlSeconds(): number {
  const raw = Number(process.env.GOC_DOWNLOAD_MANIFEST_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw < 60 || raw > 7 * 24 * 3600) {
    return DEFAULT_MANIFEST_TTL_SECONDS;
  }
  return Math.floor(raw);
}

/** Lifetime for desktop status HMAC tokens (independent of manifest open expiry). */
export function getDesktopStatusTokenTtlSeconds(): number {
  const raw = Number(process.env.GOC_DOWNLOAD_STATUS_TOKEN_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw < 3600 || raw > 30 * 24 * 3600) {
    return DEFAULT_STATUS_TOKEN_TTL_SECONDS;
  }
  return Math.floor(raw);
}

export function getDesktopDeepLinkImportUrl(): string {
  return "goc-downloader://import";
}
