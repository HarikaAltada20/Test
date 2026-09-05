/**
 * Feature flags and env config for Game of Creators Desktop Downloader.
 */

const DEFAULT_MANIFEST_TTL_SECONDS = 3600;

export function isDesktopDownloadEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_ENABLED === "true";
}

export function isCloudDownloadFallbackEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLOUD_DOWNLOAD_FALLBACK_ENABLED !== "false";
}

export function getDesktopDownloaderInstallUrl(): string | null {
  const url = (process.env.NEXT_PUBLIC_GOC_DOWNLOADER_INSTALL_URL || "").trim();
  return url || null;
}

export function getManifestTtlSeconds(): number {
  const raw = Number(process.env.GOC_DOWNLOAD_MANIFEST_TTL_SECONDS);
  if (!Number.isFinite(raw) || raw < 60 || raw > 7 * 24 * 3600) {
    return DEFAULT_MANIFEST_TTL_SECONDS;
  }
  return Math.floor(raw);
}

export function getDesktopDeepLinkImportUrl(): string {
  return "goc-downloader://import";
}
