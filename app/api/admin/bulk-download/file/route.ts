import { NextResponse } from "next/server";
import { verifyAdminOrBrandDownloadAccess } from "@/lib/video-download-auth";
import {
  getVideoDownloadJobStatus,
  isVideoDownloadQueueEnabled,
  VIDEO_DOWNLOAD_STORAGE_BUCKET,
} from "@/lib/queue/video-download-queue";
import { toBulkZipDownloadFilename } from "@/lib/video-download-filename";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SIGNED_URL_TTL_SECONDS = 10 * 60;

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
  if (status.status !== "ready" || !status.storagePath) {
    return NextResponse.json(
      { error: "ZIP is not ready yet", status: status.status },
      { status: 409 },
    );
  }

  const supabase = createAdminClient();
  const requestedName = new URL(request.url).searchParams.get("filename");
  const filename = toBulkZipDownloadFilename(
    requestedName || status.zipFilename || `bulk_submissions_contest`,
  );
  const signed = await supabase.storage
    .from(VIDEO_DOWNLOAD_STORAGE_BUCKET)
    .createSignedUrl(status.storagePath, SIGNED_URL_TTL_SECONDS, {
      download: filename,
    });

  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      { error: signed.error?.message || "Could not create ZIP download URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: signed.data.signedUrl,
    filename,
    completed: status.completed,
    failed: status.failed,
    total: status.total,
    zipBytes: status.zipBytes ?? null,
  });
}
