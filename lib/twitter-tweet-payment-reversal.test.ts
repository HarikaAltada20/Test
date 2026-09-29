import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeTwitterTweetReversalDue,
  creatorShareCents,
  isCreatorLevelMainTxn,
  resolveTwitterTweetShareIds,
  type MoneyTxn,
} from "./twitter-tweet-payment-reversal";

const contestId = "contest-1";
const creatorId = "creator-1";

function txn(
  partial: Partial<MoneyTxn> & { metadata?: Record<string, unknown> },
): MoneyTxn {
  return {
    id: partial.id || "tx",
    amount: partial.amount ?? 0,
    remarks: partial.remarks ?? null,
    metadata: {
      contest_id: contestId,
      twitter_creator_id: creatorId,
      ...(partial.metadata || {}),
    },
  };
}

describe("creatorShareCents", () => {
  it("splits remainder by sorted id order", () => {
    assert.equal(creatorShareCents(100, ["b", "a", "c"], "a"), 34);
    assert.equal(creatorShareCents(100, ["b", "a", "c"], "b"), 33);
    assert.equal(creatorShareCents(100, ["b", "a", "c"], "c"), 33);
  });
});

describe("isCreatorLevelMainTxn", () => {
  it("treats pay-twitter-creator rows as creator-level", () => {
    assert.equal(
      isCreatorLevelMainTxn(
        txn({
          amount: 900,
          metadata: { payout_type: "twitter_cpm_creator" },
        }),
      ),
      true,
    );
    assert.equal(
      isCreatorLevelMainTxn(
        txn({
          amount: 900,
          metadata: { payout_type: "standard" },
        }),
      ),
      true,
    );
  });

  it("excludes per-tweet and bulk CPM rows", () => {
    assert.equal(
      isCreatorLevelMainTxn(
        txn({
          amount: 50,
          metadata: { tweet_id: "t1", payout_type: "twitter_cpm_tweet" },
        }),
      ),
      false,
    );
    assert.equal(
      isCreatorLevelMainTxn(
        txn({
          amount: 150,
          metadata: {
            payout_type: "twitter_cpm_bulk",
            cpm_breakdown: { t1: 50, t2: 100 },
          },
        }),
      ),
      false,
    );
  });
});

describe("computeTwitterTweetReversalDue", () => {
  it("allocates creator-level leaderboard/CPM pay across tweets", () => {
    const rewards = [
      txn({
        id: "r1",
        amount: 90,
        metadata: { payout_type: "twitter_cpm_creator" },
      }),
    ];
    const shareIds = ["t1", "t2", "t3"];
    const t1 = computeTwitterTweetReversalDue({
      tweetId: "t1",
      shareIds,
      rewards,
      refunds: [],
    });
    const t2 = computeTwitterTweetReversalDue({
      tweetId: "t2",
      shareIds,
      rewards,
      refunds: [],
    });
    const t3 = computeTwitterTweetReversalDue({
      tweetId: "t3",
      shareIds,
      rewards,
      refunds: [],
    });
    assert.equal(t1.cpmCents + t2.cpmCents + t3.cpmCents, 90);
    assert.equal(t1.totalCents + t2.totalCents + t3.totalCents, 90);
  });

  it("is idempotent after tweet-scoped creator recovery refunds", () => {
    const rewards = [
      txn({
        id: "r1",
        amount: 90,
        metadata: { payout_type: "standard" },
      }),
    ];
    const refunds = [
      txn({
        id: "f1",
        amount: 30,
        remarks: "Forfeited due to status reversal",
        metadata: {
          tweet_id: "t1",
          payout_type: "twitter_cpm_tweet_reversal",
        },
      }),
    ];
    const due = computeTwitterTweetReversalDue({
      tweetId: "t1",
      shareIds: ["t1", "t2", "t3"],
      rewards,
      refunds,
    });
    assert.equal(due.cpmCents, 0);
    assert.equal(due.totalCents, 0);
  });

  it("uses bulk CPM breakdown when present", () => {
    const rewards = [
      txn({
        id: "r1",
        amount: 150,
        metadata: {
          payout_type: "twitter_cpm_bulk",
          cpm_breakdown: { t1: 50, t2: 100 },
        },
      }),
    ];
    const due = computeTwitterTweetReversalDue({
      tweetId: "t1",
      shareIds: ["t1", "t2"],
      rewards,
      refunds: [],
    });
    assert.equal(due.cpmCents, 50);
  });

  it("falls back to stored earnings when the ledger has no contest rows", () => {
    const due = computeTwitterTweetReversalDue({
      tweetId: "t1",
      shareIds: ["t1"],
      rewards: [],
      refunds: [],
      storedCpmCents: 40,
    });
    assert.equal(due.cpmCents, 40);
  });
});

describe("resolveTwitterTweetShareIds", () => {
  it("includes non-rejected creator tweets and the current tweet", () => {
    const ids = resolveTwitterTweetShareIds({
      tweetId: "t1",
      creatorTweets: [
        { id: "t1", moderation_status: "verified", earnings: null },
        { id: "t2", moderation_status: "pending", earnings: null },
        { id: "t3", moderation_status: "rejected", earnings: null },
      ],
    });
    assert.deepEqual(ids, ["t1", "t2"]);
  });
});
