import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildViewsBasedVideoFilename } from "./utils";

describe("buildViewsBasedVideoFilename", () => {
  it("zero-pads views so lexical sort matches numeric order", () => {
    const a = buildViewsBasedVideoFilename(999);
    const b = buildViewsBasedVideoFilename(1500);
    assert.equal(a < b, true);
    assert.equal(a, "000000000999");
    assert.equal(b, "000000001500");
  });

  it("treats missing views as zero", () => {
    assert.equal(buildViewsBasedVideoFilename(null), "000000000000");
    assert.equal(buildViewsBasedVideoFilename(undefined), "000000000000");
  });

  it("appends suffix when provided for duplicate views", () => {
    assert.equal(
      buildViewsBasedVideoFilename(1500, "abcd1234"),
      "000000001500_abcd1234",
    );
  });
});
