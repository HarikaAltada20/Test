import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getDualRemainingPayableCents } from "./dual-rewards-payout";

describe("getDualRemainingPayableCents with wallet ledger", () => {
  it("ignores stale dual_rewards_payout when wallet net is zero after refund", () => {
    const remaining = getDualRemainingPayableCents(
      "both",
      8000,
      588,
      { cpm_cents: 8000, milestone_cents: 588 },
      { walletNetCents: 0 },
    );
    assert.equal(remaining.cpmRemaining, 8000);
    assert.equal(remaining.milestoneRemaining, 588);
    assert.equal(remaining.totalRemaining, 8588);
  });

  it("does not double-pay when wallet net already covers the grant", () => {
    const remaining = getDualRemainingPayableCents(
      "both",
      8000,
      588,
      { cpm_cents: 8000, milestone_cents: 588 },
      { walletNetCents: 8588 },
    );
    assert.equal(remaining.totalRemaining, 0);
  });

  it("pays only the gap when wallet net is a partial credit", () => {
    const remaining = getDualRemainingPayableCents(
      "cpm",
      8000,
      588,
      { cpm_cents: 4000, milestone_cents: 0 },
      { walletNetCents: 4000 },
    );
    assert.equal(remaining.cpmRemaining, 4000);
    assert.equal(remaining.totalRemaining, 4000);
  });
});
