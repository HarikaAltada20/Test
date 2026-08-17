/** Pause between videos in a bulk ZIP so Instagram/YouTube are less likely to throttle. */
export const BULK_DOWNLOAD_ITEM_GAP_MS = 550;

/** Extra retries after the first attempt for transient IG/YT failures. */
export const BULK_DOWNLOAD_MAX_RETRIES = 2;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableDownloadError(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();

  if (
    message.includes("not a video") ||
    message.includes("private") ||
    message.includes("restricted") ||
    message.includes("not subscribed") ||
    message.includes("not configured") ||
    message.includes("missing rapidapi") ||
    message.includes("could not be found") ||
    message.includes("could not be downloaded") ||
    message.includes("no files could be downloaded") ||
    message.includes("deleted") ||
    message.includes("unavailable")
  ) {
    return false;
  }

  return (
    message.includes("too many") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("temporarily") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("fetch failed") ||
    message.includes("cdn") ||
    message.includes("empty") ||
    message.includes("403") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("soft-block") ||
    message.includes("try again")
  );
}

export async function withDownloadRetries<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    isRetryable?: (error: unknown) => boolean;
  },
): Promise<T> {
  const maxRetries = options?.maxRetries ?? BULK_DOWNLOAD_MAX_RETRIES;
  const isRetryable = options?.isRetryable ?? isRetryableDownloadError;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }
      await sleep(400 * (attempt + 1));
    }
  }
  throw lastError;
}

/**
 * Process downloads one at a time with a gap between items.
 * Keeps IG/YT bulk jobs stable instead of firing every request at once.
 */
export async function processSequentialDownloadQueue<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  options?: { gapMs?: number },
): Promise<void> {
  const gapMs = options?.gapMs ?? BULK_DOWNLOAD_ITEM_GAP_MS;
  for (let i = 0; i < items.length; i++) {
    await worker(items[i], i);
    if (i < items.length - 1 && gapMs > 0) {
      await sleep(gapMs);
    }
  }
}
