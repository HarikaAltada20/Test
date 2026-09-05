import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  getBulkVideoDownloadJobById,
  updateBulkVideoDownloadJob,
  type BulkVideoDownloadItemStatus,
  type BulkVideoDownloadJobStatus,
} from "@/lib/bulk-video-download-jobs";
import {
  desktopStatusEventSchema,
  type DesktopStatusEvent,
  type DesktopStatusEventType,
} from "@/lib/goc-download/schemas";
import {
  extractBearerToken,
  verifyDesktopStatusToken,
} from "@/lib/goc-download/status-token";

export const dynamic = "force-dynamic";

const TERMINAL_JOB: ReadonlySet<BulkVideoDownloadJobStatus> = new Set([
  "completed",
  "failed",
]);

function nextJobStatus(
  current: BulkVideoDownloadJobStatus,
  eventType: DesktopStatusEventType,
): BulkVideoDownloadJobStatus | undefined {
  if (TERMINAL_JOB.has(current)) return undefined;
  switch (eventType) {
    case "accepted":
      return current === "queued" ? "queued" : undefined;
    case "started":
      return "running";
    case "job_completed":
      return "completed";
    case "job_failed":
      return "failed";
    default:
      return undefined;
  }
}

async function recordDesktopEvent(options: {
  eventId: string;
  jobId: string;
  eventType: string;
  payload: DesktopStatusEvent;
}): Promise<{ inserted: boolean; error?: string }> {
  const admin = createAdminClient();
  const { error } = await admin.from("bulk_video_download_desktop_events").insert({
    id: options.eventId,
    job_id: options.jobId,
    event_type: options.eventType,
    payload: options.payload,
  });

  if (!error) return { inserted: true };

  // Unique violation => already processed (idempotent success).
  if (
    error.code === "23505" ||
    /duplicate|unique/i.test(error.message || "")
  ) {
    return { inserted: false };
  }

  // Table missing (migration not applied): still allow job updates.
  if (/does not exist|relation/i.test(error.message || "")) {
    console.warn(
      "[desktop-status] desktop_events table missing; continuing without event idempotency store",
    );
    return { inserted: true };
  }

  console.error("[desktop-status] event insert failed:", error);
  return { inserted: false, error: error.message };
}

export async function POST(request: Request) {
  const bearer = extractBearerToken(request.headers.get("authorization"));
  if (!bearer) {
    return NextResponse.json(
      { error: "Authorization Bearer status token required" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = desktopStatusEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid status event payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const event = parsed.data;

  // Never accept media bytes — reject oversized / unexpected binary fields.
  if (
    body &&
    typeof body === "object" &&
    ("media" in body ||
      "bytes" in body ||
      "file" in body ||
      "contentBase64" in body)
  ) {
    return NextResponse.json(
      { error: "Media payloads are not accepted on the status endpoint" },
      { status: 400 },
    );
  }

  const tokenCheck = verifyDesktopStatusToken(bearer, {
    expectedJobId: event.jobId,
  });
  if (!tokenCheck.ok) {
    return NextResponse.json(
      { error: `Invalid status token: ${tokenCheck.reason}` },
      { status: 401 },
    );
  }

  const { data: job, error: jobError } = await getBulkVideoDownloadJobById({
    id: event.jobId,
  });
  if (jobError) {
    return NextResponse.json({ error: jobError }, { status: 500 });
  }
  if (!job || job.user_id !== tokenCheck.claims.userId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const recorded = await recordDesktopEvent({
    eventId: event.eventId,
    jobId: event.jobId,
    eventType: event.eventType,
    payload: event,
  });
  if (recorded.error) {
    return NextResponse.json({ error: recorded.error }, { status: 500 });
  }
  if (!recorded.inserted) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const itemStatuses: BulkVideoDownloadItemStatus[] = [];
  if (
    (event.eventType === "item_completed" ||
      event.eventType === "item_failed") &&
    event.submissionId
  ) {
    itemStatuses.push({
      submissionId: event.submissionId,
      status: event.eventType === "item_completed" ? "success" : "failed",
      error: event.error,
    });
  }

  const statusPatch = nextJobStatus(job.status, event.eventType);
  const patch: {
    id: string;
    userId: string;
    status?: BulkVideoDownloadJobStatus;
    successCount?: number;
    failedCount?: number;
    zipPartIndex?: number;
    itemStatuses?: BulkVideoDownloadItemStatus[];
    errorMessage?: string | null;
  } = {
    id: job.id,
    userId: job.user_id,
  };

  // Do not regress terminal job states.
  if (statusPatch && !TERMINAL_JOB.has(job.status)) {
    patch.status = statusPatch;
  } else if (
    !TERMINAL_JOB.has(job.status) &&
    (event.eventType === "item_completed" ||
      event.eventType === "item_failed" ||
      event.eventType === "archive_completed")
  ) {
    patch.status = "running";
  }

  if (typeof event.successCount === "number") {
    patch.successCount = Math.max(job.success_count, event.successCount);
  }
  if (typeof event.failedCount === "number") {
    patch.failedCount = Math.max(job.failed_count, event.failedCount);
  }
  if (typeof event.zipPartIndex === "number") {
    patch.zipPartIndex = Math.max(job.zip_part_index, event.zipPartIndex);
  }
  if (itemStatuses.length > 0) {
    patch.itemStatuses = itemStatuses;
  }
  if (event.eventType === "job_failed" && event.error) {
    patch.errorMessage = event.error;
  }

  const updated = await updateBulkVideoDownloadJob(patch);
  if (updated.error) {
    return NextResponse.json({ error: updated.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    status: updated.data?.status ?? job.status,
  });
}
