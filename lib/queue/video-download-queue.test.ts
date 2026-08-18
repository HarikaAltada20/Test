import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseVideoDownloadJob,
  VIDEO_DOWNLOAD_STORAGE_BUCKET,
  videoDownloadStoragePath,
} from "./video-download-queue";

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
