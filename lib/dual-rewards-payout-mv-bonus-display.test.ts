import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSubmissionPaidReversalUpdate,
  excludeMostVerifiedBonusFromPaidTotalCents,
  getCpmGrantedCentsFromSubmission,
  getMilestoneLadderGrantedCentsFromSubmission,
  getMostVerifiedBonusPaidCentsFromSubmission,
  tryDualRewardGrantedBreakdownFromStoredPayout,
} from "./dual-rewards-payout";

describe("getMostVerifiedBonusPaidCentsFromSubmission", () => {
  it("sums views and reels from milestone_bonus_paid", () => {
    const paid = getMostVerifiedBonusPaidCentsFromSubmission({
      milestone_bonus_paid: { views: 90, reels: 90 },
    });
    assert.equal(paid.viewsCents, 90);
    assert.equal(paid.reelsCents, 90);
    assert.equal(paid.totalCents, 180);
  });
});

describe("getMilestoneLadderGrantedCentsFromSubmission", () => {
  it("excludes most-verified bonus from dual_rewards_payout milestone cents", () => {
    const ladder = getMilestoneLadderGrantedCentsFromSubmission({
      bonus_paid: true,
      bonus_amount: 180,
      milestone_bonus_paid: { views: 90, reels: 90 },
      dual_rewards_payout: { cpm_cents: 0, milestone_cents: 180 },
    });
    assert.equal(ladder, 0);
  });

  it("returns ladder-only cents when both ladder and most-verified are paid", () => {
    const ladder = getMilestoneLadderGrantedCentsFromSubmission({
      bonus_paid: true,
      bonus_amount: 680,
      milestone_bonus_paid: { views: 90, reels: 90 },
      dual_rewards_payout: { cpm_cents: 0, milestone_cents: 680 },
    });
    assert.equal(ladder, 500);
  });

  it("falls back to bonus_amount minus most-verified when JSON is missing", () => {
    const ladder = getMilestoneLadderGrantedCentsFromSubmission({
      bonus_paid: true,
      bonus_amount: 275,
      milestone_bonus_paid: { views: 90, reels: 0 },
    });
    assert.equal(ladder, 185);
  });
});

describe("getCpmGrantedCentsFromSubmission", () => {
  it("reads cpm_cents from dual_rewards_payout JSON", () => {
    const cpm = getCpmGrantedCentsFromSubmission({
      dual_rewards_payout: { cpm_cents: 7662, milestone_cents: 1106 },
    });
    assert.equal(cpm, 7662);
  });
});

describe("tryDualRewardGrantedBreakdownFromStoredPayout", () => {
  it("excludes most-verified bonus from Reward Granted totals", () => {
    const breakdown = tryDualRewardGrantedBreakdownFromStoredPayout({
      paid: true,
      bonus_paid: true,
      dual_rewards_payout: { cpm_cents: 7662, milestone_cents: 1106 },
      milestone_bonus_paid: { views: 170, reels: 0 },
    });
    assert.ok(breakdown);
    assert.equal(breakdown!.cpmCents, 7662);
    assert.equal(breakdown!.milestoneCents, 936);
    assert.equal(breakdown!.totalCents, 8598);
    assert.equal(breakdown!.isPaid, true);
  });
});

describe("excludeMostVerifiedBonusFromPaidTotalCents", () => {
  it("subtracts most-verified paid cents before legacy split", () => {
    const adjusted = excludeMostVerifiedBonusFromPaidTotalCents(8768, {
      milestone_bonus_paid: { views: 170, reels: 0 },
    });
    assert.equal(adjusted, 8598);
  });
});

describe("buildSubmissionPaidReversalUpdate", () => {
  it("preserves most-verified bonus when reversing CPM-only paid submission", () => {
    const update = buildSubmissionPaidReversalUpdate(
      {
        paid: true,
        paid_at: "2026-01-01T00:00:00.000Z",
        earnings: 7662,
        bonus_paid: true,
        bonus_paid_at: "2026-01-02T00:00:00.000Z",
        bonus_amount: 11060,
        milestone_bonus_paid: { views: 0, reels: 10000 },
        dual_rewards_payout: { cpm_cents: 7662, milestone_cents: 11060 },
      },
      { mainCents: 7662, bonusCents: 0, bonusReversals: [] },
    );

    assert.equal(update.paid, false);
    assert.equal(update.earnings, null);
    assert.equal(update.bonus_paid, true);
    assert.equal(update.bonus_amount, 10000);
    assert.deepEqual(update.milestone_bonus_paid, { views: 0, reels: 10000 });
    assert.deepEqual(update.dual_rewards_payout, {
      cpm_cents: 0,
      milestone_cents: 10000,
    });
  });

  it("clears ladder bonus but keeps most-verified tracks on full submission reversal", () => {
    const update = buildSubmissionPaidReversalUpdate(
      {
        paid: true,
        earnings: 5000,
        bonus_paid: true,
        bonus_amount: 600,
        milestone_bonus_paid: { views: 100, reels: 100 },
        dual_rewards_payout: { cpm_cents: 5000, milestone_cents: 600 },
      },
      {
        mainCents: 5000,
        bonusCents: 400,
        bonusReversals: [{ bonusType: "milestone", amount: 400 }],
      },
    );

    assert.equal(update.paid, false);
    assert.equal(update.bonus_paid, true);
    assert.equal(update.bonus_amount, 200);
    assert.deepEqual(update.milestone_bonus_paid, { views: 100, reels: 100 });
    assert.deepEqual(update.dual_rewards_payout, {
      cpm_cents: 0,
      milestone_cents: 200,
    });
  });

  it("decrements most-verified tracks when explicitly reversed", () => {
    const update = buildSubmissionPaidReversalUpdate(
      {
        bonus_paid: true,
        bonus_amount: 200,
        milestone_bonus_paid: { views: 100, reels: 100 },
      },
      {
        mainCents: 0,
        bonusCents: 100,
        bonusReversals: [
          { bonusType: "milestone_most_verified_views", amount: 100 },
        ],
      },
    );

    assert.equal(update.bonus_paid, true);
    assert.equal(update.bonus_amount, 100);
    assert.deepEqual(update.milestone_bonus_paid, { views: 0, reels: 100 });
  });
});
