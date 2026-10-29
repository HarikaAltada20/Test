/**
 * Browser upload of draft videos straight to Supabase Storage with the
 * resumable (TUS 1.0) protocol, so large files survive network drops and
 * never pass through our servers. Minimal client: create, PATCH 6 MB chunks,
 * HEAD to resume. https://supabase.com/docs/guides/storage/uploads/resumable-uploads
 */

/** Supabase requires exactly 6 MB chunks (except the last). */
export const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const TUS_VERSION = "1.0.0";
const DEFAULT_RETRY_DELAYS_MS = [0, 1000, 3000, 5000, 10000, 20000];

export type TusResponse = {
  status: number;
  header: (name: string) => string | null;
  body: string;
};

export type TusRequest = {
  method: "POST" | "PATCH" | "HEAD";
  url: string;
  headers: Record<string, string>;
  body?: Blob;
  /** Bytes of this request's body sent so far. */
  onProgress?: (loaded: number) => void;
  signal?: AbortSignal;
};

/** Sends one HTTP request; rejects only on network failure or abort. */
export type TusTransport = (req: TusRequest) => Promise<TusResponse>;

export class DraftUploadError extends Error {
  constructor(
    message: string,
    /** False when retrying can't help (file refused, signed out, aborted). */
    public retryable: boolean,
    public status?: number,
  ) {
    super(message);
    this.name = "DraftUploadError";
  }
}

export type ResumableUploadOptions = {
  /** e.g. https://<project>.supabase.co/storage/v1/upload/resumable */
  endpoint: string;
  bucket: string;
  objectName: string;
  contentType: string;
  file: Blob;
  /** Fresh auth headers (authorization, apikey) for every request. */
  getHeaders: () => Promise<Record<string, string>>;
  onProgress?: (uploaded: number, total: number) => void;
  signal?: AbortSignal;
  transport?: TusTransport;
  chunkSize?: number;
  retryDelaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
};

function base64(value: string): string {
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(value)));
  }
  return Buffer.from(value, "utf8").toString("base64");
}

/** Upload-Metadata header value for Supabase Storage. */
export function tusMetadata(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k} ${base64(v)}`)
    .join(",");
}

function abortError(): DraftUploadError {
  return new DraftUploadError("Upload cancelled.", false);
}

function serverMessage(res: TusResponse): string {
  const text = (res.body || "").trim();
  if (!text) return "";
  try {
    const json = JSON.parse(text) as { message?: string; error?: string };
    return String(json.message || json.error || "");
  } catch {
    return text.slice(0, 200);
  }
}

/** A refused upload as a message for the creator. */
export function uploadErrorFromResponse(res: TusResponse): DraftUploadError {
  const detail = serverMessage(res);
  if (res.status === 413 || /too large|maximum allowed size|exceeded/i.test(detail)) {
    return new DraftUploadError(
      "This video is larger than the upload limit. Try a shorter or more compressed export.",
      false,
      res.status,
    );
  }
  if (res.status === 415 || /mime type|not supported/i.test(detail)) {
    return new DraftUploadError("Use an MP4, MOV or WebM video.", false, res.status);
  }
  if (res.status === 401) {
    return new DraftUploadError("Your session expired. Sign in again and retry.", false, res.status);
  }
  if (res.status === 403 || /row-level security|unauthorized/i.test(detail)) {
    return new DraftUploadError("You can't upload drafts with this account.", false, res.status);
  }
  if (res.status >= 500 || res.status === 423 || res.status === 429) {
    return new DraftUploadError("The upload server is busy. Retrying…", true, res.status);
  }
  return new DraftUploadError(detail || `Upload failed (${res.status}).`, false, res.status);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Uploads `file` to `bucket/objectName`. Resolves when the whole file is
 * stored. Network errors and busy responses are retried from the last byte
 * the server confirmed. An object that already exists counts as done (the
 * names are unique per version, so it is this same upload finishing twice).
 */
export async function resumableUpload(opts: ResumableUploadOptions): Promise<void> {
  const transport = opts.transport ?? xhrTransport;
  const sleep = opts.sleep ?? defaultSleep;
  const delays = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const chunkSize = opts.chunkSize ?? TUS_CHUNK_SIZE;
  const total = opts.file.size;
  let attempt = 0;
  let uploadUrl: string | null = null;
  let offset = 0;

  const report = (bytes: number) => opts.onProgress?.(Math.min(bytes, total), total);

  const send = async (req: Omit<TusRequest, "headers" | "signal"> & { headers?: Record<string, string> }) => {
    if (opts.signal?.aborted) throw abortError();
    const auth = await opts.getHeaders();
    try {
      return await transport({
        ...req,
        headers: { "Tus-Resumable": TUS_VERSION, ...auth, ...(req.headers ?? {}) },
        signal: opts.signal,
      });
    } catch (err) {
      if (opts.signal?.aborted) throw abortError();
      throw new DraftUploadError(
        err instanceof Error && err.message ? err.message : "Network error",
        true,
      );
    }
  };

  /** Waits before the next retry, or throws when retries are used up. */
  const backoff = async (err: DraftUploadError) => {
    if (!err.retryable || attempt >= delays.length) throw err;
    const wait = delays[attempt++];
    if (wait > 0) await sleep(wait);
    if (opts.signal?.aborted) throw abortError();
  };

  report(0);
  for (;;) {
    try {
      if (!uploadUrl) {
        const res = await send({
          method: "POST",
          url: opts.endpoint,
          headers: {
            "Upload-Length": String(total),
            "Upload-Metadata": tusMetadata({
              bucketName: opts.bucket,
              objectName: opts.objectName,
              contentType: opts.contentType,
              cacheControl: "3600",
            }),
            "x-upsert": "false",
          },
        });
        if (res.status === 409) {
          // Already stored under this unique name.
          report(total);
          return;
        }
        if (res.status !== 201 && res.status !== 200) throw uploadErrorFromResponse(res);
        const location = res.header("Location") || res.header("location");
        if (!location) throw new DraftUploadError("The upload server didn't start the upload.", true);
        uploadUrl = new URL(location, opts.endpoint).toString();
        offset = 0;
      } else if (offset < 0) {
        // Ask the server how much it has after an interruption.
        const res = await send({ method: "HEAD", url: uploadUrl });
        if (res.status === 404 || res.status === 410) {
          uploadUrl = null;
          throw new DraftUploadError("The upload expired. Restarting…", true, res.status);
        }
        if (res.status !== 200 && res.status !== 204) throw uploadErrorFromResponse(res);
        const serverOffset = Number(res.header("Upload-Offset"));
        if (!Number.isFinite(serverOffset) || serverOffset < 0) {
          uploadUrl = null;
          throw new DraftUploadError("The upload couldn't resume. Restarting…", true, res.status);
        }
        offset = serverOffset;
        report(offset);
      }

      if (offset >= total) {
        report(total);
        return;
      }

      const end = Math.min(offset + chunkSize, total);
      const start = offset;
      const res = await send({
        method: "PATCH",
        url: uploadUrl,
        headers: {
          "Upload-Offset": String(start),
          "Content-Type": "application/offset+octet-stream",
        },
        body: opts.file.slice(start, end),
        onProgress: (loaded) => report(start + loaded),
      });
      if (res.status === 404 || res.status === 410) {
        // The server dropped the upload: start a new one.
        uploadUrl = null;
        throw new DraftUploadError("The upload expired. Restarting…", true, res.status);
      }
      if (res.status === 409) {
        // Offset mismatch: re-sync from the server's offset.
        throw new DraftUploadError("The upload got out of sync. Resuming…", true, res.status);
      }
      if (res.status !== 204 && res.status !== 200) throw uploadErrorFromResponse(res);
      const next = Number(res.header("Upload-Offset"));
      offset = Number.isFinite(next) && next > start ? next : end;
      attempt = 0;
      report(offset);
      if (offset >= total) return;
    } catch (err) {
      const e =
        err instanceof DraftUploadError ? err : new DraftUploadError(String(err), true);
      await backoff(e);
      // Resume from what the server confirmed.
      if (uploadUrl) offset = -1;
    }
  }
}

/** Default transport: XMLHttpRequest, for upload progress and abort. */
export const xhrTransport: TusTransport = (req) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(req.method, req.url, true);
    for (const [k, v] of Object.entries(req.headers)) xhr.setRequestHeader(k, v);
    if (req.onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => req.onProgress?.(e.loaded);
    }
    const onAbort = () => xhr.abort();
    req.signal?.addEventListener("abort", onAbort, { once: true });
    const done = () => req.signal?.removeEventListener("abort", onAbort);
    xhr.onload = () => {
      done();
      resolve({
        status: xhr.status,
        header: (name) => xhr.getResponseHeader(name),
        body: typeof xhr.responseText === "string" ? xhr.responseText : "",
      });
    };
    xhr.onerror = () => {
      done();
      reject(new Error("Network error"));
    };
    xhr.ontimeout = () => {
      done();
      reject(new Error("The upload timed out"));
    };
    xhr.onabort = () => {
      done();
      reject(new Error("Upload cancelled"));
    };
    xhr.send(req.body ?? null);
  });

// ---------------------------------------------------------------------------
// Video details read in the browser
// ---------------------------------------------------------------------------

export type VideoDetails = {
  durationSec: number | null;
  width: number | null;
  height: number | null;
  /** First-second frame as JPEG, when the browser can decode the video. */
  poster: Blob | null;
};

const POSTER_MAX_EDGE = 720;

/**
 * Duration, size and a poster frame from a local video file. Never throws:
 * formats the browser can't decode (e.g. some iPhone HEVC .mov files in
 * Chrome) return nulls and the upload goes ahead without a preview.
 */
export function readVideoDetails(file: Blob, timeoutMs = 10000): Promise<VideoDetails> {
  const empty: VideoDetails = { durationSec: null, width: null, height: null, poster: null };
  if (typeof document === "undefined") return Promise.resolve(empty);

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const details: VideoDetails = { ...empty };

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(details);
    };
    const timer = setTimeout(finish, timeoutMs);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onerror = finish;
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        details.durationSec = Math.round(video.duration * 100) / 100;
      }
      details.width = video.videoWidth || null;
      details.height = video.videoHeight || null;
      if (!details.width || !details.height) {
        finish();
        return;
      }
      const target = details.durationSec ? Math.min(1, details.durationSec / 10) : 0;
      video.currentTime = target;
    };
    video.onseeked = () => {
      try {
        const scale = Math.min(1, POSTER_MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            details.poster = blob && blob.size > 0 ? blob : null;
            finish();
          },
          "image/jpeg",
          0.8,
        );
      } catch {
        finish();
      }
    };
    video.src = url;
  });
}
