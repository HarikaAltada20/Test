import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDualRewardCreatorCapSplitMaps,
  buildDualRewardCreatorCapSplitMapsByPlatform,
} from "./dual-rewards-creator-cap";

describe("buildDualRewardCreatorCapSplitMaps", () => {
  it("allocates in created_at order until cap is exhausted", () => {
    const { milestoneCappedBySubmissionId, cpmCappedBySubmissionId } =
      buildDualRewardCreatorCapSplitMaps(
        [
          {
            id: "1",
            created_at: "2026-01-01T00:00:00Z",
            mRawCents: 600,
            cRawCents: 400,
          },
          {
            id: "2",
            created_at: "2026-01-02T00:00:00Z",
            mRawCents: 500,
            cRawCents: 500,
          },
        ],
        1000,
      );
    assert.equal(milestoneCappedBySubmissionId.get("1"), 600);
    assert.equal(cpmCappedBySubmissionId.get("1"), 400);
    assert.equal(milestoneCappedBySubmissionId.get("2"), 0);
    assert.equal(cpmCappedBySubmissionId.get("2"), 0);
  });

  it("does not cap when max is zero", () => {
    const { milestoneCappedBySubmissionId, cpmCappedBySubmissionId } =
      buildDualRewardCreatorCapSplitMaps(
        [
          {
            id: "1",
            created_at: "2026-01-01T00:00:00Z",
            mRawCents: 100,
            cRawCents: 200,
          },
        ],
        0,
      );
    assert.equal(milestoneCappedBySubmissionId.get("1"), 100);
    assert.equal(cpmCappedBySubmissionId.get("1"), 200);
  });
});

describe("buildDualRewardCreatorCapSplitMapsByPlatform", () => {
  it("applies YouTube and TikTok caps independently", () => {
    const { milestoneCappedBySubmissionId, cpmCappedBySubmissionId } =
      buildDualRewardCreatorCapSplitMapsByPlatform(
        [
          {
            id: "yt",
            created_at: "2026-01-01T00:00:00Z",
            platform: "youtube",
            mRawCents: 400,
            cRawCents: 400,
          },
          {
            id: "tt",
            created_at: "2026-01-01T00:00:01Z",
            platform: "tiktok",
            mRawCents: 400,
            cRawCents: 400,
          },
        ],
        (platform) =>
          String(platform || "").toLowerCase() === "youtube" ? 500 : 800,
        { keyedCaps: true },
      );
    assert.equal(milestoneCappedBySubmissionId.get("yt"), 250);
    assert.equal(cpmCappedBySubmissionId.get("yt"), 250);
    assert.equal(milestoneCappedBySubmissionId.get("tt"), 400);
    assert.equal(cpmCappedBySubmissionId.get("tt"), 400);
  });

  it("uses one contest-wide cap when keyedCaps is false", () => {
    const { milestoneCappedBySubmissionId, cpmCappedBySubmissionId } =
      buildDualRewardCreatorCapSplitMapsByPlatform(
        [
          {
            id: "yt",
            created_at: "2026-01-01T00:00:00Z",
            platform: "youtube",
            mRawCents: 400,
            cRawCents: 400,
          },
          {
            id: "tt",
            created_at: "2026-01-01T00:00:01Z",
            platform: "tiktok",
            mRawCents: 400,
            cRawCents: 400,
          },
        ],
        () => 500,
        { keyedCaps: false },
      );
    assert.equal(milestoneCappedBySubmissionId.get("yt"), 250);
    assert.equal(cpmCappedBySubmissionId.get("yt"), 250);
    assert.equal(milestoneCappedBySubmissionId.get("tt"), 0);
    assert.equal(cpmCappedBySubmissionId.get("tt"), 0);
  });
});
