import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildViewsBasedVideoFilename } from "./utils";

describe("buildViewsBasedVideoFilename", () => {
  it("uses the raw view count without leading zeros", () => {
    assert.equal(buildViewsBasedVideoFilename(999), "999");
    assert.equal(buildViewsBasedVideoFilename(1500), "1500");
    assert.equal(buildViewsBasedVideoFilename(12500), "12500");
  });

  it("treats missing views as zero", () => {
    assert.equal(buildViewsBasedVideoFilename(null), "0");
    assert.equal(buildViewsBasedVideoFilename(undefined), "0");
  });

  it("appends suffix when provided for duplicate views", () => {
    assert.equal(
      buildViewsBasedVideoFilename(1500, "abcd1234"),
      "1500_abcd1234",
    );
  });
});
