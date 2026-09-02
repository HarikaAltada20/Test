import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeMostVerifiedBonusPaidByTrack,
  mvBonusTrackPaidCentsOnSubmission,
  shouldReconcileMvBonusTrackWithoutDebit,
} from "./milestone-most-verified-bonus-clawback";
import { REVERSAL_TRANSACTION_REMARK } from "./payment-utils";

describe("computeMostVerifiedBonusPaidByTrack", () => {
  it("returns net paid per views and reels tracks", () => {
    const paid = computeMostVerifiedBonusPaidByTrack(
      [
        {
          amount: 1000,
          metadata: { bonus_type: "milestone_most_verified_views" },
        },
        {
          amount: 500,
          metadata: { bonus_type: "milestone_most_verified_reels" },
        },
      ],
      [
        {
          amount: 200,
          remarks: REVERSAL_TRANSACTION_REMARK,
          metadata: { bonus_type: "milestone_most_verified_views" },
        },
      ],
    );
    assert.equal(paid.views, 800);
    assert.equal(paid.reels, 500);
  });

  it("ignores refunds with non-reversal remarks", () => {
    const paid = computeMostVerifiedBonusPaidByTrack(
      [
        {
          amount: 1000,
          metadata: { bonus_type: "milestone_most_verified_reels" },
        },
      ],
      [
        {
          amount: 300,
          remarks: "manual adjustment",
          metadata: { bonus_type: "milestone_most_verified_reels" },
        },
      ],
    );
    assert.equal(paid.reels, 1000);
    assert.equal(paid.views, 0);
  });

  it("never returns negative net amounts", () => {
    const paid = computeMostVerifiedBonusPaidByTrack(
      [
        {
          amount: 100,
          metadata: { bonus_type: "milestone_most_verified_views" },
        },
      ],
      [
        {
          amount: 500,
          remarks: REVERSAL_TRANSACTION_REMARK,
          metadata: { bonus_type: "milestone_most_verified_views" },
        },
      ],
    );
    assert.equal(paid.views, 0);
  });
});

describe("shouldReconcileMvBonusTrackWithoutDebit", () => {
  it("repairs submission flags when ledger is already clawed back", () => {
    assert.equal(shouldReconcileMvBonusTrackWithoutDebit(0, 1000), true);
    assert.equal(shouldReconcileMvBonusTrackWithoutDebit(-1, 500), true);
  });

  it("does not skip the wallet debit when ledger still shows a net paid amount", () => {
    assert.equal(shouldReconcileMvBonusTrackWithoutDebit(800, 1000), false);
    assert.equal(shouldReconcileMvBonusTrackWithoutDebit(0, 0), false);
  });
});

describe("mvBonusTrackPaidCentsOnSubmission", () => {
  it("reads the track amount from milestone_bonus_paid", () => {
    assert.equal(
      mvBonusTrackPaidCentsOnSubmission(
        { milestone_bonus_paid: { views: 1200, reels: 400 }, metadata: null },
        "views",
      ),
      1200,
    );
    assert.equal(
      mvBonusTrackPaidCentsOnSubmission(
        {
          milestone_bonus_paid: null,
          metadata: { milestone_bonus_paid: { views: 0, reels: 350 } },
        },
        "reels",
      ),
      350,
    );
  });
});
