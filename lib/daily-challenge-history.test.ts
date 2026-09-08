import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateRewardsFromSnapshots,
  buildPaginationMeta,
  buildWinnersHistoryFilters,
  formatCategoryLabel,
  formatPeriodLabel,
  isPaidWinnerRow,
  monthToDateBounds,
  parseSnapshotPeriod,
  rankTopCreatorsFromSnapshots,
  resolveDateBounds,
  winnerArchiveStatusCopy,
} from "./daily-challenge-history";

describe("parseSnapshotPeriod", () => {
  it("maps UI and API period aliases", () => {
    assert.equal(parseSnapshotPeriod("today"), "day");
    assert.equal(parseSnapshotPeriod("yesterday"), "day");
    assert.equal(parseSnapshotPeriod("this_week"), "week");
    assert.equal(parseSnapshotPeriod("last_month"), "month");
    assert.equal(parseSnapshotPeriod("daily"), "day");
    assert.equal(parseSnapshotPeriod("invalid"), null);
  });
});

describe("buildWinnersHistoryFilters", () => {
  it("applies defaults and clamps pagination", () => {
    const filters = buildWinnersHistoryFilters({});
    assert.equal(filters.page, 1);
    assert.equal(filters.limit, 10);
    assert.equal(filters.period, null);
  });

  it("parses valid filters from search params", () => {
    const filters = buildWinnersHistoryFilters(
      new URLSearchParams({
        page: "3",
        limit: "25",
        period: "this_week",
        category: "reels",
        event_id: "11111111-1111-4111-8111-111111111111",
        month: "2026-09",
      }),
    );
    assert.equal(filters.page, 3);
    assert.equal(filters.limit, 25);
    assert.equal(filters.period, "week");
    assert.equal(filters.category, "reels");
    assert.equal(filters.eventId, "11111111-1111-4111-8111-111111111111");
    assert.equal(filters.month, "2026-09");
  });

  it("rejects invalid uuids and dates", () => {
    const filters = buildWinnersHistoryFilters({
      event_id: "not-a-uuid",
      from: "09-01-2026",
      limit: "999",
    });
    assert.equal(filters.eventId, null);
    assert.equal(filters.fromDate, null);
    assert.equal(filters.limit, 50);
  });
});

describe("pagination and date bounds", () => {
  it("builds pagination metadata at boundaries", () => {
    assert.deepEqual(buildPaginationMeta(1, 10, 0), {
      page: 1,
      limit: 10,
      totalItems: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    assert.deepEqual(buildPaginationMeta(2, 10, 25), {
      page: 2,
      limit: 10,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it("expands month filters and swaps inverted ranges", () => {
    assert.deepEqual(monthToDateBounds("2026-09"), {
      from: "2026-09-01",
      to: "2026-09-30",
    });
    assert.deepEqual(
      resolveDateBounds({ fromDate: "2026-09-20", toDate: "2026-09-01", month: null }),
      { fromDate: "2026-09-01", toDate: "2026-09-20" },
    );
  });
});

describe("reward aggregation", () => {
  it("ignores unpaid / ineligible rounds", () => {
    assert.equal(
      isPaidWinnerRow({ winner_creator_id: null, is_eligible: true }),
      false,
    );
    const summary = aggregateRewardsFromSnapshots([
      {
        winner_creator_id: null,
        is_eligible: false,
        period: "day",
        prize_minor_units: 5000,
        prize_currency: "INR",
      },
      {
        winner_creator_id: "a",
        is_eligible: true,
        period: "day",
        prize_minor_units: 5000,
        prize_currency: "INR",
      },
      {
        winner_creator_id: "b",
        is_eligible: true,
        period: "week",
        prize_minor_units: 10000,
        prize_currency: "INR",
      },
      {
        winner_creator_id: "a",
        is_eligible: true,
        period: "month",
        prize_minor_units: 20000,
        prize_currency: "INR",
      },
    ]);
    assert.equal(summary.totalPaidMinorUnits, 35000);
    assert.equal(summary.dailyPaidMinorUnits, 5000);
    assert.equal(summary.weeklyPaidMinorUnits, 10000);
    assert.equal(summary.monthlyPaidMinorUnits, 20000);
    assert.equal(summary.totalRewardCount, 3);
  });

  it("ranks top creators by paid amount then wins", () => {
    const top = rankTopCreatorsFromSnapshots(
      [
        {
          winner_creator_id: "c1",
          is_eligible: true,
          period: "day",
          prize_minor_units: 5000,
          prize_currency: "INR",
          metrics_json: { username: "alpha" },
        },
        {
          winner_creator_id: "c1",
          is_eligible: true,
          period: "day",
          prize_minor_units: 5000,
          prize_currency: "INR",
          metrics_json: { username: "alpha" },
        },
        {
          winner_creator_id: "c2",
          is_eligible: true,
          period: "week",
          prize_minor_units: 12000,
          prize_currency: "INR",
          metrics_json: { username: "beta" },
        },
      ],
      10,
    );
    assert.equal(top.length, 2);
    assert.equal(top[0].creatorId, "c2");
    assert.equal(top[0].totalPaidMinorUnits, 12000);
    assert.equal(top[1].creatorId, "c1");
    assert.equal(top[1].winCount, 2);
  });
});

describe("copy helpers", () => {
  it("uses professional archive labels", () => {
    assert.deepEqual(winnerArchiveStatusCopy(true), {
      prizeLabel: "Prize awarded",
      statusLabel: "Winner recorded",
    });
    assert.deepEqual(winnerArchiveStatusCopy(false), {
      prizeLabel: "No prize awarded",
      statusLabel: "Eligibility not met",
    });
    assert.equal(formatPeriodLabel("week"), "Weekly");
    assert.equal(formatCategoryLabel("reels"), "Most verified reels");
  });
});
