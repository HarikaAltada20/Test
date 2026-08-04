import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getInstagramVideoStream,
  downloadInstagramVideoBuffer,
  downloadInstagramVideoToFile,
  InstagramDownloadError,
} from "./instagram-download/download";
import {
  getYouTubeVideoStream,
  downloadYouTubeVideoBuffer,
  downloadYouTubeVideoToFile,
  YouTubeDownloadError,
} from "./youtube-download/ytstream";

describe("video download streaming exports", () => {
  it("exports Instagram stream functions", () => {
    assert.equal(typeof getInstagramVideoStream, "function");
    assert.equal(typeof downloadInstagramVideoBuffer, "function");
    assert.equal(typeof downloadInstagramVideoToFile, "function");
  });

  it("exports YouTube stream functions", () => {
    assert.equal(typeof getYouTubeVideoStream, "function");
    assert.equal(typeof downloadYouTubeVideoBuffer, "function");
    assert.equal(typeof downloadYouTubeVideoToFile, "function");
  });

  it("rejects invalid Instagram URL gracefully", async () => {
    await assert.rejects(
      async () => {
        await getInstagramVideoStream("invalid-url");
      },
      (err: unknown) => {
        return err instanceof InstagramDownloadError;
      }
    );
  });

  it("rejects invalid YouTube URL gracefully", async () => {
    await assert.rejects(
      async () => {
        await getYouTubeVideoStream("invalid-url");
      },
      (err: unknown) => {
        return err instanceof YouTubeDownloadError;
      }
    );
  });
});
