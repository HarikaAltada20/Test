import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatReelsSkipRate,
  parseInstagramVideoDuration,
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
