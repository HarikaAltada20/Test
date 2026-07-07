import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyDualRewardsPayUpdateOptimisticGuards,
  buildDualRewardsBulkRollbackRevertPayload,
  buildDualRewardsPayUpdateGuardContext,
} from "./dual-rewards-payout";

function mockQuery() {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain = {
    filter(column: string, operator: string, value: string) {
      calls.push({ method: "filter", args: [column, operator, value] });
      return chain;
    },
    is(column: string, value: null) {
      calls.push({ method: "is", args: [column, value] });
      return chain;
    },
    eq(column: string, value: boolean) {
      calls.push({ method: "eq", args: [column, value] });
      return chain;
    },
    neq(column: string, value: boolean) {
      calls.push({ method: "neq", args: [column, value] });
      return chain;
    },
    calls,
  };
  return chain;
}

describe("applyDualRewardsPayUpdateOptimisticGuards", () => {
  it("uses JSON compare-and-swap when dual_rewards_payout exists", () => {
    const q = mockQuery();
    applyDualRewardsPayUpdateOptimisticGuards(
      q,
      {
        dual_rewards_payout: { cpm_cents: 100, milestone_cents: 0 },
      },
      { cpmCents: 100, milestoneCents: 0 },
      { cpm_cents: 0, milestone_cents: 50 },
    );
    assert.deepEqual(q.calls, [
      {
        method: "filter",
        args: ["dual_rewards_payout->>cpm_cents", "eq", "100"],
      },
      {
        method: "filter",
        args: ["dual_rewards_payout->>milestone_cents", "eq", "0"],
      },
    ]);
  });

  it("guards legacy CPM pay with unpaid paid flag", () => {
    const q = mockQuery();
    applyDualRewardsPayUpdateOptimisticGuards(
      q,
      { dual_rewards_payout: null, paid: false, bonus_paid: false },
      { cpmCents: 0, milestoneCents: 0 },
      { cpm_cents: 200, milestone_cents: 0 },
    );
    assert.deepEqual(q.calls, [
      { method: "is", args: ["dual_rewards_payout", null] },
      { method: "neq", args: ["paid", true] },
    ]);
  });

  it("guards legacy milestone-only pay with paid=true and unpaid bonus", () => {
    const q = mockQuery();
    applyDualRewardsPayUpdateOptimisticGuards(
      q,
      { dual_rewards_payout: null, paid: true, bonus_paid: false },
      { cpmCents: 200, milestoneCents: 0 },
      { cpm_cents: 0, milestone_cents: 75 },
    );
    assert.deepEqual(q.calls, [
      { method: "is", args: ["dual_rewards_payout", null] },
      { method: "eq", args: ["paid", true] },
      { method: "neq", args: ["bonus_paid", true] },
    ]);
  });
});

describe("buildDualRewardsPayUpdateGuardContext", () => {
  it("uses committed dual_rewards_payout for compare-and-swap after pool commit", () => {
    const ctx = buildDualRewardsPayUpdateGuardContext(
      { dual_rewards_payout: null, paid: false, bonus_paid: false },
      { cpmCents: 0, milestoneCents: 0 },
      { cpm_cents: 110, milestone_cents: 63 },
      true,
    );
    assert.deepEqual(ctx.paidComponents, { cpmCents: 110, milestoneCents: 63 });
    assert.deepEqual(ctx.snapshot.dual_rewards_payout, {
      cpm_cents: 110,
      milestone_cents: 63,
    });
  });

  it("keeps the pre-commit snapshot when pool was not committed", () => {
    const snapshot = {
      dual_rewards_payout: { cpm_cents: 50, milestone_cents: 0 },
      paid: true,
    };
    const paid = { cpmCents: 50, milestoneCents: 0 };
    const ctx = buildDualRewardsPayUpdateGuardContext(
      snapshot,
      paid,
      { cpm_cents: 50, milestone_cents: 25 },
      false,
    );
    assert.deepEqual(ctx.snapshot, snapshot);
    assert.deepEqual(ctx.paidComponents, paid);
  });
});

describe("buildDualRewardsBulkRollbackRevertPayload", () => {
  it("clears row when no prior components were paid", () => {
    const payload = buildDualRewardsBulkRollbackRevertPayload(
      { cpmCents: 0, milestoneCents: 0 },
      { cpm_cents: 100, milestone_cents: 50 },
    );
    assert.equal(payload.dual_rewards_payout, null);
    assert.equal(payload.status, "verified");
    assert.equal(payload.paid, false);
    assert.equal(payload.earnings, null);
  });

  it("restores partial prior milestone when rolling back a second component pay", () => {
    const payload = buildDualRewardsBulkRollbackRevertPayload(
      { cpmCents: 100, milestoneCents: 0 },
      { cpm_cents: 0, milestone_cents: 50 },
    );
    assert.equal(payload.paid, true);
    assert.equal(payload.earnings, 100);
    assert.equal(
      (payload.dual_rewards_payout as { cpm_cents: number }).cpm_cents,
      100,
    );
    assert.equal(
      (payload.dual_rewards_payout as { milestone_cents: number })
        .milestone_cents,
      0,
    );
    assert.equal(payload.bonus_paid, false);
  });
});
