import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { readFile, rm } from "fs/promises";
import { verifyAdminOrBrandDownloadAccess } from "@/lib/video-download-auth";
import {
  clearVideoDownloadJobStatus,
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
  const requestUrl = new URL(request.url);
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

  const jobId = requestUrl.searchParams.get("jobId")?.trim();
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const status = await getVideoDownloadJobStatus(jobId);
  if (!status || status.userId !== access.user.id) {
    return NextResponse.json({ error: "Download job not found" }, { status: 404 });
  }
  if (status.status !== "ready" || (!status.storagePath && !status.localZipPath)) {
    return NextResponse.json(
      { error: "ZIP is not ready yet", status: status.status },
      { status: 409 },
    );
  }

  const requestedName = requestUrl.searchParams.get("filename");
  const shouldStreamDownload = requestUrl.searchParams.get("download") === "1";
  const filename = toBulkZipDownloadFilename(
    requestedName || status.zipFilename || `bulk_submissions_contest`,
  );

  // Serve from local filesystem if available (avoids Supabase size limits)
  if (status.localZipPath && existsSync(status.localZipPath)) {
    if (shouldStreamDownload) {
      const zipBuffer = await readFile(status.localZipPath);
      rm(status.localZipPath, { force: true }).catch(() => {});
      await clearVideoDownloadJobStatus(jobId);
      const headers = new Headers({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
        "Content-Length": String(zipBuffer.byteLength),
      });
      return new NextResponse(zipBuffer, { headers });
    }

    return NextResponse.json({
      url: `/api/admin/bulk-download/file?jobId=${encodeURIComponent(jobId)}&filename=${encodeURIComponent(filename)}&download=1`,
      filename,
      completed: status.completed,
      failed: status.failed,
      total: status.total,
      zipBytes: status.zipBytes ?? null,
    });
  }

  // Fall back to Supabase Storage
  if (!status.storagePath) {
    return NextResponse.json(
      { error: "ZIP file is no longer available. Please retry the download." },
      { status: 410 },
    );
  }

  const supabase = createAdminClient();
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

  if (shouldStreamDownload) {
    const upstream = await fetch(signed.data.signedUrl, {
      cache: "no-store",
    }).catch((error: unknown) => {
      console.error("[bulk-download/file] Failed to fetch signed ZIP:", error);
      return null;
    });

    if (!upstream?.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Could not fetch ZIP download file" },
        { status: 502 },
      );
    }

    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
    });
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    await clearVideoDownloadJobStatus(jobId);
    return new NextResponse(upstream.body, { headers });
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
