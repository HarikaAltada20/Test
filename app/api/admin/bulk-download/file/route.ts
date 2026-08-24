import { createReadStream, existsSync } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { verifyAdminOrBrandDownloadAccess } from "@/lib/video-download-auth";
import {
  getVideoDownloadJobStatus,
  isVideoDownloadQueueEnabled,
  VIDEO_DOWNLOAD_STORAGE_BUCKET,
} from "@/lib/queue/video-download-queue";
import { toBulkZipDownloadFilename } from "@/lib/video-download-filename";
import { videoDownloadLocalZipPath } from "@/lib/video-download-storage";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SIGNED_URL_TTL_SECONDS = 10 * 60;

function zipDownloadHeaders(filename: string, contentLength?: number): Headers {
  const safe = filename.replace(/["\\]/g, "_");
  const headers = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (contentLength != null) headers.set("Content-Length", String(contentLength));
  return headers;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const proxy = requestUrl.searchParams.get("proxy") === "1";
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
  if (status.status !== "ready" || !status.storagePath) {
    return NextResponse.json(
      { error: "ZIP is not ready yet", status: status.status },
      { status: 409 },
    );
  }

  const requestedName = requestUrl.searchParams.get("filename");
  const filename = toBulkZipDownloadFilename(
    requestedName || status.zipFilename || `bulk_submissions_contest`,
  );

  const localPath = videoDownloadLocalZipPath(status.storagePath);
  if (existsSync(localPath)) {
    const zipStat = await stat(localPath);
    const nodeStream = createReadStream(localPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    return new NextResponse(webStream, {
      headers: zipDownloadHeaders(filename, zipStat.size),
    });
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

  if (proxy) {
    const upstream = await fetch(signed.data.signedUrl);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Could not fetch ZIP archive" },
        { status: 502 },
      );
    }
    const headers = zipDownloadHeaders(filename);
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    return new NextResponse(upstream.body, { headers });
  }

  // Leave Redis status and the storage object in place so a dropped browser
  // download can retry. Status expires via VIDEO_DOWNLOAD_JOB_TTL_SECONDS;
  // the ZIP is deleted by the process-video-download-queue cron cleanup.
  return NextResponse.json({
    url: signed.data.signedUrl,
    filename,
    completed: status.completed,
    failed: status.failed,
    total: status.total,
    zipBytes: status.zipBytes ?? null,
  });
}
