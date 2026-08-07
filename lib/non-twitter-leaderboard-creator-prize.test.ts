import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  accumulateLeaderboardViewsByCreator,
  applyNonTwitterLeaderboardCreatorPayout,
  buildLeaderboardCreatorPrizeIdempotencyFields,
  buildLeaderboardCreatorPrizeIdempotencyKey,
  LEADERBOARD_CREATOR_PRIZE_IDEMPOTENCY_PREFIX,
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

  it("builds creator-scoped idempotency fields without submission ids or payment_type", () => {
    const fields = buildLeaderboardCreatorPrizeIdempotencyFields({
      contestId: "contest-1",
      creatorId: "creator-1",
    });
    assert.equal(fields.leaderboard_creator_prize, true);
    assert.equal(fields.contest_id, "contest-1");
    assert.equal(fields.creator_id, "creator-1");
    assert.equal("requested_submission_ids" in fields, false);
    assert.equal("payment_type" in fields, false);
    assert.equal("payout_adjustment_percentage" in fields, false);
  });

  it("builds the same prize key for verify and bulk regardless of payment intent", () => {
    const ledger = {
      generation: 2,
      fingerprint: "abc",
      rewardCount: 1,
      refundCount: 0,
    };
    const keyA = buildLeaderboardCreatorPrizeIdempotencyKey({
      contestId: "contest-1",
      creatorId: "creator-1",
      ledger,
    });
    const keyB = buildLeaderboardCreatorPrizeIdempotencyKey({
      contestId: "contest-1",
      creatorId: "creator-1",
      ledger,
    });
    assert.equal(keyA, keyB);
    assert.ok(keyA.startsWith(LEADERBOARD_CREATOR_PRIZE_IDEMPOTENCY_PREFIX));
    assert.notEqual(
      keyA,
      buildLeaderboardCreatorPrizeIdempotencyKey({
        contestId: "contest-1",
        creatorId: "creator-2",
        ledger,
      }),
    );
  });

  it("changes prize key after ledger generation advances (pay→refund→repay)", () => {
    const before = buildLeaderboardCreatorPrizeIdempotencyKey({
      contestId: "c1",
      creatorId: "u1",
      ledger: {
        generation: 1,
        fingerprint: "f1",
        rewardCount: 1,
        refundCount: 0,
      },
    });
    const afterRefund = buildLeaderboardCreatorPrizeIdempotencyKey({
      contestId: "c1",
      creatorId: "u1",
      ledger: {
        generation: 2,
        fingerprint: "f2",
        rewardCount: 1,
        refundCount: 1,
      },
    });
    assert.notEqual(before, afterRefund);
  });

  it("applyNonTwitterLeaderboardCreatorPayout fails closed when RPC is missing", async () => {
    const supabaseAdmin = {
      rpc: async () => ({
        data: null,
        error: {
          message:
            "function apply_non_twitter_leaderboard_creator_payout does not exist",
          code: "42883",
        },
      }),
    };
    const result = await applyNonTwitterLeaderboardCreatorPayout({
      supabaseAdmin: supabaseAdmin as any,
      contestId: "c1",
      creatorId: "u1",
      prizeCents: 1000,
      earningsSubmissionId: "s1",
      earningsCents: 1000,
    });
    assert.equal(result.ok, false);
    assert.match(result.error || "", /not deployed|migration/i);
  });

  it("applyNonTwitterLeaderboardCreatorPayout fails closed on unexpected RPC payload", async () => {
    const supabaseAdmin = {
      rpc: async () => ({ data: { ok: false }, error: null }),
    };
    const result = await applyNonTwitterLeaderboardCreatorPayout({
      supabaseAdmin: supabaseAdmin as any,
      contestId: "c1",
      creatorId: "u1",
      prizeCents: 1000,
    });
    assert.equal(result.ok, false);
    assert.match(result.error || "", /unexpected result/i);
  });
});
