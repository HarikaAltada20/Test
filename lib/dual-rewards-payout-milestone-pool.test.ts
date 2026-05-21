import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dualRewardsPayoutForMilestoneTotal,
  parseDualRewardsPayoutJson,
} from "./dual-rewards-payout";

describe("dualRewardsPayoutForMilestoneTotal", () => {
  it("reduces milestone_cents and preserves cpm on reversal-style update", () => {
    const row = dualRewardsPayoutForMilestoneTotal(
      { cpm_cents: 500, milestone_cents: 300, type: "payment", updatedBy: "u1" },
      500,
      100,
    );
    assert.ok(row);
    assert.equal(row!.cpm_cents, 500);
    assert.equal(row!.milestone_cents, 100);
    assert.equal(row!.type, "payment");
    assert.equal(row!.updatedBy, "u1");
  });

  it("returns null when both components are zero", () => {
    assert.equal(
      dualRewardsPayoutForMilestoneTotal({ cpm_cents: 0, milestone_cents: 50 }, 0, 0),
      null,
    );
  });

  it("creates minimal JSON when no prior payout object", () => {
    const row = dualRewardsPayoutForMilestoneTotal(null, 0, 250);
    assert.ok(row);
    assert.equal(row!.milestone_cents, 250);
    assert.equal(parseDualRewardsPayoutJson(row)?.cpm_cents, 0);
  });
});
