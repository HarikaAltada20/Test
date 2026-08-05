/** Max videos per bulk ZIP request (must match server `MAX_BULK_VIDEO_DOWNLOADS`). */
export const MAX_BULK_VIDEO_DOWNLOADS = 10;

/** Pause between ZIP downloads so browsers allow multiple automatic downloads. */
const BULK_CHUNK_DOWNLOAD_GAP_MS = 700;

/**
 * Client/server helper: whether a submission can be downloaded as IG/YT video.
 */
export function canDownloadSubmissionVideo(input: {
  platform?: string | null;
  contestPlatform?: string | null;
  contentLink?: string | null;
}): boolean {
  const platform = (input.platform || input.contestPlatform || "").toLowerCase();
  const link = input.contentLink || "";

  if (platform.includes("tiktok")) return false;

  const isInstagram =
    platform.includes("instagram") || link.includes("instagram.com");
  const isYouTube =
    platform.includes("youtube") ||
    link.includes("youtube.com") ||
    /youtu\.?be/i.test(link);

  return isInstagram || isYouTube;
}

export function canBulkDownloadContestVideos(contestPlatform?: string | null): boolean {
  const platform = (contestPlatform || "").toLowerCase();
  if (platform.includes("tiktok")) return false;
  return platform.includes("instagram") || platform.includes("youtube");
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ChunkedBulkDownloadResult = {
  totalVideos: number;
  totalChunks: number;
  succeededChunks: number;
  failedChunks: number;
  errors: string[];
};

/**
 * Downloads many submissions by requesting server ZIP chunks of at most
 * MAX_BULK_VIDEO_DOWNLOADS, sequentially, until all selected IDs are processed.
 */
export async function downloadSubmissionVideosInChunks(options: {
  submissionIds: string[];
  fileNamePrefix: string;
  chunkSize?: number;
  onProgress?: (info: {
    chunkIndex: number;
    totalChunks: number;
    chunkSize: number;
    totalVideos: number;
  }) => void;
}): Promise<ChunkedBulkDownloadResult> {
  const chunkSize = options.chunkSize ?? MAX_BULK_VIDEO_DOWNLOADS;
  const ids = options.submissionIds.filter(Boolean);
  const chunks = chunkArray(ids, chunkSize);
  const errors: string[] = [];
  let succeededChunks = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    options.onProgress?.({
      chunkIndex: i + 1,
      totalChunks: chunks.length,
      chunkSize: chunk.length,
      totalVideos: ids.length,
    });

    try {
      const response = await fetch("/api/admin/bulk-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionIds: chunk }),
      });

      const contentType = response.headers.get("content-type");
      if (!response.ok || contentType?.includes("application/json")) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to download ZIP archive (batch ${i + 1}).`,
        );
      }

      const blob = await response.blob();
      const partSuffix =
        chunks.length > 1 ? `_part_${i + 1}_of_${chunks.length}` : "";
      triggerBrowserDownload(
        blob,
        `${options.fileNamePrefix}${partSuffix}_${Date.now()}.zip`,
      );
      succeededChunks += 1;

      // Give the browser time to accept the next automatic download.
      if (i < chunks.length - 1) {
        await sleep(BULK_CHUNK_DOWNLOAD_GAP_MS);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : `Batch ${i + 1} failed`;
      errors.push(message);
    }
  }

  return {
    totalVideos: ids.length,
    totalChunks: chunks.length,
    succeededChunks,
    failedChunks: chunks.length - succeededChunks,
    errors,
  };
}
