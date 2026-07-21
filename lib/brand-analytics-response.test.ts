import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  BrandAnalyticsBundle,
  BrandAnalyticsCreatorsBundle,
  BrandAnalyticsQueryContext,
} from "@/lib/brand-analytics-cache";
import {
  buildBrandContestsResponse,
  buildBrandCreatorsResponse,
  buildBrandDetailedResponse,
  buildBrandOverviewResponse,
} from "@/lib/brand-analytics-response";

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
    twitterAnalytics: true,
    contestTypeSet: null,
    contestIdSet: null,
    submissionStatus: null,
    notRejected: false,
    ...overrides,
  };
}

function baseBundle(
  overrides: Partial<BrandAnalyticsBundle> = {},
): BrandAnalyticsBundle {
  return {
    ctx: baseCtx(),
    allBrandContests: [],
    scopedContests: [],
    videoContestIds: [],
    twitterContestIds: ["tw-contest-1"],
    dailyRows: [
      {
        day_key: "2026-06-15",
        status: "verified",
        submission_count: 5,
        views_sum: 500,
        likes_sum: 0,
        comments_sum: 0,
        shares_sum: 0,
        payouts_cents_sum: 0,
      },
      {
        day_key: "2026-06-15",
        status: "paid",
        submission_count: 2,
        views_sum: 200,
        likes_sum: 0,
        comments_sum: 0,
        shares_sum: 0,
        payouts_cents_sum: 0,
      },
    ],
    contestRollup: [],
    twitterDaily: [
      {
        day_key: "2026-06-15",
        status: "verified",
        submission_count: 3,
        views_sum: 300,
        likes_sum: 0,
        comments_sum: 0,
        shares_sum: 0,
        quote_reposts_sum: 0,
      },
      {
        day_key: "2026-06-15",
        status: "pending",
        submission_count: 1,
        views_sum: 100,
        likes_sum: 0,
        comments_sum: 0,
        shares_sum: 0,
        quote_reposts_sum: 0,
      },
    ],
    twitterContestRollup: [],
    pcContestIds: [],
    ...overrides,
  };
}

describe("buildBrandOverviewResponse", () => {
  it("includes Twitter views and payouts in effective CPM", () => {
    const bundle = baseBundle({
      dailyRows: [],
      twitterDaily: [
        {
          day_key: "2026-06-15",
          status: "verified",
          submission_count: 3,
          views_sum: 4500,
          likes_sum: 0,
          comments_sum: 0,
          shares_sum: 0,
          quote_reposts_sum: 0,
        },
      ],
      allBrandContests: [
        {
          id: "tw-contest-1",
          title: "Twitter Campaign",
          platform: "twitter",
          contest_type: "leaderboard",
          start_date: "2026-06-01T00:00:00.000Z",
          end_date: "2026-06-30T23:59:59.999Z",
          created_at: "2026-06-01T00:00:00.000Z",
          contest_based_details: {
            leaderboard_contest: { total_prize: 100000 },
          },
          moderation_status: "published",
          status: "active",
        },
      ],
      scopedContests: [
        {
          id: "tw-contest-1",
          title: "Twitter Campaign",
          platform: "twitter",
          contest_type: "leaderboard",
          start_date: "2026-06-01T00:00:00.000Z",
          end_date: "2026-06-30T23:59:59.999Z",
          created_at: "2026-06-01T00:00:00.000Z",
          contest_based_details: {
            leaderboard_contest: { total_prize: 100000 },
          },
          moderation_status: "published",
          status: "active",
        },
      ],
      twitterContestRollup: [
        {
          contest_id: "tw-contest-1",
          status: "verified",
          submission_count: 3,
          views_sum: 4500,
          likes_sum: 10,
          comments_sum: 2,
          shares_sum: 1,
          quote_reposts_sum: 0,
        },
      ],
    });

    const response = buildBrandOverviewResponse(bundle, 9990);

    assert.equal(response.overview.totalViews, 4500);
    assert.equal(response.overview.totalPayoutsCents, 9990);
    assert.equal(response.overview.effectiveCpm, 22.2);
  });

  it("excludes video submission counts when Twitter-only is selected", () => {
    const bundle = baseBundle({
      ctx: baseCtx({
        contentType: "text_image",
        twitterAnalytics: true,
        videoPlatform: "all",
      }),
      dailyRows: [
        {
          day_key: "2026-06-15",
          status: "verified",
          submission_count: 99,
          views_sum: 9900,
          likes_sum: 0,
          comments_sum: 0,
          shares_sum: 0,
          payouts_cents_sum: 0,
        },
      ],
      twitterDaily: [
        {
          day_key: "2026-06-15",
          status: "verified",
          submission_count: 4,
          views_sum: 400,
          likes_sum: 0,
          comments_sum: 0,
          shares_sum: 0,
          quote_reposts_sum: 0,
        },
      ],
    });

    const response = buildBrandOverviewResponse(bundle, 0);

    assert.equal(response.overview.totalSubmissions, 4);
    assert.equal(response.overview.totalViews, 400);
    assert.equal(response.overview.verifiedSubmissions, 4);
  });

  it("scopes campaign count tiles to the selected date range", () => {
    const inRangeContest = {
      id: "contest-in-range",
      title: "In Range",
      platform: "youtube",
      contest_type: "cpm",
      start_date: "2026-06-05T00:00:00.000Z",
      end_date: "2026-06-20T00:00:00.000Z",
      created_at: "2026-06-01T00:00:00.000Z",
      contest_based_details: null,
      moderation_status: "published",
      status: "ended",
    };
    const endedBeforeRange = {
      id: "contest-before-range",
      title: "Before Range",
      platform: "youtube",
      contest_type: "cpm",
      start_date: "2026-04-01T00:00:00.000Z",
      end_date: "2026-04-30T00:00:00.000Z",
      created_at: "2026-03-25T00:00:00.000Z",
      contest_based_details: null,
      moderation_status: "published",
      status: "ended",
    };
    const createdAfterRange = {
      id: "contest-after-range",
      title: "After Range",
      platform: "youtube",
      contest_type: "cpm",
      start_date: null,
      end_date: null,
      created_at: "2026-07-10T00:00:00.000Z",
      contest_based_details: null,
      moderation_status: "draft",
      status: "draft",
    };

    const bundle = baseBundle({
      allBrandContests: [inRangeContest, endedBeforeRange, createdAfterRange],
      scopedContests: [inRangeContest, endedBeforeRange, createdAfterRange],
    });

    const response = buildBrandOverviewResponse(bundle, 0);

    assert.equal(response.overview.totalContests, 1);
    assert.equal(response.overview.publishedContests, 1);
    assert.equal(response.overview.draftContests, 0);
  });

  it("only counts campaigns with matching activity when a status filter is active", () => {
    const contestWithPaid = {
      id: "contest-paid",
      title: "Has Paid",
      platform: "youtube",
      contest_type: "cpm",
      start_date: "2026-06-05T00:00:00.000Z",
      end_date: "2026-06-20T00:00:00.000Z",
      created_at: "2026-06-01T00:00:00.000Z",
      contest_based_details: null,
      moderation_status: "published",
      status: "ended",
    };
    const contestWithoutPaid = {
      id: "contest-no-paid",
      title: "No Paid",
      platform: "youtube",
      contest_type: "cpm",
      start_date: "2026-06-05T00:00:00.000Z",
      end_date: "2026-06-20T00:00:00.000Z",
      created_at: "2026-06-01T00:00:00.000Z",
      contest_based_details: null,
      moderation_status: "published",
      status: "ended",
    };

    const bundle = baseBundle({
      ctx: baseCtx({ submissionStatus: "paid" }),
      allBrandContests: [contestWithPaid, contestWithoutPaid],
      scopedContests: [contestWithPaid, contestWithoutPaid],
      contestRollup: [
        {
          contest_id: "contest-paid",
          status: "paid",
          platform: "youtube",
          submission_count: 2,
          views_sum: 100,
          likes_sum: 0,
          comments_sum: 0,
          shares_sum: 0,
          payouts_cents_sum: 0,
        },
        {
          contest_id: "contest-no-paid",
          status: "verified",
          platform: "youtube",
          submission_count: 3,
          views_sum: 300,
          likes_sum: 0,
          comments_sum: 0,
          shares_sum: 0,
          payouts_cents_sum: 0,
        },
      ],
    });

    const response = buildBrandOverviewResponse(bundle, 0);

    assert.equal(response.overview.totalContests, 1);
    assert.equal(response.overview.publishedContests, 1);
  });

  it("uses filtered video payouts when a status filter is active", () => {
    const bundle = baseBundle({
      ctx: baseCtx({ submissionStatus: "paid" }),
      dailyRows: [
        {
          day_key: "2026-06-15",
          status: "paid",
          submission_count: 1,
          views_sum: 200,
          likes_sum: 0,
          comments_sum: 0,
          shares_sum: 0,
          payouts_cents_sum: 5000,
        },
        {
          day_key: "2026-06-15",
          status: "verified",
          submission_count: 1,
          views_sum: 300,
          likes_sum: 0,
          comments_sum: 0,
          shares_sum: 0,
          payouts_cents_sum: 9000,
        },
      ],
      twitterDaily: [],
    });

    const response = buildBrandOverviewResponse(bundle, 0);

    assert.equal(response.overview.totalPayoutsCents, 5000);
  });
});

describe("buildBrandContestsResponse", () => {
  it("returns Twitter campaigns with rollup activity", async () => {
    const bundle = baseBundle({
      allBrandContests: [
        {
          id: "tw-contest-1",
          title: "Twitter Campaign",
          platform: "twitter",
          contest_type: "leaderboard",
          start_date: "2026-06-01T00:00:00.000Z",
          end_date: "2026-06-30T23:59:59.999Z",
          created_at: "2026-06-01T00:00:00.000Z",
          contest_based_details: {
            leaderboard_contest: { total_prize: 100000 },
          },
          moderation_status: "published",
          status: "active",
          post_contest_status: "payouts_processed",
        },
      ],
      twitterContestRollup: [
        {
          contest_id: "tw-contest-1",
          status: "verified",
          submission_count: 2,
          views_sum: 1000,
          likes_sum: 5,
          comments_sum: 1,
          shares_sum: 2,
          quote_reposts_sum: 1,
        },
      ],
    });

    const mockSupabase = {
      rpc: async () => ({
        data: [{ contest_id: "tw-contest-1", paid_cents: 9990 }],
        error: null,
      }),
    };

    const response = await buildBrandContestsResponse(
      bundle,
      mockSupabase as never,
    );

    assert.equal(response.contests.length, 1);
    assert.equal(response.contests[0]?.title, "Twitter Campaign");
    assert.equal(
      (response.contests[0]?.metrics as { totalSubmissions: number })
        .totalSubmissions,
      2,
    );
    assert.equal(response.contests[0]?.live_submission_count, 2);
    assert.equal(
      (response.contests[0]?.budgetTile as { numeratorCents: number })
        ?.numeratorCents,
      9990,
    );
    assert.equal(
      (response.contests[0]?.budgetTile as { denominatorCents: number })
        ?.denominatorCents,
      100000,
    );
  });
});

describe("buildBrandDetailedResponse", () => {
  it("uses Twitter-only counts in twitterStats", () => {
    const bundle = baseBundle();
    const response = buildBrandDetailedResponse(bundle, 0);

    assert.equal(response.twitterStats.verified, 3);
    assert.equal(response.twitterStats.pending, 1);
    assert.equal(response.twitterStats.paid, 0);
    assert.equal(response.overview.verifiedSubmissions, 8);
  });

  it("does not count Twitter retweets as shares", () => {
    const bundle = baseBundle({
      ctx: baseCtx({
        contentType: "text_image",
        twitterAnalytics: true,
        videoPlatform: "all",
      }),
      dailyRows: [],
      twitterDaily: [
        {
          day_key: "2026-06-15",
          status: "verified",
          submission_count: 3,
          views_sum: 4500,
          likes_sum: 0,
          comments_sum: 0,
          shares_sum: 6,
          quote_reposts_sum: 0,
        },
      ],
    });
    const response = buildBrandDetailedResponse(bundle, 0);

    assert.equal(response.overview.totalShares, 0);
    assert.equal(response.twitterStats.retweets, 6);
  });
});

describe("buildBrandCreatorsResponse", () => {
  it("adds Twitter tweet earnings once per creator", async () => {
    const bundle: BrandAnalyticsCreatorsBundle = {
      ...baseBundle(),
      creatorRollup: [],
      twitterCreatorRollup: [
        {
          creator_id: "creator-1",
          contest_type: "leaderboard",
          platform: "twitter",
          status: "verified",
          submission_count: 2,
          views_sum: 100,
          earnings_cents_sum: 0,
          first_created_at: "2026-06-01T00:00:00.000Z",
          last_created_at: "2026-06-10T00:00:00.000Z",
        },
        {
          creator_id: "creator-1",
          contest_type: "leaderboard",
          platform: "twitter",
          status: "paid",
          submission_count: 1,
          views_sum: 50,
          earnings_cents_sum: 0,
          first_created_at: "2026-06-01T00:00:00.000Z",
          last_created_at: "2026-06-20T00:00:00.000Z",
        },
      ],
    };

    const twitterEarningsByCreator = new Map([["creator-1", 5000]]);

    const mockSupabase = {
      from: () => ({
        select: () => ({
          in: async () => ({
            data: [
              {
                id: "creator-1",
                username: "creator_one",
                creator_profiles: null,
              },
            ],
          }),
        }),
      }),
    };

    const response = await buildBrandCreatorsResponse(
      bundle,
      mockSupabase as never,
      20,
      twitterEarningsByCreator,
    );

    assert.equal(response.summary.totalEarnings, 5000);
    assert.equal(response.leaderboards.topByEarnings[0]?.totalEarnings, 5000);
  });

  it("includes creators even when profile fetch returns no row", async () => {
    const bundle: BrandAnalyticsCreatorsBundle = {
      ...baseBundle(),
      creatorRollup: [
        {
          creator_id: "creator-2",
          contest_type: "cpm",
          platform: "youtube",
          status: "verified",
          submission_count: 1,
          views_sum: 42,
          earnings_cents_sum: 100,
          first_created_at: "2026-06-05T00:00:00.000Z",
          last_created_at: "2026-06-05T00:00:00.000Z",
        },
      ],
      twitterCreatorRollup: [],
    };

    const mockSupabase = {
      from: () => ({
        select: () => ({
          in: async () => ({ data: [] }),
        }),
      }),
    };

    const response = await buildBrandCreatorsResponse(
      bundle,
      mockSupabase as never,
      20,
      new Map(),
    );

    assert.equal(response.leaderboards.topByViews.length, 1);
    assert.equal(
      (
        response.leaderboards.topByViews[0]?.creator as
          | { id?: string }
          | undefined
      )?.id,
      "creator-2",
    );
  });
});
