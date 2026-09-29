import { createReadStream, existsSync } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { verifyAdminOrBrandDownloadAccess } from "@/lib/video-download-auth";
import {
  clearVideoDownloadJobStatus,
  getVideoDownloadJobStatus,
  isVideoDownloadQueueEnabled,
  VIDEO_DOWNLOAD_STORAGE_BUCKET,
  videoDownloadStoragePath,
} from "@/lib/queue/video-download-queue";
import { toBulkZipDownloadFilename } from "@/lib/video-download-filename";
import { videoDownloadLocalZipPath } from "@/lib/video-download-storage";
import { createAdminClient } from "@/utils/supabase/admin";
import { findBulkVideoDownloadJobByZipPartId } from "@/lib/bulk-video-download-jobs";
import {
  isAdminDownloadUser,
  type DownloadAccessUser,
} from "@/lib/video-download-auth";

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
  if (contentLength != null)
    headers.set("Content-Length", String(contentLength));
  return headers;
}

async function resolveStoragePathAndFilename(options: {
  jobId: string;
  user: DownloadAccessUser;
  requestedName: string | null;
}): Promise<
  | { ok: true; storagePath: string; filename: string; clearJobId?: string }
  | { ok: false; response: NextResponse }
> {
  const isAdmin = isAdminDownloadUser(options.user);
  const status = await getVideoDownloadJobStatus(options.jobId);

  if (status) {
    if (status.userId !== options.user.id && !isAdmin) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Download job not found" },
          { status: 404 },
        ),
      };
    }
    if (status.status !== "ready" || !status.storagePath) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "ZIP is not ready yet", status: status.status },
          { status: 409 },
        ),
      };
    }
    return {
      ok: true,
      storagePath: status.storagePath,
      filename: toBulkZipDownloadFilename(
        options.requestedName ||
          status.zipFilename ||
          `bulk_submissions_contest`,
      ),
      clearJobId: options.jobId,
    };
  }

  const { data: job } = await findBulkVideoDownloadJobByZipPartId({
    jobId: options.jobId,
  });
  if (job && job.user_id !== options.user.id && !isAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Download job not found" },
        { status: 404 },
      ),
    };
  }
  const storageOwnerId = job?.user_id || options.user.id;
  const storagePath = videoDownloadStoragePath(storageOwnerId, options.jobId);
  const filename = toBulkZipDownloadFilename(
    options.requestedName || `bulk_submissions_contest`,
  );
  const localPath = videoDownloadLocalZipPath(storagePath);
  if (!existsSync(localPath)) {
    const supabase = createAdminClient();
    const probe = await supabase.storage
      .from(VIDEO_DOWNLOAD_STORAGE_BUCKET)
      .createSignedUrl(storagePath, 60);
    if (probe.error || !probe.data?.signedUrl) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Download job not found" },
          { status: 404 },
        ),
      };
    }
  }

  return { ok: true, storagePath, filename };
}

async function streamZipResponse(options: {
  storagePath: string;
  filename: string;
  proxy: boolean;
  clearJobId?: string;
}): Promise<NextResponse> {
  const localPath = videoDownloadLocalZipPath(options.storagePath);
  if (existsSync(localPath)) {
    const zipStat = await stat(localPath);
    const nodeStream = createReadStream(localPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    if (options.clearJobId) {
      void clearVideoDownloadJobStatus(options.clearJobId);
    }
    return new NextResponse(webStream, {
      headers: zipDownloadHeaders(options.filename, zipStat.size),
    });
  }

  const supabase = createAdminClient();
  const signed = await supabase.storage
    .from(VIDEO_DOWNLOAD_STORAGE_BUCKET)
    .createSignedUrl(options.storagePath, SIGNED_URL_TTL_SECONDS, {
      download: options.filename,
    });

  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      { error: signed.error?.message || "Could not create ZIP download URL" },
      { status: 500 },
    );
  }

  if (options.proxy) {
    const upstream = await fetch(signed.data.signedUrl);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Could not fetch ZIP archive" },
        { status: 502 },
      );
    }
    const headers = zipDownloadHeaders(options.filename);
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);
    if (options.clearJobId) {
      void clearVideoDownloadJobStatus(options.clearJobId);
    }
    return new NextResponse(upstream.body, { headers });
  }

  if (options.clearJobId) {
    void clearVideoDownloadJobStatus(options.clearJobId);
  }
  return NextResponse.json({
    url: signed.data.signedUrl,
    filename: options.filename,
  });
}

/** Open/view link only — no Content-Disposition: attachment download. */
async function redirectToZipLink(options: {
  storagePath: string;
  filename: string;
}): Promise<NextResponse> {
  const localPath = videoDownloadLocalZipPath(options.storagePath);
  if (existsSync(localPath)) {
    // Local/dev: stream inline so the browser opens the file URL instead of
    // forcing a Save As download.
    const zipStat = await stat(localPath);
    const nodeStream = createReadStream(localPath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    const safe = options.filename.replace(/["\\]/g, "_");
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `inline; filename="${safe}"`,
        "Content-Length": String(zipStat.size),
        "Cache-Control": "no-store",
      },
    });
  }

  const supabase = createAdminClient();
  // Omit `download` so Supabase returns a viewable/openable signed URL.
  const signed = await supabase.storage
    .from(VIDEO_DOWNLOAD_STORAGE_BUCKET)
    .createSignedUrl(options.storagePath, SIGNED_URL_TTL_SECONDS);

  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      { error: signed.error?.message || "Could not create ZIP link" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(signed.data.signedUrl, 302);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const proxy = requestUrl.searchParams.get("proxy") === "1";
  const openOnly =
    requestUrl.searchParams.get("mode") === "open" ||
    requestUrl.searchParams.get("open") === "1";
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

  const resolved = await resolveStoragePathAndFilename({
    jobId,
    user: access.user,
    requestedName: requestUrl.searchParams.get("filename"),
  });
  if (!resolved.ok) return resolved.response;

  if (openOnly) {
    // Still wipe Redis status after the client opens the ZIP link.
    void clearVideoDownloadJobStatus(jobId);
    return redirectToZipLink({
      storagePath: resolved.storagePath,
      filename: resolved.filename,
    });
  }

  return streamZipResponse({
    storagePath: resolved.storagePath,
    filename: resolved.filename,
    proxy,
    // Always clear by jobId after a successful download response, even when
    // status was already gone and we resolved the ZIP from storage alone.
    clearJobId: jobId,
  });
}
