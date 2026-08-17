import { NextResponse } from "next/server";
import { verifyAdminOrBrandDownloadAccess } from "@/lib/video-download-auth";
import {
  clearVideoDownloadJobStatus,
  getVideoDownloadJobStatus,
  isVideoDownloadQueueEnabled,
} from "@/lib/queue/video-download-queue";

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

  const payload = {
    jobId: status.jobId,
    status: status.status,
    total: status.total,
    completed: status.completed,
    failed: status.failed,
    errors: status.errors.slice(0, 5),
    zipBytes: status.zipBytes ?? null,
  };

  if (status.status === "failed") {
    await clearVideoDownloadJobStatus(jobId);
  }

  return NextResponse.json(payload);
}
