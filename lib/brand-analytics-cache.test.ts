import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  creatorHasScopedRollupActivity,
  twitterContestIdsWithRollupActivity,
  type BrandCreatorRollupRow,
  type BrandAnalyticsQueryContext,
} from "@/lib/brand-analytics-cache";

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

function baseCtx(
  overrides: Partial<BrandAnalyticsQueryContext> = {},
): BrandAnalyticsQueryContext {
  return {
    advertiserId: "adv-1",
    dateFrom: new Date("2026-06-01T00:00:00.000Z"),
    dateTo: new Date("2026-06-30T23:59:59.999Z"),
    dataSource: "submissions",
    contentType: "video",
    videoPlatform: "all",
    tiktokAnalytics: true,
    twitterAnalytics: false,
    contestTypeSet: null,
    contestIdSet: null,
    submissionStatus: null,
    notRejected: false,
    ...overrides,
  };
}

describe("creatorHasScopedRollupActivity", () => {
  it("returns true when creator has matching rollup rows", () => {
    const bundle = {
      creatorRollup: [
        {
          creator_id: "creator-1",
          contest_type: "cpm",
          platform: "youtube",
          status: "verified",
          submission_count: 2,
          views_sum: 100,
          earnings_cents_sum: 0,
          first_created_at: null,
          last_created_at: null,
        } satisfies BrandCreatorRollupRow,
      ],
      twitterCreatorRollup: [] as BrandCreatorRollupRow[],
    };

    assert.equal(
      creatorHasScopedRollupActivity("creator-1", bundle, baseCtx()),
      true,
    );
    assert.equal(
      creatorHasScopedRollupActivity("creator-2", bundle, baseCtx()),
      false,
    );
  });

  it("respects submission status filters", () => {
    const bundle = {
      creatorRollup: [
        {
          creator_id: "creator-1",
          contest_type: "cpm",
          platform: "youtube",
          status: "rejected",
          submission_count: 3,
          views_sum: 100,
          earnings_cents_sum: 0,
          first_created_at: null,
          last_created_at: null,
        } satisfies BrandCreatorRollupRow,
      ],
      twitterCreatorRollup: [] as BrandCreatorRollupRow[],
    };

    assert.equal(
      creatorHasScopedRollupActivity(
        "creator-1",
        bundle,
        baseCtx({ submissionStatus: "verified" }),
      ),
      false,
    );
  });
});
