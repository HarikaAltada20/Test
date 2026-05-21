import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inferDualPayoutScopeFromPaidTotal } from "./dual-rewards-payout";
import { shouldRollbackDualRewardsPoolCommit } from "./dual-rewards-pool-budget";

describe("inferDualPayoutScopeFromPaidTotal", () => {
  it("returns milestone when paid equals milestone only", () => {
    assert.equal(inferDualPayoutScopeFromPaidTotal(500, 1000, 500), "milestone");
  });

  it("returns cpm when paid equals cpm only", () => {
    assert.equal(inferDualPayoutScopeFromPaidTotal(800, 800, 200), "cpm");
  });

  it("returns both when paid equals sum", () => {
    assert.equal(inferDualPayoutScopeFromPaidTotal(1500, 1000, 500), "both");
  });

  it("returns null for off-by-one amounts (no fuzzy tolerance)", () => {
    assert.equal(inferDualPayoutScopeFromPaidTotal(501, 1000, 500), null);
    assert.equal(inferDualPayoutScopeFromPaidTotal(499, 1000, 500), null);
  });

  it("returns null when multiple interpretations match", () => {
    assert.equal(inferDualPayoutScopeFromPaidTotal(100, 100, 100), null);
  });
});

describe("shouldRollbackDualRewardsPoolCommit", () => {
  const committed = {
    ok: true as const,
    check: {
      allowed: true as const,
      poolBudgetCents: 1000,
      projectedSpentCents: 100,
      committed: true,
    },
  };

  it("rolls back when wallet was not credited", () => {
    assert.equal(shouldRollbackDualRewardsPoolCommit(committed), true);
  });

  it("skips rollback after wallet credit", () => {
    assert.equal(
      shouldRollbackDualRewardsPoolCommit(committed, { walletCredited: true }),
      false,
    );
  });
});
