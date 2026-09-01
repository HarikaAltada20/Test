import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeContestDetailSubmissionStatusCounts } from "./contest-detail-submission-status-counts";

describe("computeContestDetailSubmissionStatusCounts", () => {
  it("counts video submission status after local verify/reject", () => {
    const counts = computeContestDetailSubmissionStatusCounts([
      { status: "pending" },
      { status: "verified" },
      { status: "paid" },
      { status: "rejected" },
      { status: "verified" },
    ]);
    assert.deepEqual(counts, {
      total: 5,
      pending: 1,
      rejected: 1,
      verified: 2,
      paid: 1,
      verified_or_paid: 3,
      not_rejected: 4,
    });
  });

  it("counts uncleared payment on pending status as paid until cleared", () => {
    const counts = computeContestDetailSubmissionStatusCounts([
      { status: "pending", paid: true },
      { status: "pending", paid: false },
      { status: "paid" },
    ]);
    assert.deepEqual(counts, {
      total: 3,
      pending: 1,
      rejected: 0,
      verified: 0,
      paid: 2,
      verified_or_paid: 2,
      not_rejected: 3,
    });
  });

  it("uses moderation_status for Twitter tweets", () => {
    const counts = computeContestDetailSubmissionStatusCounts([
      {
        is_twitter_tweet: true,
        status: "paid",
        moderation_status: "verified",
      },
      {
        is_twitter_tweet: true,
        status: "pending",
        moderation_status: "pending",
      },
      {
        is_twitter_tweet: true,
        moderation_status: "rejected",
      },
    ]);
    assert.deepEqual(counts, {
      total: 3,
      pending: 1,
      rejected: 1,
      verified: 1,
      paid: 0,
      verified_or_paid: 1,
      not_rejected: 2,
    });
  });
});
