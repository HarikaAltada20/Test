import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseVideoDownloadJob,
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

  it("builds a per-user storage path", () => {
    assert.equal(
      videoDownloadStoragePath("user-1", "job-9"),
      "video-downloads/user-1/job-9.zip",
    );
  });
});
