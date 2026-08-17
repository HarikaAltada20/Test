import { NextResponse } from "next/server";
import { verifyAdminOrBrandDownloadAccess } from "@/lib/video-download-auth";
import {
  getVideoDownloadJobStatus,
  isVideoDownloadQueueEnabled,
  VIDEO_DOWNLOAD_STORAGE_BUCKET,
  clearVideoDownloadJobStatus,
} from "@/lib/queue/video-download-queue";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const downloaded = await supabase.storage
    .from(VIDEO_DOWNLOAD_STORAGE_BUCKET)
    .download(status.storagePath);

  if (downloaded.error || !downloaded.data) {
    return NextResponse.json(
      { error: downloaded.error?.message || "Failed to read ZIP archive" },
      { status: 500 },
    );
  }

  const zipBuffer = Buffer.from(await downloaded.data.arrayBuffer());
  void supabase.storage
    .from(VIDEO_DOWNLOAD_STORAGE_BUCKET)
    .remove([status.storagePath])
    .catch(() => {});
  await clearVideoDownloadJobStatus(jobId);

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="bulk_download_${jobId.slice(0, 8)}.zip"`,
      "Content-Length": String(zipBuffer.byteLength),
      "Cache-Control": "no-cache",
      "X-Bulk-Downloaded": String(status.completed),
      "X-Bulk-Failed": String(status.failed),
    },
  });
}
