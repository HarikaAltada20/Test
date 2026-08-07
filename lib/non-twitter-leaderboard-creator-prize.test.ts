import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyCreatorMaxEarningsCapCents,
  buildLeaderboardPrizeCentsBySubmissionId,
  isLeaderboardRankingEligibleStatus,
  isTwitterTextImageLeaderboardContest,
  prizeCentsForLeaderboardRank,
  rankLeaderboardSubmissionsByViews,
  sumPaidEarningsCents,
} from "./non-twitter-leaderboard-creator-prize";

describe("non-twitter leaderboard submission ranking", () => {
  it("filters ranking eligibility to verified/approved/paid", () => {
    assert.equal(isLeaderboardRankingEligibleStatus("verified"), true);
    assert.equal(isLeaderboardRankingEligibleStatus("approved"), true);
    assert.equal(isLeaderboardRankingEligibleStatus("paid"), true);
    assert.equal(isLeaderboardRankingEligibleStatus("pending"), false);
    assert.equal(isLeaderboardRankingEligibleStatus("rejected"), false);
    assert.equal(isLeaderboardRankingEligibleStatus("pending", true), true);
  });

  it("ranks by views descending with stable submission id tie-break", () => {
    const ranked = rankLeaderboardSubmissionsByViews([
      { id: "s3", views: 200, status: "verified" },
      { id: "s1", views: 500, status: "verified" },
      { id: "s2", views: 200, status: "paid" },
      { id: "s4", views: 100, status: "pending" },
      { id: "s5", views: 50, status: "approved" },
    ]);
    assert.deepEqual(
      ranked.map((r) => r.id),
      ["s1", "s2", "s3", "s5"],
    );
  });

  it("maps each submission id to its rank prize", () => {
    const prizes = [
      { position: 1, amount: 10000 },
      { position: 2, amount: 5000 },
    ];
    const map = buildLeaderboardPrizeCentsBySubmissionId(
      [
        { id: "a", views: 100, status: "verified" },
        { id: "b", views: 300, status: "verified" },
        { id: "c", views: 200, status: "paid" },
        { id: "d", views: 50, status: "pending" },
      ],
      prizes,
    );
    assert.equal(map.get("b"), 10000);
    assert.equal(map.get("c"), 5000);
    assert.equal(map.get("a"), 0);
    assert.equal(map.has("d"), false);
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

  it("detects Twitter text/image leaderboard contests", () => {
    assert.equal(
      isTwitterTextImageLeaderboardContest({
        contest_type: "leaderboard",
        platform: "twitter",
        contest_format: "text_image",
      }),
      true,
    );
    assert.equal(
      isTwitterTextImageLeaderboardContest({
        contest_type: "leaderboard",
        platform: "x",
        contest_format: "text_image",
      }),
      true,
    );
    assert.equal(
      isTwitterTextImageLeaderboardContest({
        contest_type: "leaderboard",
        platform: "instagram",
        contest_format: "video",
      }),
      false,
    );
    assert.equal(
      isTwitterTextImageLeaderboardContest({
        contest_type: "cpm",
        platform: "twitter",
        contest_format: "text_image",
      }),
      false,
    );
  });

  it("sums paid earnings only and clamps negatives", () => {
    assert.equal(
      sumPaidEarningsCents([
        { paid: true, earnings: 1000 },
        { paid: false, earnings: 500 },
        { paid: true, earnings: 250 },
        { paid: true, earnings: -100 },
      ]),
      1250,
    );
  });

  it("applies creator max-earnings remaining cap", () => {
    assert.equal(
      applyCreatorMaxEarningsCapCents({
        amountCents: 5000,
        alreadyPaidCents: 2000,
        maxEarningsCents: 4000,
      }),
      2000,
    );
    assert.equal(
      applyCreatorMaxEarningsCapCents({
        amountCents: 500,
        alreadyPaidCents: 2000,
        maxEarningsCents: 4000,
      }),
      500,
    );
    assert.equal(
      applyCreatorMaxEarningsCapCents({
        amountCents: 5000,
        alreadyPaidCents: 4000,
        maxEarningsCents: 4000,
      }),
      0,
    );
    assert.equal(
      applyCreatorMaxEarningsCapCents({
        amountCents: 5000,
        alreadyPaidCents: 0,
        maxEarningsCents: null,
      }),
      5000,
    );
  });
});
