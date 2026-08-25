import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBulkDownloadMetaMap,
  buildBulkDownloadResultRows,
  canBulkDownloadContestVideos,
  canDownloadSubmissionVideo,
  chunkArray,
  DEFAULT_VIDEOS_PER_ZIP,
  MAX_BULK_VIDEO_DOWNLOADS,
  parseBulkZipFileResponse,
  parseVideosPerZip,
} from "./video-download-ui";

describe("video-download-ui", () => {
  it("exposes a bounded bulk download limit", () => {
    assert.equal(MAX_BULK_VIDEO_DOWNLOADS, 100);
    assert.equal(DEFAULT_VIDEOS_PER_ZIP, 10);
  });

  it("clamps videos-per-ZIP to 1–100", () => {
    assert.equal(parseVideosPerZip(0), 1);
    assert.equal(parseVideosPerZip(10), 10);
    assert.equal(parseVideosPerZip(100), 100);
    assert.equal(parseVideosPerZip(101), 100);
    assert.equal(parseVideosPerZip("not-a-number"), DEFAULT_VIDEOS_PER_ZIP);
  });

  it("chunks large selections by videos-per-ZIP", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `id-${i + 1}`);
    const chunks = chunkArray(ids, DEFAULT_VIDEOS_PER_ZIP);
    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].length, 10);
    assert.equal(chunks[1].length, 10);
    assert.equal(chunks[2].length, 5);
    assert.equal(chunkArray(ids, 100).length, 1);
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

  it("builds per-submission success and failure rows from queue failures", () => {
    const metaById = buildBulkDownloadMetaMap(["a", "b"], (id) =>
      id === "a"
        ? {
            username: "creator_a",
            videoTitle: "Video A",
            link: "https://instagram.com/reel/a/",
            views: 1200,
          }
        : {
            username: "creator_b",
            videoTitle: "Video B",
            link: "https://instagram.com/reel/b",
            views: 900,
          },
    );
    const rows = buildBulkDownloadResultRows({
      submissionIds: ["a", "b"],
      metaById,
      itemFailures: [
        {
          url: "https://instagram.com/reel/a/",
          error: "Video not found",
        },
      ],
    });
    assert.equal(rows.find((row) => row.submissionId === "a")?.status, "failed");
    assert.equal(rows.find((row) => row.submissionId === "b")?.status, "success");
    assert.equal(rows.find((row) => row.submissionId === "a")?.username, "creator_a");
    assert.equal(rows.find((row) => row.submissionId === "b")?.views, 900);
  });

  it("uses a signed ZIP URL when the file proxy returns JSON", () => {
    assert.deepEqual(
      parseBulkZipFileResponse({
        ok: false,
        status: 400,
        contentType: "application/json",
        payload: {
          error: "proxy disabled",
          url: "https://example.test/file.zip",
        },
      }),
      { kind: "signed-url", url: "https://example.test/file.zip" },
    );
    assert.deepEqual(
      parseBulkZipFileResponse({
        ok: true,
        status: 200,
        contentType: "application/zip",
      }),
      { kind: "blob" },
    );
    assert.deepEqual(
      parseBulkZipFileResponse({
        ok: false,
        status: 409,
        contentType: "application/json",
      }),
      { kind: "retry" },
    );
  });
});
