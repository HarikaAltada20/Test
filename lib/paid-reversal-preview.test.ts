import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizePaidReversalPreview } from "./paid-reversal-preview";

describe("summarizePaidReversalPreview", () => {
  it("splits milestone ladder from dual_rewards_payout JSON", () => {
    const submissions = [
      {
        id: "sub-1",
        status: "paid",
        paid: true,
        earnings: 1500,
        bonus_paid: false,
        dual_rewards_payout: {
          cpm_cents: 1000,
          milestone_cents: 500,
        },
      },
    ];
    const preview = summarizePaidReversalPreview(submissions, ["sub-1"]);
    assert.equal(preview.rewardCents, 1000);
    assert.equal(preview.bonusCents, 500);
    assert.equal(preview.mostVerifiedBonusCents, 0);
    assert.equal(preview.totalCents, 1500);
  });

  it("keeps standard paid earnings in reward granted (not milestone split)", () => {
    const submissions = [
      {
        id: "sub-paid",
        status: "paid",
        paid: true,
        earnings: 2678,
        bonus_paid: false,
        creator_id: "creator-1",
      },
    ];
    const preview = summarizePaidReversalPreview(submissions, ["sub-paid"]);
    assert.equal(preview.rewardCents, 2678);
    assert.equal(preview.bonusCents, 0);
    assert.equal(preview.mostVerifiedBonusCents, 0);
    assert.equal(preview.totalCents, 2678);
  });

  it("includes most-verified bonus once per creator", () => {
    const submissions = [
      {
        id: "sub-a",
        status: "paid",
        paid: true,
        earnings: 1000,
        creator_id: "creator-1",
        milestone_bonus_paid: { views: 1000, reels: 0 },
      },
      {
        id: "sub-b",
        status: "paid",
        paid: true,
        earnings: 500,
        creator_id: "creator-1",
        milestone_bonus_paid: { views: 1000, reels: 0 },
      },
    ];
    const preview = summarizePaidReversalPreview(submissions, [
      "sub-a",
      "sub-b",
    ]);
    assert.equal(preview.rewardCents, 1500);
    assert.equal(preview.mostVerifiedBonusCents, 1000);
    assert.equal(preview.totalCents, 2500);
  });

  it("counts milestone ladder from bonus_paid when no payout JSON", () => {
    const submissions = [
      {
        id: "sub-2",
        status: "paid",
        paid: true,
        earnings: 2000,
        bonus_paid: true,
        bonus_amount: 750,
      },
    ];
    const preview = summarizePaidReversalPreview(submissions, ["sub-2"]);
    assert.equal(preview.rewardCents, 2000);
    assert.equal(preview.bonusCents, 750);
    assert.equal(preview.mostVerifiedBonusCents, 0);
    assert.equal(preview.totalCents, 2750);
  });

  it("ignores unpaid rows", () => {
    const submissions = [
      {
        id: "sub-3",
        status: "verified",
        paid: false,
        earnings: null,
      },
    ];
    const preview = summarizePaidReversalPreview(submissions, ["sub-3"]);
    assert.equal(preview.paidNonTwitterCount, 0);
    assert.equal(preview.totalCents, 0);
  });
});
