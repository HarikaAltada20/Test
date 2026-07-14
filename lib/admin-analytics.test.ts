import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateAdminAnalyticsFromDailyRows,
  type AdminAnalyticsContest,
  type AdminAnalyticsDailyAggregateRow,
} from "@/lib/admin-analytics";

const baseContest: AdminAnalyticsContest = {
  id: "c1",
  title: "Test",
  platform: "youtube",
  contest_type: "cpm",
  contest_based_details: null,
  payment_details: null,
  moderation_status: "approved",
  start_date: "2026-01-01T00:00:00.000Z",
  end_date: "2026-12-31T00:00:00.000Z",
  advertiser_id: "a1",
};

describe("aggregateAdminAnalyticsFromDailyRows", () => {
  it("sums views across statuses and respects status filter for chart series", () => {
    const dailyRows: AdminAnalyticsDailyAggregateRow[] = [
      {
        day_key: "2026-06-01",
        contest_id: "c1",
        status: "pending",
        submission_count: 2,
        views_sum: 100,
        likes_sum: 10,
        comments_sum: 1,
        shares_sum: 0,
        payout_cents_sum: 0,
        approved_count: 0,
      },
      {
        day_key: "2026-06-01",
        contest_id: "c1",
        status: "paid",
        submission_count: 1,
        views_sum: 900,
        likes_sum: 50,
        comments_sum: 5,
        shares_sum: 2,
        payout_cents_sum: 500,
        approved_count: 1,
      },
    ];

    const result = aggregateAdminAnalyticsFromDailyRows({
      contests: [baseContest],
      dailyRows,
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-02T00:00:00.000Z"),
      platforms: ["youtube"],
      contestTypes: ["cpm"],
      contestIds: null,
      advertiserIds: null,
      statuses: ["paid"],
    });

    assert.equal(result.viewsByStatus.all, 1000);
    assert.equal(result.viewsByStatus.pending, 100);
    assert.equal(result.viewsByStatus.paid, 900);
    assert.equal(result.summary.filteredViews, 900);
    assert.equal(result.summary.likes, 50);
    assert.equal(result.summary.totalPayoutsCents, 500);
    assert.equal(result.summary.totalSubmissions, 1);
    assert.equal(result.summary.approvedSubmissions, 1);
    assert.equal(result.series[0]?.views, 900);
    assert.equal(result.series[0]?.pendingViews, 100);
  });

  it("handles multi-billion view sums without losing precision as numbers", () => {
    const tenBillion = 10_000_000_000;
    const dailyRows: AdminAnalyticsDailyAggregateRow[] = [
      {
        day_key: "2026-06-01",
        contest_id: "c1",
        status: "verified",
        submission_count: 1,
        views_sum: tenBillion,
        likes_sum: 0,
        comments_sum: 0,
        shares_sum: 0,
        payout_cents_sum: 0,
        approved_count: 1,
      },
    ];

    const result = aggregateAdminAnalyticsFromDailyRows({
      contests: [baseContest],
      dailyRows,
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-01T23:59:59.000Z"),
      platforms: ["youtube"],
      contestTypes: ["cpm"],
      contestIds: null,
      statuses: ["verified"],
    });

    assert.equal(result.summary.views, tenBillion);
    assert.equal(result.summary.filteredViews, tenBillion);
    assert.equal(result.series.at(-1)?.views, tenBillion);
  });
});
