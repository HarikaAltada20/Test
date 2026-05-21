import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDualRewardCreatorCapSplitMaps } from "./dual-rewards-creator-cap";

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
