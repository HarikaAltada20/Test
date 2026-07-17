import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatReelsSkipRate,
  parseInstagramVideoDuration,
  shouldRetryInsightsWithoutOptionalMetrics,
} from "./instagram-clip-metrics";

describe("parseInstagramVideoDuration", () => {
  it("parses seconds", () => {
    assert.equal(parseInstagramVideoDuration(45), 45);
    assert.equal(parseInstagramVideoDuration("90.4"), 90);
  });

  it("treats very large values as milliseconds", () => {
    assert.equal(parseInstagramVideoDuration(15000), 15);
  });

  it("returns null for invalid", () => {
    assert.equal(parseInstagramVideoDuration(null), null);
    assert.equal(parseInstagramVideoDuration(0), null);
  });
});

describe("formatReelsSkipRate", () => {
  it("formats percentages", () => {
    assert.equal(formatReelsSkipRate(41.2), "41.2%");
    assert.equal(formatReelsSkipRate(0.412), "41.2%");
  });

  it("returns dash when missing", () => {
    assert.equal(formatReelsSkipRate(null), "—");
    assert.equal(formatReelsSkipRate(undefined), "—");
  });
});

describe("shouldRetryInsightsWithoutOptionalMetrics", () => {
  it("does not retry permanent media (100/33)", () => {
    assert.equal(
      shouldRetryInsightsWithoutOptionalMetrics({
        code: 100,
        error_subcode: 33,
        message: "Unsupported get request",
      }),
      false,
    );
  });

  it("retries invalid metric list (code 100, not 33)", () => {
    assert.equal(
      shouldRetryInsightsWithoutOptionalMetrics({
        code: 100,
        message: "(#100) Invalid metric: reels_skip_rate",
      }),
      true,
    );
    assert.equal(
      shouldRetryInsightsWithoutOptionalMetrics({
        code: 100,
      }),
      true,
    );
  });

  it("does not retry account token errors (190)", () => {
    assert.equal(
      shouldRetryInsightsWithoutOptionalMetrics({
        code: 190,
        message: "Invalid OAuth access token",
      }),
      false,
    );
  });

  it("does not retry generic temporary / rate limit failures", () => {
    assert.equal(
      shouldRetryInsightsWithoutOptionalMetrics({
        code: 4,
        message: "Application request limit reached",
      }),
      false,
    );
    assert.equal(
      shouldRetryInsightsWithoutOptionalMetrics({
        code: 500,
        message: "Internal server error",
      }),
      false,
    );
  });
});
