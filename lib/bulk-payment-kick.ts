import { after } from "next/server";
import {
  ensureProcessBulkPaymentQueueScheduleOnce,
  getQStashPublishBaseUrl,
  isLoopbackUrl,
  isQStashEnabled,
  resolveLocalAwareBaseUrl,
  triggerProcessBulkPaymentQueue,
} from "@/lib/qstash";

/**
 * Keep the bulk-payment worker alive while the client polls (esp. local/dev
 * where QStash cannot reach localhost). Safe no-op when the queue is empty or
 * already processing.
 */
export async function kickProcessBulkPaymentQueue(
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
    fetch(`${localUrl}/api/cron/process-bulk-payment-queue`, {
      method: "POST",
      headers,
      body: "{}",
    }).catch((e) =>
      console.error("[bulk-payment-queue] Direct processor trigger failed:", e),
    );

  const runFallbackAfterResponse = () => {
    try {
      after(fallback);
    } catch {
      void fallback();
    }
  };

  if (isQStashEnabled() && !isLoopbackUrl(qstashUrl)) {
    ensureProcessBulkPaymentQueueScheduleOnce(qstashUrl);
    const res = await triggerProcessBulkPaymentQueue(qstashUrl);
    if (res?.error) runFallbackAfterResponse();
    return;
  }

  runFallbackAfterResponse();
}
