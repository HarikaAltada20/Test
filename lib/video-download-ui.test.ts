import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canBulkDownloadContestVideos,
  canDownloadSubmissionVideo,
  chunkArray,
  MAX_BULK_VIDEO_DOWNLOADS,
} from "./video-download-ui";

describe("video-download-ui", () => {
  it("exposes a bounded bulk download limit", () => {
    assert.equal(MAX_BULK_VIDEO_DOWNLOADS, 10);
  });

  it("chunks large selections into batches of 10", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `id-${i + 1}`);
    const chunks = chunkArray(ids, MAX_BULK_VIDEO_DOWNLOADS);
    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].length, 10);
    assert.equal(chunks[1].length, 10);
    assert.equal(chunks[2].length, 5);
  });

  it("allows instagram and youtube downloads", () => {
    assert.equal(
      canDownloadSubmissionVideo({
        platform: "instagram",
        contentLink: "https://www.instagram.com/reel/abc/",
      }),
      true,
    );
    assert.equal(
      canDownloadSubmissionVideo({
        contestPlatform: "youtube",
        contentLink: "https://youtu.be/abcdefghijk",
      }),
      true,
    );
  });

  it("rejects tiktok downloads", () => {
    assert.equal(
      canDownloadSubmissionVideo({
        platform: "tiktok",
        contentLink: "https://www.tiktok.com/@x/video/1",
      }),
      false,
    );
    assert.equal(canBulkDownloadContestVideos("tiktok"), false);
  });

  it("allows bulk download for IG/YT contests only", () => {
    assert.equal(canBulkDownloadContestVideos("instagram"), true);
    assert.equal(canBulkDownloadContestVideos("YouTube Shorts"), true);
    assert.equal(canBulkDownloadContestVideos("twitter"), false);
  });
});
