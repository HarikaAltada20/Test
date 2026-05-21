import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeDualRewardsProjectedPoolSpentCents,
  DUAL_REWARDS_POOL_NOT_CONFIGURED_ERROR,
  getDualRewardsSubmissionPaidComponents,
  validateDualRewardsPoolBudget,
} from "./dual-rewards-pool-budget";

describe("getDualRewardsSubmissionPaidComponents", () => {
  it("prefers dual_rewards_payout JSON over legacy columns", () => {
    const c = getDualRewardsSubmissionPaidComponents({
      id: "1",
      paid: true,
      earnings: 999,
      bonus_paid: true,
      bonus_amount: 888,
      dual_rewards_payout: { cpm_cents: 100, milestone_cents: 50 },
    });
    assert.equal(c.cpmCents, 100);
    assert.equal(c.milestoneCents, 50);
  });

  it("falls back to paid earnings and bonus_amount", () => {
    const c = getDualRewardsSubmissionPaidComponents({
      id: "1",
      paid: true,
      earnings: 200,
      bonus_paid: true,
      bonus_amount: 75,
    });
    assert.equal(c.cpmCents, 200);
    assert.equal(c.milestoneCents, 75);
  });

  it("uses per-field JSON with legacy fallback for the other component", () => {
    const c = getDualRewardsSubmissionPaidComponents({
      id: "1",
      paid: true,
      earnings: 999,
      bonus_paid: true,
      bonus_amount: 50,
      dual_rewards_payout: { milestone_cents: 120 },
    });
    assert.equal(c.cpmCents, 999);
    assert.equal(c.milestoneCents, 120);
  });
});

describe("validateDualRewardsPoolBudget", () => {
  const rows = [
    {
      id: "a",
      dual_rewards_payout: { cpm_cents: 300, milestone_cents: 100 },
    },
    { id: "b", paid: true, earnings: 50, bonus_paid: false },
  ];

  it("rejects when pool is not configured", () => {
    const r = validateDualRewardsPoolBudget({
      poolBudgetCents: 0,
      rows,
      targetSubmissionId: "b",
      targetAfter: { cpmCents: 50, milestoneCents: 0 },
    });
    assert.equal(r.allowed, false);
    if (!r.allowed) {
      assert.equal(r.error, DUAL_REWARDS_POOL_NOT_CONFIGURED_ERROR);
    }
  });

  it("allows spend within pool", () => {
    const r = validateDualRewardsPoolBudget({
      poolBudgetCents: 1000,
      rows,
      targetSubmissionId: "b",
      targetAfter: { cpmCents: 100, milestoneCents: 0 },
    });
    assert.equal(r.allowed, true);
    if (r.allowed) {
      assert.equal(r.projectedSpentCents, 500);
    }
  });

  it("rejects when projected spend exceeds pool", () => {
    const r = validateDualRewardsPoolBudget({
      poolBudgetCents: 400,
      rows,
      targetSubmissionId: "b",
      targetAfter: { cpmCents: 200, milestoneCents: 0 },
    });
    assert.equal(r.allowed, false);
    if (!r.allowed) {
      assert.equal(r.projectedSpentCents, 600);
    }
  });

  it("replaces target row components in projection", () => {
    const projected = computeDualRewardsProjectedPoolSpentCents(
      rows,
      "a",
      { cpmCents: 10, milestoneCents: 10 },
    );
    assert.equal(projected, 70);
  });

  it("serializes concurrent payouts when target rows reflect committed state", () => {
    const afterFirst = validateDualRewardsPoolBudget({
      poolBudgetCents: 600,
      rows,
      targetSubmissionId: "b",
      targetAfter: { cpmCents: 200, milestoneCents: 0 },
    });
    assert.equal(afterFirst.allowed, true);

    const rowsAfterCommit: typeof rows = [
      rows[0],
      {
        id: "b",
        dual_rewards_payout: { cpm_cents: 200, milestone_cents: 0 },
      },
    ];
    const afterSecond = validateDualRewardsPoolBudget({
      poolBudgetCents: 600,
      rows: rowsAfterCommit,
      targetSubmissionId: "b",
      targetAfter: { cpmCents: 200, milestoneCents: 200 },
    });
    assert.equal(afterSecond.allowed, false);
    if (!afterSecond.allowed) {
      assert.equal(afterSecond.projectedSpentCents, 800);
    }
  });
});
