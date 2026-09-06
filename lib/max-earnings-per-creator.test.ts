import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isKeyedMaxEarningsMap,
  resolveMaxEarningsCentsForSubmission,
} from "./video-platform-campaigns";

const keyedMax = {
  youtube: { max_earnings_per_creator: 50_000 },
  instagram: { max_earnings_per_creator: 30_000 },
  tiktok: { max_earnings_per_creator: 20_000 },
};

describe("resolveMaxEarningsCentsForSubmission", () => {
  it("treats a platform-keyed map as independent caps with no fallback", () => {
    const contest = {
      max_earnings_per_creator: keyedMax,
      platform: "youtube,instagram,tiktok",
    };
    assert.equal(isKeyedMaxEarningsMap(contest.max_earnings_per_creator), true);
    assert.equal(
      resolveMaxEarningsCentsForSubmission(contest, "youtube"),
      50_000,
    );
    assert.equal(
      resolveMaxEarningsCentsForSubmission(contest, "tiktok"),
      20_000,
    );
    assert.equal(
      resolveMaxEarningsCentsForSubmission(contest, "unknown"),
      null,
    );
  });

  it("applies a legacy number contest-wide", () => {
    const contest = {
      max_earnings_per_creator: 12_000,
      platform: "youtube",
    };
    assert.equal(isKeyedMaxEarningsMap(contest.max_earnings_per_creator), false);
    assert.equal(
      resolveMaxEarningsCentsForSubmission(contest, "youtube"),
      12_000,
    );
    assert.equal(
      resolveMaxEarningsCentsForSubmission(contest, "tiktok"),
      12_000,
    );
  });
});
