import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeMostVerifiedBonusPaidByTrack } from "./milestone-most-verified-bonus-clawback";
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
