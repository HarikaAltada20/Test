/**
 * Desktop status event idempotency (duplicate eventId + payload check).
 * Used only by the desktop-status API so retries are safe.
 */

import { createAdminClient } from "@/utils/supabase/admin";
import type { DesktopStatusEvent } from "@/lib/goc-download/schemas";

export type RecordDesktopEventOutcome =
  | "inserted"
  | "duplicate_ok"
  | "duplicate_mismatch"
  | "store_unavailable";

/** Stable canonical JSON for duplicate-payload comparison. */
export function canonicalizeDesktopEventPayload(
  event: DesktopStatusEvent | Record<string, unknown>,
): string {
  const src = event as Record<string, unknown>;
  const error =
    typeof src.error === "string"
      ? src.error
      : typeof src.errorMessage === "string"
        ? src.errorMessage
        : undefined;
  const normalized: Record<string, unknown> = {
    eventId: src.eventId,
    eventType: src.eventType,
    jobId: src.jobId,
  };
  if (typeof src.itemId === "string") normalized.itemId = src.itemId;
  if (typeof src.archiveId === "string") normalized.archiveId = src.archiveId;
  if (typeof src.submissionId === "string") {
    normalized.submissionId = src.submissionId;
  }
  if (error) normalized.error = error;
  if (typeof src.occurredAt === "string") normalized.occurredAt = src.occurredAt;
  if (typeof src.successCount === "number") {
    normalized.successCount = src.successCount;
  }
  if (typeof src.failedCount === "number") {
    normalized.failedCount = src.failedCount;
  }
  if (typeof src.totalCount === "number") {
    normalized.totalCount = src.totalCount;
  }
  if (typeof src.zipPartIndex === "number") {
    normalized.zipPartIndex = src.zipPartIndex;
  }
  if (typeof src.zipFilename === "string") {
    normalized.zipFilename = src.zipFilename;
  }
  if (src.meta && typeof src.meta === "object") {
    normalized.meta = src.meta;
  }
  return JSON.stringify(normalized);
}

export async function recordDesktopStatusEvent(options: {
  eventId: string;
  jobId: string;
  eventType: string;
  payload: DesktopStatusEvent;
}): Promise<{
  outcome: RecordDesktopEventOutcome;
  error?: string;
}> {
  const admin = createAdminClient();
  const { error } = await admin.from("bulk_video_download_desktop_events").insert({
    id: options.eventId,
    job_id: options.jobId,
    event_type: options.eventType,
    payload: options.payload,
  });

  if (!error) return { outcome: "inserted" };

  if (/does not exist|relation/i.test(error.message || "")) {
    console.warn(
      "[desktop-event-store] desktop_events table missing; continuing without event store",
    );
    return { outcome: "store_unavailable" };
  }

  const isDuplicate =
    error.code === "23505" || /duplicate|unique/i.test(error.message || "");
  if (!isDuplicate) {
    console.error("[desktop-event-store] event insert failed:", error);
    return { outcome: "inserted", error: error.message };
  }

  const { data: existing, error: readError } = await admin
    .from("bulk_video_download_desktop_events")
    .select("payload")
    .eq("id", options.eventId)
    .maybeSingle();

  if (readError) {
    console.error("[desktop-event-store] duplicate read failed:", readError);
    return { outcome: "inserted", error: readError.message };
  }

  if (!existing) {
    return { outcome: "duplicate_ok" };
  }

  const stored = canonicalizeDesktopEventPayload(
    (existing.payload || {}) as Record<string, unknown>,
  );
  const incoming = canonicalizeDesktopEventPayload(options.payload);
  if (stored === incoming) {
    return { outcome: "duplicate_ok" };
  }
  return { outcome: "duplicate_mismatch" };
}
