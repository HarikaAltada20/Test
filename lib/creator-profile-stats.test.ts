import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatTrustScoreDisplay,
  formatTrustScoreMinimum,
  formatTrustScoreOutOf100,
  formatTrustScorePct,
} from "./creator-profile-stats";

describe("trust score display formatting", () => {
  it("formats score out of 100", () => {
    assert.equal(formatTrustScoreOutOf100(85), "85/100");
    assert.equal(formatTrustScoreOutOf100(85.4), "85/100");
    assert.equal(formatTrustScoreOutOf100(100), "100/100");
    assert.equal(formatTrustScoreOutOf100(0), "0/100");
  });

  it("formats score as percentage suffix", () => {
    assert.equal(formatTrustScorePct(85), "85%");
    assert.equal(formatTrustScorePct(100), "100%");
  });

  it("uses /100 for profile and eligibility displays", () => {
    assert.equal(formatTrustScoreDisplay(92), "92/100");
    assert.equal(formatTrustScoreMinimum(70), "70/100");
  });
});
