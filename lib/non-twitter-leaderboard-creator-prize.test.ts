import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  accumulateLeaderboardViewsByCreator,
  buildLeaderboardCreatorPrizeIdempotencyFields,
  prizeCentsForLeaderboardRank,
  rankCreatorsByTotalViews,
  rankOfCreator,
  sumPaidEarningsCents,
} from "./non-twitter-leaderboard-creator-prize";

describe("non-twitter leaderboard creator ranking", () => {
  it("sums only verified/paid views per creator", () => {
    const views = accumulateLeaderboardViewsByCreator([
      { creator_id: "a", views: 100, status: "verified" },
      { creator_id: "a", views: 50, status: "pending" },
      { creator_id: "a", views: 25, status: "rejected" },
      { creator_id: "b", views: 500, status: "paid" },
      { creator_id: "c", views: 200, status: "verified", paid: true },
    ]);
    assert.equal(views.get("a"), 100);
    assert.equal(views.get("b"), 500);
    assert.equal(views.get("c"), 200);
  });

  it("ranks by total views descending with stable id tie-break", () => {
    const views = new Map([
      ["a", 100],
      ["b", 500],
      ["c", 200],
      ["d", 200],
    ]);
    assert.deepEqual(
      rankCreatorsByTotalViews(views).map(([id]) => id),
      ["b", "c", "d", "a"],
    );
    assert.equal(rankOfCreator(views, "b"), 1);
    assert.equal(rankOfCreator(views, "c"), 2);
    assert.equal(rankOfCreator(views, "d"), 3);
    assert.equal(rankOfCreator(views, "a"), 4);
    assert.equal(rankOfCreator(views, "missing"), null);
  });

  it("maps rank to prize cents", () => {
    const prizes = [
      { position: 1, amount: 10000 },
      { position: 2, amount: 5000 },
    ];
    assert.equal(prizeCentsForLeaderboardRank(prizes, 1), 10000);
    assert.equal(prizeCentsForLeaderboardRank(prizes, 2), 5000);
    assert.equal(prizeCentsForLeaderboardRank(prizes, 3), 0);
    assert.equal(prizeCentsForLeaderboardRank(prizes, null), 0);
  });

  it("sums paid earnings only", () => {
    assert.equal(
      sumPaidEarningsCents([
        { paid: true, earnings: 1000 },
        { paid: false, earnings: 500 },
        { paid: true, earnings: 250 },
      ]),
      1250,
    );
  });

  it("builds creator-scoped idempotency fields without submission ids", () => {
    const fields = buildLeaderboardCreatorPrizeIdempotencyFields({
      contestId: "contest-1",
      creatorId: "creator-1",
      paymentType: "standard",
    });
    assert.equal(fields.leaderboard_creator_prize, true);
    assert.equal(fields.contest_id, "contest-1");
    assert.equal(fields.creator_id, "creator-1");
    assert.equal("requested_submission_ids" in fields, false);
  });
});
