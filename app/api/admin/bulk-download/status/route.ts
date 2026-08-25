import { NextResponse } from "next/server";
import { verifyAdminOrBrandDownloadAccess } from "@/lib/video-download-auth";
import {
  clearVideoDownloadJobStatus,
  getVideoDownloadJobStatus,
  isVideoDownloadQueueEnabled,
} from "@/lib/queue/video-download-queue";
import { kickProcessVideoDownloadQueue } from "@/lib/video-download-kick";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await verifyAdminOrBrandDownloadAccess();
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error || "Admin or brand access required" },
      { status: 403 },
    );
  }

  if (!isVideoDownloadQueueEnabled()) {
    return NextResponse.json(
      { error: "Video download queue is not configured" },
      { status: 503 },
    );
  }

  const jobId = new URL(request.url).searchParams.get("jobId")?.trim();
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const status = await getVideoDownloadJobStatus(jobId);
  if (!status || status.userId !== access.user.id) {
    return NextResponse.json({ error: "Download job not found" }, { status: 404 });
  }

  // Keep the worker alive while the client polls (esp. local/dev where QStash
  // cannot reach localhost). Safe no-op when already processing.
  if (status.status === "queued" || status.status === "processing") {
    void kickProcessVideoDownloadQueue(request);
  }

  const payload = {
    jobId: status.jobId,
    status: status.status,
    total: status.total,
    completed: status.completed,
    failed: status.failed,
    errors: status.errors.slice(0, 5),
    itemFailures: (status.itemFailures ?? []).slice(0, 100),
    zipBytes: status.zipBytes ?? null,
  };

  // Failed jobs have no ZIP to fetch — drop Redis status after the client sees it.
  if (status.status === "failed") {
    void clearVideoDownloadJobStatus(jobId);
  }

  return NextResponse.json(payload);
}
