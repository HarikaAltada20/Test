import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DraftUploadError,
  resumableUpload,
  tusMetadata,
  uploadErrorFromResponse,
  type TusRequest,
  type TusResponse,
  type TusTransport,
} from "./content-draft-upload";

function response(status: number, headers: Record<string, string> = {}, body = ""): TusResponse {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { status, header: (name) => lower[name.toLowerCase()] ?? null, body };
}

/** In-memory TUS server with optional scripted failures. */
function fakeServer(opts: {
  failPatchAt?: Set<number>;
  conflictOnCreate?: boolean;
  createStatus?: number;
  createBody?: string;
} = {}) {
  let stored = 0;
  let patchCount = 0;
  const calls: TusRequest[] = [];
  const transport: TusTransport = async (req) => {
    calls.push(req);
    if (req.method === "POST") {
      if (opts.conflictOnCreate) return response(409, {}, '{"message":"The resource already exists"}');
      if (opts.createStatus) return response(opts.createStatus, {}, opts.createBody ?? "");
      return response(201, { Location: "/storage/v1/upload/resumable/abc" });
    }
    if (req.method === "HEAD") return response(200, { "Upload-Offset": String(stored) });
    patchCount++;
    if (opts.failPatchAt?.has(patchCount)) {
      // Half the chunk arrives, then the connection drops.
      stored += Math.floor((req.body?.size ?? 0) / 2);
      throw new Error("Network error");
    }
    const offset = Number(req.headers["Upload-Offset"]);
    if (offset !== stored) return response(409);
    stored += req.body?.size ?? 0;
    req.onProgress?.(req.body?.size ?? 0);
    return response(204, { "Upload-Offset": String(stored) });
  };
  return { transport, calls, stored: () => stored };
}

const base = {
  endpoint: "https://project.supabase.co/storage/v1/upload/resumable",
  bucket: "content-drafts",
  objectName: "u/d/v.mp4",
  contentType: "video/mp4",
  getHeaders: async () => ({ authorization: "Bearer token", apikey: "anon" }),
  chunkSize: 10,
  sleep: async () => {},
};

describe("tusMetadata", () => {
  it("base64-encodes each value", () => {
    assert.equal(tusMetadata({ bucketName: "content-drafts", objectName: "a/b.mp4" }),
      `bucketName ${Buffer.from("content-drafts").toString("base64")},objectName ${Buffer.from("a/b.mp4").toString("base64")}`);
  });
});

describe("resumableUpload", () => {
  it("creates the upload and sends fixed-size chunks with auth headers", async () => {
    const server = fakeServer();
    const progress: number[] = [];
    await resumableUpload({
      ...base,
      file: new Blob([new Uint8Array(25)]),
      transport: server.transport,
      onProgress: (n) => progress.push(n),
    });
    assert.equal(server.stored(), 25);
    const create = server.calls[0];
    assert.equal(create.method, "POST");
    assert.equal(create.headers["Upload-Length"], "25");
    assert.equal(create.headers["Tus-Resumable"], "1.0.0");
    assert.equal(create.headers["x-upsert"], "false");
    assert.equal(create.headers.authorization, "Bearer token");
    const patches = server.calls.filter((c) => c.method === "PATCH");
    assert.deepEqual(patches.map((p) => p.body?.size), [10, 10, 5]);
    assert.equal(patches[0].url, "https://project.supabase.co/storage/v1/upload/resumable/abc");
    assert.equal(patches[1].headers["Upload-Offset"], "10");
    assert.equal(progress.at(-1), 25);
  });

  it("resumes from the server offset after a dropped connection", async () => {
    const server = fakeServer({ failPatchAt: new Set([2]) });
    await resumableUpload({ ...base, file: new Blob([new Uint8Array(25)]), transport: server.transport });
    assert.equal(server.stored(), 25);
    const methods = server.calls.map((c) => c.method);
    assert.ok(methods.includes("HEAD"), "asks the server for its offset");
    // After the drop at offset 10 (+5 half chunk), the next PATCH starts at 15.
    const afterHead = server.calls[methods.indexOf("HEAD") + 1];
    assert.equal(afterHead.headers["Upload-Offset"], "15");
  });

  it("treats an existing object as already uploaded", async () => {
    const server = fakeServer({ conflictOnCreate: true });
    let last = 0;
    await resumableUpload({
      ...base,
      file: new Blob([new Uint8Array(5)]),
      transport: server.transport,
      onProgress: (n) => (last = n),
    });
    assert.equal(last, 5);
    assert.equal(server.calls.length, 1);
  });

  it("fails fast with a clear message when the file is refused", async () => {
    const server = fakeServer({ createStatus: 413, createBody: '{"message":"Payload too large"}' });
    await assert.rejects(
      resumableUpload({ ...base, file: new Blob([new Uint8Array(5)]), transport: server.transport }),
      (err: unknown) => err instanceof DraftUploadError && !err.retryable && /upload limit/.test(err.message),
    );
    assert.equal(server.calls.length, 1, "no retries for a refused file");
  });

  it("gives up after the retry budget on persistent network errors", async () => {
    let calls = 0;
    const transport: TusTransport = async () => {
      calls++;
      throw new Error("offline");
    };
    await assert.rejects(
      resumableUpload({
        ...base,
        file: new Blob([new Uint8Array(5)]),
        transport,
        retryDelaysMs: [0, 0, 0],
      }),
      (err: unknown) => err instanceof DraftUploadError && err.retryable,
    );
    assert.equal(calls, 4);
  });

  it("stops when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const server = fakeServer();
    await assert.rejects(
      resumableUpload({
        ...base,
        file: new Blob([new Uint8Array(5)]),
        transport: server.transport,
        signal: controller.signal,
      }),
      /cancelled/,
    );
    assert.equal(server.calls.length, 0);
  });
});

describe("uploadErrorFromResponse", () => {
  it("maps statuses to creator-facing messages", () => {
    assert.match(uploadErrorFromResponse(response(415)).message, /MP4, MOV or WebM/);
    assert.match(uploadErrorFromResponse(response(400, {}, '{"message":"mime type video/avi is not supported"}')).message, /MP4/);
    assert.match(uploadErrorFromResponse(response(403, {}, "new row violates row-level security policy")).message, /can't upload/);
    assert.equal(uploadErrorFromResponse(response(503)).retryable, true);
    assert.equal(uploadErrorFromResponse(response(401)).retryable, false);
  });
});
