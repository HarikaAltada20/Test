import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeViewWeightedPlatformCpmUsd,
  getAnalyticsCampaignBudgetCents,
  resolveAnalyticsExpectedCpmDisplay,
  resolveAnalyticsRoiContestType,
} from "@/lib/contest-analytics-roi";

describe("getAnalyticsCampaignBudgetCents", () => {
  it("sums per-platform leaderboard prize pools instead of the root prize", () => {
    const cents = getAnalyticsCampaignBudgetCents({
      contest_type: "leaderboard",
      platform: "youtube,instagram,tiktok",
      contest_based_details: {
        leaderboard_contest: { total_prize: 6_000 },
        youtube: {
          contest_type: "leaderboard",
          leaderboard_contest: { total_prize: 6_000, prizes: [] },
        },
        instagram: {
          contest_type: "leaderboard",
          leaderboard_contest: { total_prize: 20_000, prizes: [] },
        },
        tiktok: {
          contest_type: "leaderboard",
          leaderboard_contest: { total_prize: 19_000, prizes: [] },
        },
      },
    });

    assert.equal(cents, 45_000);
  });

  it("uses the scoped platform prize pool", () => {
    const cents = getAnalyticsCampaignBudgetCents(
      {
        contest_type: "leaderboard",
        platform: "youtube,instagram",
        contest_based_details: {
          leaderboard_contest: { total_prize: 6_000 },
          youtube: {
            contest_type: "leaderboard",
            leaderboard_contest: { total_prize: 6_000, prizes: [] },
          },
          instagram: {
            contest_type: "cpm",
            cpm_contest: { total_budget: 50_000, cpm_rate_usd: 1 },
          },
        },
      },
      "instagram",
    );

    assert.equal(cents, 50_000);
    assert.equal(
      resolveAnalyticsRoiContestType(
        {
          contest_type: "leaderboard",
          contest_based_details: {
            instagram: { contest_type: "cpm" },
          },
        },
        "instagram",
      ),
      "cpm",
    );
  });
});

describe("computeViewWeightedPlatformCpmUsd", () => {
  const details = {
    youtube: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 1 } },
    instagram: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 0.5 } },
  };

  it("returns the scoped platform CPM rate", () => {
    const rate = computeViewWeightedPlatformCpmUsd(
      [{ platform: "instagram", views: 1000 }],
      details,
      "youtube,instagram",
      "instagram",
    );
    assert.equal(rate, 0.5);
  });

  it("view-weights rates across platforms on the All tab", () => {
    const rate = computeViewWeightedPlatformCpmUsd(
      [
        { platform: "youtube", views: 1_000 },
        { platform: "instagram", views: 3_000 },
      ],
      details,
      "youtube,instagram",
    );
    assert.equal(rate, 0.625);
  });
});

describe("resolveAnalyticsExpectedCpmDisplay", () => {
  it("prefers platform CPM rate over expected-reward / views", () => {
    const display = resolveAnalyticsExpectedCpmDisplay({
      submissions: [
        { platform: "instagram", views: 9_000_000 },
      ],
      details: {
        instagram: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 0.5 } },
      },
      contestPlatformCsv: "instagram",
      expectedPayoutCents: 45_000,
      totalViews: 9_000_000,
    });

    assert.equal(display.value, "$0.500");
    assert.equal(display.note, "Platform CPM rate");
  });
});
