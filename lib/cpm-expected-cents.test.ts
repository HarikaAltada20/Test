import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCpmEligibleViewsFromRow } from "./cpm-eligible-views";
import { computeCpmRawCentsForRow } from "./cpm-expected-cents";
import {
  createDefaultPlatformCampaignSnapshot,
  snapshotToPersistedPlatformCampaign,
} from "./video-platform-campaigns";

describe("getCpmEligibleViewsFromRow", () => {
  it("prefers TikTok other_stats view_count", () => {
    assert.equal(
      getCpmEligibleViewsFromRow({
        views: 10,
        platform: "tiktok",
        other_stats: { tiktok: { view_count: 5000 } },
      }),
      5000,
    );
  });

  it("falls back to Instagram reach when views are 0", () => {
    assert.equal(
      getCpmEligibleViewsFromRow({
        views: 0,
        platform: "instagram",
        other_stats: { instagram: { views: 0, reach: 800 } },
      }),
      800,
    );
  });
});

describe("computeCpmRawCentsForRow", () => {
  it("uses the submission platform CPM rate", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      totalBudget: "100",
      cpmRate: "1",
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      totalBudget: "100",
      cpmRate: "2",
    });
    const details = { youtube, instagram };
    assert.equal(
      computeCpmRawCentsForRow(
        { views: 10_000, platform: "instagram" },
        details,
        "youtube,instagram",
      ),
      2_000,
    );
    assert.equal(
      computeCpmRawCentsForRow(
        { views: 10_000, platform: "youtube" },
        details,
        "youtube,instagram",
      ),
      1_000,
    );
  });

  it("computes TikTok CPM when the TikTok campaign rate is 0", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      totalBudget: "100",
      cpmRate: "0.1",
      minViews: "5000",
    });
    const tiktok = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      totalBudget: "100",
      cpmRate: "0",
    });
    const details = { youtube, tiktok };
    assert.equal(
      computeCpmRawCentsForRow(
        {
          views: 0,
          platform: "tiktok",
          other_stats: { tiktok: { view_count: 2000 } },
        },
        details,
        "youtube,instagram,tiktok",
      ),
      20,
    );
  });
});
