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

  it("returns zero due for verified-only rows with expected earnings but no wallet credit", () => {
    const due = computeDualRewardsSubmissionReversalDue({
      submissionRow: {
        id: "sub-verified",
        paid: false,
        earnings: 4790,
        bonus_paid: false,
        dual_rewards_payout: { cpm_cents: 4790, milestone_cents: 0 },
      },
      submissionId: "sub-verified",
      rewardTxns: [],
      refundTxns: [],
      reversalRemark,
      wasPaidBeforeReversal: false,
    });
    assert.equal(due.totalCents, 0);
    assert.equal(due.mainCents, 0);
    assert.equal(due.bonusCents, 0);
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

  it("recognizes consolidated dual-rewards reward rows when computing reversal due", () => {
    const due = computeDualRewardsSubmissionReversalDue({
      submissionRow: {
        id: "sub-1",
        paid: true,
        earnings: 900,
        bonus_paid: true,
        bonus_amount: 90,
        dual_rewards_payout: { cpm_cents: 900, milestone_cents: 90 },
      },
      submissionId: "sub-1",
      rewardTxns: [
        {
          amount: 990,
          metadata: {
            submission_id: "sub-1",
            contest_id: "c1",
            cpm_cents: 900,
            milestone_cents: 90,
            dual_rewards_reward: true,
          },
        },
      ],
      refundTxns: [],
      reversalRemark,
      wasPaidBeforeReversal: true,
    });
    assert.equal(due.totalCents, 990);
    assert.equal(due.mainCents, 900);
    assert.equal(due.bonusCents, 90);
  });

  it("recognizes bulk dual-rewards refund breakdown when computing remaining due", () => {
    const due = computeDualRewardsSubmissionReversalDue({
      submissionRow: {
        id: "sub-1",
        paid: true,
        earnings: 900,
        bonus_paid: true,
        bonus_amount: 90,
        dual_rewards_payout: { cpm_cents: 900, milestone_cents: 90 },
      },
      submissionId: "sub-1",
      rewardTxns: [
        {
          amount: 1980,
          metadata: {
            contest_id: "c1",
            dual_rewards_reward: true,
            bulk_dual_rewards_payment: true,
            breakdown: [
              { submission_id: "sub-1", cpm_cents: 900, milestone_cents: 90 },
              { submission_id: "sub-2", cpm_cents: 800, milestone_cents: 190 },
            ],
          },
        },
      ],
      refundTxns: [
        {
          amount: 1980,
          remarks: reversalRemark,
          metadata: {
            contest_id: "c1",
            dual_rewards_reversal: true,
            bulk_dual_rewards_reversal: true,
            breakdown: [
              { submission_id: "sub-1", cpm_cents: 900, milestone_cents: 90 },
              { submission_id: "sub-2", cpm_cents: 800, milestone_cents: 190 },
            ],
          },
        },
      ],
      reversalRemark,
      wasPaidBeforeReversal: true,
    });
    assert.equal(due.totalCents, 0);
  });

  it("recognizes cpm bulk payment breakdown (cpm_amount / bonus_amount)", () => {
    const due = computeDualRewardsSubmissionReversalDue({
      submissionRow: {
        id: "sub-1",
        paid: true,
        earnings: 320,
        bonus_paid: false,
        bonus_amount: 0,
      },
      submissionId: "sub-1",
      rewardTxns: [
        {
          amount: 2520,
          metadata: {
            contest_id: "c1",
            breakdown: [
              { submission_id: "sub-1", cpm_amount: 320, bonus_amount: 0 },
              { submission_id: "sub-2", cpm_amount: 400, bonus_amount: 0 },
            ],
          },
        },
      ],
      refundTxns: [],
      reversalRemark,
      wasPaidBeforeReversal: true,
    });
    assert.equal(due.totalCents, 320);
    assert.equal(due.mainCents, 320);
    assert.equal(due.bonusCents, 0);
  });

  it("recognizes milestone bulk payment breakdown (milestone_cents / bonus_cents)", () => {
    const due = computeDualRewardsSubmissionReversalDue({
      submissionRow: {
        id: "sub-1",
        paid: true,
        earnings: 400,
        bonus_paid: false,
        bonus_amount: 0,
      },
      submissionId: "sub-1",
      rewardTxns: [
        {
          amount: 2000,
          metadata: {
            contest_id: "c1",
            total_milestone: 2000,
            breakdown: [
              { submission_id: "sub-1", milestone_cents: 400, bonus_cents: 0 },
              { submission_id: "sub-2", milestone_cents: 1600, bonus_cents: 0 },
            ],
          },
        },
      ],
      refundTxns: [],
      reversalRemark,
      wasPaidBeforeReversal: true,
    });
    assert.equal(due.totalCents, 400);
    assert.equal(due.mainCents, 400);
    assert.equal(due.bonusCents, 0);
  });

  it("recognizes milestone bulk refund breakdown when computing remaining due", () => {
    const due = computeDualRewardsSubmissionReversalDue({
      submissionRow: {
        id: "sub-1",
        paid: true,
        earnings: 400,
        bonus_paid: false,
        bonus_amount: 0,
      },
      submissionId: "sub-1",
      rewardTxns: [
        {
          amount: 2000,
          metadata: {
            contest_id: "c1",
            breakdown: [
              { submission_id: "sub-1", milestone_cents: 400, bonus_cents: 0 },
              { submission_id: "sub-2", milestone_cents: 1600, bonus_cents: 0 },
            ],
          },
        },
      ],
      refundTxns: [
        {
          amount: 2000,
          remarks: reversalRemark,
          metadata: {
            contest_id: "c1",
            bulk_payment_reversal: true,
            milestone_refunded_cents: 2000,
            bonus_refunded_cents: 0,
            breakdown: [
              { submission_id: "sub-1", milestone_cents: 400, bonus_cents: 0 },
              { submission_id: "sub-2", milestone_cents: 1600, bonus_cents: 0 },
            ],
          },
        },
      ],
      reversalRemark,
      wasPaidBeforeReversal: true,
    });
    assert.equal(due.totalCents, 0);
  });

  it("recognizes consolidated dual-rewards refund rows when computing remaining due", () => {
    const due = computeDualRewardsSubmissionReversalDue({
      submissionRow: {
        id: "sub-1",
        paid: true,
        earnings: 900,
        bonus_paid: true,
        bonus_amount: 90,
        dual_rewards_payout: { cpm_cents: 900, milestone_cents: 90 },
      },
      submissionId: "sub-1",
      rewardTxns: [
        {
          amount: 900,
          metadata: { submission_id: "sub-1", contest_id: "c1" },
        },
        {
          amount: 90,
          metadata: {
            submission_id: "sub-1",
            contest_id: "c1",
            payout_component: "milestone",
          },
        },
      ],
      refundTxns: [
        {
          amount: 990,
          remarks: reversalRemark,
          metadata: {
            submission_id: "sub-1",
            contest_id: "c1",
            cpm_refunded_cents: 900,
            milestone_refunded_cents: 90,
            dual_rewards_reversal: true,
          },
        },
      ],
      reversalRemark,
      wasPaidBeforeReversal: true,
    });
    assert.equal(due.totalCents, 0);
    assert.equal(due.mainCents, 0);
    assert.equal(due.bonusCents, 0);
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
