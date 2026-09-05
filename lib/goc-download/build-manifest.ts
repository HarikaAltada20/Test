import { randomUUID } from "crypto";
import type { ResolvedBulkDownloadItem } from "@/lib/bulk-download-resolve-items";
import { zipPartFilename } from "@/lib/bulk-download-resolve-items";
import { chunkArray } from "@/lib/video-download-ui";
import { assertSafeWindowsFilename } from "@/lib/goc-download/path-safety";
import { isAllowedYoutubeDownloadUrl } from "@/lib/goc-download/youtube-url";
import { getManifestTtlSeconds } from "@/lib/goc-download/config";
import {
  GOC_DOWNLOAD_MANIFEST_VERSION,
  type GocDownloadUnsignedPayload,
} from "@/lib/goc-download/schemas";

export type BuildDesktopManifestInput = {
  jobId: string;
  userId: string;
  contestId?: string;
  namingPattern: string;
  zipFilenameBase: string;
  videosPerZip: number;
  items: ResolvedBulkDownloadItem[];
  statusUrl: string;
  statusToken: string;
  createdAt?: Date;
  ttlSeconds?: number;
};

export type BuildDesktopManifestResult =
  | { ok: true; payload: GocDownloadUnsignedPayload }
  | { ok: false; error: string };

/**
 * Build an unsigned .gocdownload payload from YouTube-only resolved items.
 * Partitions items into archives using videosPerZip (same chunking as cloud).
 */
export function buildDesktopManifestPayload(
  input: BuildDesktopManifestInput,
): BuildDesktopManifestResult {
  if (input.items.length === 0) {
    return { ok: false, error: "No items to include in desktop manifest" };
  }

  const youtubeItems = input.items.filter((item) => !item.isInstagram);
  if (youtubeItems.length !== input.items.length) {
    return {
      ok: false,
      error:
        "Desktop downloads support YouTube only. Instagram selections must use the cloud download path.",
    };
  }

  for (const item of youtubeItems) {
    if (!isAllowedYoutubeDownloadUrl(item.url)) {
      return {
        ok: false,
        error: `URL is not an allowed YouTube host: ${item.url}`,
      };
    }
    const safe = assertSafeWindowsFilename(item.filename);
    if (!safe.ok) {
      return {
        ok: false,
        error: `Unsafe filename "${item.filename}": ${safe.reason}`,
      };
    }
  }

  const createdAt = input.createdAt ?? new Date();
  const ttl = input.ttlSeconds ?? getManifestTtlSeconds();
  const expiresAt = new Date(createdAt.getTime() + ttl * 1000);

  const chunks = chunkArray(
    youtubeItems,
    Math.max(1, Math.floor(input.videosPerZip) || 1),
  );
  const partTotal = chunks.length;

  const items = youtubeItems.map((item) => ({
    itemId: randomUUID(),
    ...(item.submissionId ? { submissionId: item.submissionId } : {}),
    url: item.url,
    filename: item.filename,
    platform: "youtube" as const,
  }));

  // Rebuild chunks with stable itemIds (same order as youtubeItems).
  let cursor = 0;
  const archives = chunks.map((chunk, index) => {
    const slice = items.slice(cursor, cursor + chunk.length);
    cursor += chunk.length;
    return {
      archiveId: randomUUID(),
      zipFilename: zipPartFilename(
        input.zipFilenameBase,
        index + 1,
        partTotal,
      ),
      itemIds: slice.map((entry) => entry.itemId),
    };
  });

  const payload: GocDownloadUnsignedPayload = {
    version: GOC_DOWNLOAD_MANIFEST_VERSION,
    context: {
      jobId: input.jobId,
      ...(input.contestId ? { contestId: input.contestId } : {}),
      userId: input.userId,
      namingPattern: input.namingPattern,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
    archives,
    items,
    callback: {
      statusUrl: input.statusUrl,
      statusToken: input.statusToken,
    },
  };

  return { ok: true, payload };
}
