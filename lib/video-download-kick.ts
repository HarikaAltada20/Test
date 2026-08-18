import { after } from "next/server";
import {
  getQStashPublishBaseUrl,
  isLoopbackUrl,
  isQStashEnabled,
  resolveLocalAwareBaseUrl,
  triggerProcessVideoDownloadQueue,
} from "@/lib/qstash";

/**
 * Publish a QStash message (awaited) so the job is not left stranded if the
 * lambda freezes after the HTTP response. Direct fetch is only a fallback and
 * must not be awaited — that would block until the next 5-minute job finishes.
 */
export async function kickProcessVideoDownloadQueue(
  request: Request,
  options?: { delaySeconds?: number },
): Promise<void> {
  const qstashUrl = getQStashPublishBaseUrl(request);
  const localUrl = resolveLocalAwareBaseUrl(request);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.CRON_SECRET) {
    headers.Authorization = `Bearer ${process.env.CRON_SECRET}`;
  }

  const fallback = () =>
    fetch(`${localUrl}/api/cron/process-video-download-queue`, {
      method: "POST",
      headers,
      body: "{}",
    }).catch((e) =>
      console.error("[video-download-queue] Direct processor trigger failed:", e),
    );

  const runFallbackAfterResponse = () => {
    try {
      after(fallback);
    } catch {
      void fallback();
    }
  };

  if (isQStashEnabled() && !isLoopbackUrl(qstashUrl)) {
    const res = await triggerProcessVideoDownloadQueue(qstashUrl, options);
    if (res?.error) runFallbackAfterResponse();
    return;
  }

  runFallbackAfterResponse();
}
