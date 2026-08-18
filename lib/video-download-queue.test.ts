import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bulkDownloadBytesRemaining,
  isRetryableDownloadError,
  isWorkerTimeBudgetExhausted,
  isWorkerTimeBudgetSkip,
  processSequentialDownloadQueue,
  shouldRetryZeroDownload,
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

  it("stops retrying when the worker budget is exhausted", async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        withDownloadRetries(
          async () => {
            attempts += 1;
            throw new Error("Too many requests, try again later");
          },
          { shouldAbort: () => attempts > 0 },
        ),
      /Too many requests/,
    );
    assert.equal(attempts, 1);
  });

  it("skips the inter-item gap after the worker budget is exhausted", async () => {
    const seen: number[] = [];
    const started = Date.now();
    await processSequentialDownloadQueue(
      [1, 2, 3],
      async (item) => {
        seen.push(item);
      },
      { gapMs: 200, shouldSkipGap: () => true },
    );
    assert.deepEqual(seen, [1, 2, 3]);
    assert.ok(Date.now() - started < 150);
  });

  it("reports when the worker download budget is exhausted", () => {
    assert.equal(isWorkerTimeBudgetExhausted(0, 240_000), true);
    assert.equal(isWorkerTimeBudgetExhausted(0, 239_999), false);
  });

  it("retries a 0-download job for rate limits and budget skips", () => {
    assert.equal(isWorkerTimeBudgetSkip("Skipped: worker time budget reached so remaining videos can be zipped."), true);
    assert.equal(
      shouldRetryZeroDownload([{ error: "Too many requests to Instagram. Please wait a few minutes." }]),
      true,
    );
    assert.equal(
      shouldRetryZeroDownload([{ error: "This Instagram video is private or restricted." }]),
      false,
    );
    assert.equal(shouldRetryZeroDownload([], 2), true);
    assert.equal(
      shouldRetryZeroDownload([
        { error: "Skipped: bulk download size limit (209715200 bytes) reached." },
      ]),
      false,
    );
  });

  it("counts already-stored ZIP bytes against the job-wide size cap", () => {
    const maxBytes = 200 * 1024 * 1024;
    assert.equal(bulkDownloadBytesRemaining(0, maxBytes), maxBytes);
    assert.equal(bulkDownloadBytesRemaining(maxBytes, maxBytes), 0);
    assert.equal(bulkDownloadBytesRemaining(maxBytes + 10, maxBytes), 0);
    assert.equal(
      bulkDownloadBytesRemaining(50 * 1024 * 1024, maxBytes),
      maxBytes - 50 * 1024 * 1024,
    );
  });
});
