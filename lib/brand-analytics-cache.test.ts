import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { twitterContestIdsWithRollupActivity } from "@/lib/brand-analytics-cache";

describe("twitterContestIdsWithRollupActivity", () => {
  it("returns unique contest ids with submission activity", () => {
    const ids = twitterContestIdsWithRollupActivity([
      {
        contest_id: "a",
        status: "verified",
        submission_count: 2,
        views_sum: 10,
        likes_sum: 0,
        comments_sum: 0,
        shares_sum: 0,
        quote_reposts_sum: 0,
      },
      {
        contest_id: "a",
        status: "pending",
        submission_count: 0,
        views_sum: 0,
        likes_sum: 0,
        comments_sum: 0,
        shares_sum: 0,
        quote_reposts_sum: 0,
      },
      {
        contest_id: "b",
        status: "verified",
        submission_count: 1,
        views_sum: 5,
        likes_sum: 0,
        comments_sum: 0,
        shares_sum: 0,
        quote_reposts_sum: 0,
      },
    ]);

    assert.deepEqual(ids.sort(), ["a", "b"]);
  });
});
