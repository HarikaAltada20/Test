import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyRecoveredVideoDownloadJob,
  parseVideoDownloadJob,
  planRecoveredVideoDownloadJobs,
  requireVideoDownloadRemainderRequeued,
  resolveVideoDownloadTerminalStatus,
  videoDownloadActiveJobLimitError,
  VIDEO_DOWNLOAD_MAX_ACTIVE_JOBS_GLOBAL,
  VIDEO_DOWNLOAD_MAX_ACTIVE_JOBS_PER_USER,
  VIDEO_DOWNLOAD_STALE_PROCESSING_MS,
  VIDEO_DOWNLOAD_STORAGE_BUCKET,
  videoDownloadStoragePath,
  type VideoDownloadJobStatus,
} from "./video-download-queue";

function status(
  overrides: Partial<VideoDownloadJobStatus>,
): VideoDownloadJobStatus {
  return {
    jobId: "job-1",
    userId: "user-1",
    status: "processing",
    total: 1,
    completed: 0,
    failed: 0,
    errors: [],
    createdAt: "2026-08-18T10:00:00.000Z",
    updatedAt: "2026-08-18T10:00:00.000Z",
    ...overrides,
  };
}

describe("video download redis job payload", () => {
  it("parses a valid job and drops invalid items", () => {
    const job = parseVideoDownloadJob({
      jobId: "abc",
      userId: "user-1",
      attempt: 2,
      items: [
        { url: "https://instagram.com/reel/x", filename: "a.mp4", isInstagram: true },
        { url: "bad" },
      ],
    });
    assert.equal(job?.jobId, "abc");
    assert.equal(job?.items.length, 1);
    assert.equal(job?.attempt, 2);
    assert.equal(job?.zipFilename, undefined);
  });

  it("keeps remainder fields so leftover videos stay on the same ZIP job", () => {
    const job = parseVideoDownloadJob({
      jobId: "abc",
      userId: "user-1",
      zipFilename: "bulk_submissions_My_Contest.zip",
      partialStoragePath: "user-1/abc.zip",
      originalTotal: 10,
      completedSoFar: 6,
      failedSoFar: 1,
      errorsSoFar: ["skip"],
      zipBytesSoFar: 90_000_000,
      items: [
        { url: "https://instagram.com/reel/x", filename: "a.mp4", isInstagram: true },
      ],
    });
    assert.equal(job?.zipFilename, "bulk_submissions_My_Contest.zip");
    assert.equal(job?.partialStoragePath, "user-1/abc.zip");
    assert.equal(job?.originalTotal, 10);
    assert.equal(job?.completedSoFar, 6);
    assert.equal(job?.failedSoFar, 1);
    assert.equal(job?.zipBytesSoFar, 90_000_000);
    assert.deepEqual(job?.errorsSoFar, ["skip"]);
  });

  it("rejects jobs with no downloadable items", () => {
    assert.equal(
      parseVideoDownloadJob({ jobId: "abc", userId: "u", items: [] }),
      null,
    );
  });

  it("returns null for invalid JSON instead of throwing", () => {
    assert.equal(parseVideoDownloadJob("{not-json"), null);
  });

  it("stores ZIPs in the private bucket under a per-user path", () => {
    assert.equal(VIDEO_DOWNLOAD_STORAGE_BUCKET, "video-downloads");
    assert.equal(
      videoDownloadStoragePath("user-1", "job-9"),
      "user-1/job-9.zip",
    );
  });
});

describe("classifyRecoveredVideoDownloadJob", () => {
  const now = Date.parse("2026-08-18T10:05:00.000Z");

  it("drops jobs that already finished so they are not re-downloaded", () => {
    assert.equal(
      classifyRecoveredVideoDownloadJob(status({ status: "ready" }), now),
      "drop",
    );
    assert.equal(
      classifyRecoveredVideoDownloadJob(status({ status: "failed" }), now),
      "drop",
    );
  });

  it("keeps a live processing job in processing", () => {
    assert.equal(
      classifyRecoveredVideoDownloadJob(
        status({
          status: "processing",
          updatedAt: "2026-08-18T10:04:00.000Z",
        }),
        now,
      ),
      "keep-processing",
    );
  });

  it("requeues a stale processing job", () => {
    const staleAt = new Date(now - VIDEO_DOWNLOAD_STALE_PROCESSING_MS - 1).toISOString();
    assert.equal(
      classifyRecoveredVideoDownloadJob(
        status({ status: "processing", updatedAt: staleAt }),
        now,
      ),
      "requeue",
    );
  });

  it("requeues queued or missing status entries", () => {
    assert.equal(
      classifyRecoveredVideoDownloadJob(status({ status: "queued" }), now),
      "requeue",
    );
    assert.equal(classifyRecoveredVideoDownloadJob(null, now), "requeue");
  });

  it("plans recovery from a snapshot without removing live jobs", () => {
    const live = JSON.stringify({
      jobId: "live",
      userId: "user-1",
      items: [
        { url: "https://instagram.com/reel/x", filename: "a.mp4", isInstagram: true },
      ],
    });
    const stale = JSON.stringify({
      jobId: "stale",
      userId: "user-1",
      items: [
        { url: "https://instagram.com/reel/y", filename: "b.mp4", isInstagram: true },
      ],
    });
    const ready = JSON.stringify({
      jobId: "ready",
      userId: "user-1",
      items: [
        { url: "https://instagram.com/reel/z", filename: "c.mp4", isInstagram: true },
      ],
    });
    const statuses = new Map<string, VideoDownloadJobStatus | null>([
      ["live", status({ jobId: "live", status: "processing", updatedAt: "2026-08-18T10:04:00.000Z" })],
      [
        "stale",
        status({
          jobId: "stale",
          status: "processing",
          updatedAt: new Date(now - VIDEO_DOWNLOAD_STALE_PROCESSING_MS - 1).toISOString(),
        }),
      ],
      ["ready", status({ jobId: "ready", status: "ready" })],
    ]);
    const plan = planRecoveredVideoDownloadJobs(
      [live, stale, ready, "not-json"],
      (jobId) => statuses.get(jobId) ?? null,
      now,
    );
    assert.deepEqual(
      plan.map((item) => item.action),
      ["keep-processing", "requeue", "drop", "drop"],
    );
  });
});

describe("requireVideoDownloadRemainderRequeued", () => {
  it("allows ready when nothing was deferred", () => {
    requireVideoDownloadRemainderRequeued(0, false);
  });

  it("allows ready when leftover videos were requeued on the same job", () => {
    requireVideoDownloadRemainderRequeued(3, true);
  });

  it("refuses to mark ready if leftover videos were not requeued", () => {
    assert.throws(
      () => requireVideoDownloadRemainderRequeued(3, false),
      /leftover videos/,
    );
  });
});

describe("resolveVideoDownloadTerminalStatus", () => {
  it("keeps a partial ZIP downloadable when the next wave adds nothing", () => {
    const result = resolveVideoDownloadTerminalStatus({
      completed: 6,
      failed: 4,
      total: 10,
      errors: ["This Instagram video is private or restricted."],
      partialStoragePath: "user-1/job-1.zip",
      zipBytes: 80_000_000,
    });
    assert.equal(result.status, "ready");
    assert.equal(result.completed, 6);
    assert.equal(result.failed, 4);
    assert.equal(result.storagePath, "user-1/job-1.zip");
    assert.equal(result.zipBytes, 80_000_000);
  });

  it("does not zero completed when there is no ZIP to serve", () => {
    const result = resolveVideoDownloadTerminalStatus({
      completed: 0,
      failed: 10,
      total: 10,
      errors: ["This Instagram video is private or restricted."],
    });
    assert.equal(result.status, "failed");
    assert.equal(result.completed, 0);
    assert.equal(result.failed, 10);
    assert.equal(result.storagePath, undefined);
  });
});

describe("videoDownloadActiveJobLimitError", () => {
  it("rejects when the global in-flight cap is reached", () => {
    const result = videoDownloadActiveJobLimitError({
      total: VIDEO_DOWNLOAD_MAX_ACTIVE_JOBS_GLOBAL,
      userCount: 0,
    });
    assert.equal(result?.status, 429);
  });

  it("rejects when the per-user cap is reached", () => {
    const result = videoDownloadActiveJobLimitError({
      total: 1,
      userCount: VIDEO_DOWNLOAD_MAX_ACTIVE_JOBS_PER_USER,
    });
    assert.equal(result?.status, 429);
  });

  it("allows enqueue under both caps", () => {
    assert.equal(
      videoDownloadActiveJobLimitError({ total: 1, userCount: 1 }),
      null,
    );
  });
});
