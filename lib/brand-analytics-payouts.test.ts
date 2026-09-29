import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchTwitterPayoutsCentsFromTweets,
  resolveBrandTwitterPayoutsCents,
} from "@/lib/brand-analytics-payouts";
import type { BrandAnalyticsQueryContext } from "@/lib/brand-analytics-cache";

function baseCtx(
  overrides: Partial<BrandAnalyticsQueryContext> = {},
): BrandAnalyticsQueryContext {
  return {
    advertiserId: "adv-1",
    dateFrom: new Date("2026-06-01T00:00:00.000Z"),
    dateTo: new Date("2026-06-30T23:59:59.999Z"),
    dataSource: "submissions",
    contentType: "text_image",
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

describe("fetchTwitterEarningsCentsByCreator", () => {
  it("aggregates earnings by creator", async () => {
    const rows = [
      {
        creator_id: "creator-1",
        earnings: 3000,
        moderation_status: "paid",
        bonus_amount: 0,
      },
      {
        creator_id: "creator-2",
        earnings: 2000,
        moderation_status: "paid",
        bonus_amount: 0,
      },
    ];

    const mockSupabase = {
      from: () => ({
        select: () => ({
          in: () => ({
            gte: () => ({
              lte: () => ({
                range: async () => ({ data: rows, error: null }),
              }),
            }),
          }),
        }),
      }),
    };

    const { fetchTwitterEarningsCentsByCreator } = await import(
      "@/lib/brand-analytics-payouts"
    );
    const byCreator = await fetchTwitterEarningsCentsByCreator(
      mockSupabase,
      ["tw-contest-1"],
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-06-30T23:59:59.999Z"),
    );

    assert.equal(byCreator.get("creator-1"), 3000);
    assert.equal(byCreator.get("creator-2"), 2000);
  });
});

describe("fetchTwitterPayoutsCentsFromTweets", () => {
  it("sums paid tweet earnings in the date range for all submissions", async () => {
    const rows = [
      {
        creator_id: "creator-1",
        earnings: 5000,
        moderation_status: "paid",
        bonus_amount: 0,
      },
      {
        creator_id: "creator-1",
        earnings: 4990,
        moderation_status: "paid",
        bonus_amount: 0,
      },
      {
        creator_id: "creator-2",
        earnings: 0,
        moderation_status: "verified",
        bonus_amount: 0,
      },
    ];

    const mockSupabase = {
      from: () => ({
        select: () => ({
          in: () => ({
            gte: () => ({
              lte: () => ({
                range: async () => ({ data: rows, error: null }),
              }),
            }),
          }),
        }),
      }),
    };

    const total = await fetchTwitterPayoutsCentsFromTweets(
      mockSupabase,
      ["tw-contest-1"],
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-06-30T23:59:59.999Z"),
    );

    assert.equal(total, 9990);
  });

  it("respects the paid status filter", async () => {
    let statusFilter: string | null = null;
    const rows = [
      {
        creator_id: "creator-1",
        earnings: 9990,
        moderation_status: "paid",
        bonus_amount: 0,
      },
    ];

    const mockSupabase = {
      from: () => ({
        select: () => ({
          in: () => ({
            gte: () => ({
              lte: () => ({
                eq: (_col: string, status: string) => {
                  statusFilter = status;
                  return {
                    range: async () => ({ data: rows, error: null }),
                  };
                },
              }),
            }),
          }),
        }),
      }),
    };

    const total = await resolveBrandTwitterPayoutsCents(
      mockSupabase,
      ["tw-contest-1"],
      baseCtx({ submissionStatus: "paid" }),
    );

    assert.equal(statusFilter, "paid");
    assert.equal(total, 9990);
  });
});
