import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRetryableDownloadError,
  processSequentialDownloadQueue,
  withDownloadRetries,
} from "./video-download-queue";

describe("video download queue", () => {
  it("processes items one at a time in order", async () => {
    const seen: number[] = [];
    let inflight = 0;
    let maxInflight = 0;

    await processSequentialDownloadQueue([1, 2, 3], async (item) => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      seen.push(item);
      inflight -= 1;
    }, { gapMs: 0 });

    assert.deepEqual(seen, [1, 2, 3]);
    assert.equal(maxInflight, 1);
  });

  it("retries retryable errors then succeeds", async () => {
    let attempts = 0;
    const result = await withDownloadRetries(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("Too many requests, try again later");
      }
      return "ok";
    });
    assert.equal(result, "ok");
    assert.equal(attempts, 3);
  });

  it("does not retry private/restricted videos", async () => {
    await assert.rejects(
      () =>
        withDownloadRetries(async () => {
          throw new Error("This Instagram video is private or restricted.");
        }),
      /private or restricted/,
    );
  });

  it("classifies retryable vs permanent download errors", () => {
    assert.equal(isRetryableDownloadError(new Error("HTTP 429 rate limit")), true);
    assert.equal(isRetryableDownloadError(new Error("CDN 403")), true);
    assert.equal(isRetryableDownloadError(new Error("This post is not a video")), false);
    assert.equal(isRetryableDownloadError(new Error("YouTube download is not configured")), false);
    assert.equal(
      isRetryableDownloadError(
        new Error("This Instagram video could not be found. It may have been deleted."),
      ),
      false,
    );
    assert.equal(
      isRetryableDownloadError(new Error("This YouTube video could not be downloaded.")),
      false,
    );
  });
});
