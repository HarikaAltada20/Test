import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeDualRewardsProjectedPoolSpentCents,
  computeDualRewardsSubmissionReversalDue,
  DUAL_REWARDS_POOL_NOT_CONFIGURED_ERROR,
  getDualRewardsSubmissionPaidComponents,
  scaleDualReversalDuesToTotalCap,
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

describe("computeDualRewardsSubmissionReversalDue", () => {
  const reversalRemark = "Forfeited due to status reversal";

  it("uses wallet ledger net when dual_rewards_payout overstates the grant", () => {
    const due = computeDualRewardsSubmissionReversalDue({
      submissionRow: {
        id: "sub-1",
        paid: true,
        earnings: 885,
        bonus_paid: false,
        dual_rewards_payout: { cpm_cents: 1200, milestone_cents: 200 },
      },
      submissionId: "sub-1",
      rewardTxns: [
        {
          amount: 973,
          metadata: { submission_id: "sub-1", contest_id: "c1" },
        },
      ],
      refundTxns: [],
      reversalRemark,
      wasPaidBeforeReversal: true,
    });
    assert.equal(due.totalCents, 973);
    assert.equal(due.mainCents + due.bonusCents, 973);
  });

  it("sums six submissions to ledger total not uncapped JSON", () => {
    const perSubReward = 973;
    let total = 0;
    for (let i = 0; i < 6; i++) {
      const due = computeDualRewardsSubmissionReversalDue({
        submissionRow: {
          id: `sub-${i}`,
          paid: true,
          earnings: 885,
          dual_rewards_payout: { cpm_cents: 1200, milestone_cents: 200 },
        },
        submissionId: `sub-${i}`,
        rewardTxns: [
          { amount: perSubReward, metadata: { submission_id: `sub-${i}` } },
        ],
        refundTxns: [],
        reversalRemark,
        wasPaidBeforeReversal: true,
      });
      total += due.totalCents;
    }
    assert.equal(total, perSubReward * 6);
    assert.ok(total < 8172);
  });

  it("caps due by recorded grant when ledger net exceeds submission row", () => {
    const due = computeDualRewardsSubmissionReversalDue({
      submissionRow: {
        id: "sub-1",
        paid: true,
        earnings: 5750,
        bonus_paid: false,
        dual_rewards_payout: { cpm_cents: 5310, milestone_cents: 440 },
      },
      submissionId: "sub-1",
      rewardTxns: [
        { amount: 3000, metadata: { submission_id: "sub-1" } },
        { amount: 3000, metadata: { submission_id: "sub-1" } },
      ],
      refundTxns: [
        {
          amount: 250,
          remarks: reversalRemark,
          metadata: { submission_id: "sub-1" },
        },
      ],
      reversalRemark,
      wasPaidBeforeReversal: true,
    });
    assert.equal(due.totalCents, 5750);
  });
});

describe("scaleDualReversalDuesToTotalCap", () => {
  it("scales six submission dues down to withdrawable balance", () => {
    const dues = new Map<string, ReturnType<typeof computeDualRewardsSubmissionReversalDue>>();
    for (let i = 0; i < 6; i++) {
      dues.set(`sub-${i}`, {
        totalCents: 1087,
        mainCents: 1000,
        bonusCents: 87,
        bonusReversals: [{ bonusType: "milestone", amount: 87 }],
      });
    }
    const scaled = scaleDualReversalDuesToTotalCap(dues, 5750);
    let sum = 0;
    for (const due of scaled.values()) {
      sum += due.totalCents;
    }
    assert.equal(sum, 5750);
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
