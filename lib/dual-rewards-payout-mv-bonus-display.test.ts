import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
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
