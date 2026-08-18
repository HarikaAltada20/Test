import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyRecoveredVideoDownloadJob,
  parseVideoDownloadJob,
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

  it("keeps a zip filename on the job", () => {
    const job = parseVideoDownloadJob({
      jobId: "abc",
      userId: "user-1",
      zipFilename: "bulk_submissions_My_Contest.zip",
      items: [
        { url: "https://instagram.com/reel/x", filename: "a.mp4", isInstagram: true },
      ],
    });
    assert.equal(job?.zipFilename, "bulk_submissions_My_Contest.zip");
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
