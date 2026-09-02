import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildMilestoneMostVerifiedBonusByCreatorMap } from "./milestone-contest-expected-spend";

const bonusConfig = {
  enabled: true,
  most_verified_views: {
    payout_cents: 1000,
    min_total_views: 1,
    min_verified_reels: 1,
  },
  most_verified_reels: {
    payout_cents: 1000,
    min_verified_reels: 1,
    min_total_views: 0,
  },
};

describe("buildMilestoneMostVerifiedBonusByCreatorMap granted vs expected", () => {
  it("does not infer views granted from reels-only bonus_paid when creator is views winner", () => {
    const map = buildMilestoneMostVerifiedBonusByCreatorMap(
      [
        {
          id: "sub-a",
          creator_id: "creator-a",
          created_at: "2026-01-01T00:00:00.000Z",
          status: "verified",
          views: 5000,
          bonus_paid: true,
          bonus_amount: 1000,
          milestone_bonus_paid: { views: 0, reels: 1000 },
        },
        {
          id: "sub-b",
          creator_id: "creator-b",
          created_at: "2026-01-02T00:00:00.000Z",
          status: "verified",
          views: 100,
          bonus_paid: false,
          bonus_amount: 0,
        },
      ],
      bonusConfig,
    );

    const winner = map.get("creator-a");
    assert.ok(winner);
    assert.equal(winner.viewsExpectedCents, 1000);
    assert.equal(winner.viewsPaidCents, 0);
    assert.equal(winner.paidCents, 1000);
  });

  it("shows views granted from ledger even when creator is no longer the views winner", () => {
    const map = buildMilestoneMostVerifiedBonusByCreatorMap(
      [
        {
          id: "sub-a",
          creator_id: "creator-a",
          created_at: "2026-01-01T00:00:00.000Z",
          status: "pending",
          views: 5000,
          bonus_paid: false,
          bonus_amount: 0,
        },
        {
          id: "sub-b",
          creator_id: "creator-b",
          created_at: "2026-01-02T00:00:00.000Z",
          status: "verified",
          views: 100,
          bonus_paid: false,
          bonus_amount: 0,
        },
      ],
      bonusConfig,
      {
        "creator-a": { viewsPaidCents: 1000, reelsPaidCents: 0 },
      },
    );

    const formerWinner = map.get("creator-a");
    const newWinner = map.get("creator-b");

    assert.ok(formerWinner);
    assert.ok(newWinner);
    assert.equal(formerWinner.viewsExpectedCents, 0);
    assert.equal(formerWinner.viewsPaidCents, 1000);
    assert.equal(newWinner.viewsExpectedCents, 1000);
    assert.equal(newWinner.viewsPaidCents, 0);
  });
});
