import { after } from "next/server";
import {
  getQStashPublishBaseUrl,
  isLoopbackUrl,
  isQStashEnabled,
  resolveLocalAwareBaseUrl,
  triggerProcessBulkVerifyQueue,
} from "@/lib/qstash";

/**
 * Keep the bulk-moderation worker alive while the client polls (esp. local/dev
 * where QStash cannot reach localhost). Safe no-op when the queue is empty or
 * already processing.
 */
export async function kickProcessBulkVerifyQueue(
  request: Request,
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
    fetch(`${localUrl}/api/cron/process-bulk-verify-queue`, {
      method: "POST",
      headers,
      body: "{}",
    }).catch((e) =>
      console.error("[bulk-verify-queue] Direct processor trigger failed:", e),
    );

  const runFallbackAfterResponse = () => {
    try {
      after(fallback);
    } catch {
      void fallback();
    }
  };

  if (isQStashEnabled() && !isLoopbackUrl(qstashUrl)) {
    const res = await triggerProcessBulkVerifyQueue(qstashUrl);
    if (res?.error) runFallbackAfterResponse();
    return;
  }

  runFallbackAfterResponse();
}
