import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  campaignMatchesPlatformFilter,
  campaignPlatformFilterLabel,
  campaignPlatformsForMediaType,
  expandAvailableCampaignPlatforms,
  normalizeCampaignPlatformFilter,
  parseCampaignPlatformTokens,
  postgrestPlatformOrFilter,
  toggleCampaignPlatformFilter,
} from "./campaign-platform-filter";

describe("parseCampaignPlatformTokens", () => {
  it("splits combined contest.platform CSV into individual platforms", () => {
    assert.deepEqual(parseCampaignPlatformTokens("youtube,instagram,tiktok"), [
      "youtube",
      "instagram",
      "tiktok",
    ]);
  });

  it("treats x as twitter and ignores All Platforms", () => {
    assert.deepEqual(parseCampaignPlatformTokens("x"), ["twitter"]);
    assert.deepEqual(parseCampaignPlatformTokens("all"), []);
  });
});

describe("expandAvailableCampaignPlatforms", () => {
  it("does not keep combined CSV strings as filter options", () => {
    assert.deepEqual(
      expandAvailableCampaignPlatforms([
        "all",
        "instagram",
        "tiktok",
        "twitter",
        "youtube",
        "youtube,instagram,tiktok",
      ]),
      ["all", "youtube", "instagram", "tiktok", "twitter"],
    );
  });
});

describe("normalizeCampaignPlatformFilter", () => {
  it("keeps a single platform and maps empty / unknown to all", () => {
    assert.equal(normalizeCampaignPlatformFilter("youtube"), "youtube");
    assert.equal(normalizeCampaignPlatformFilter("youtube,instagram,tiktok,twitter"), "all");
    assert.equal(normalizeCampaignPlatformFilter("not-a-platform"), "all");
  });
});

describe("campaignMatchesPlatformFilter", () => {
  it("matches multi-platform contests when any selected platform is present", () => {
    assert.equal(
      campaignMatchesPlatformFilter("youtube,instagram,tiktok", "youtube"),
      true,
    );
    assert.equal(
      campaignMatchesPlatformFilter("youtube,instagram,tiktok", "twitter"),
      false,
    );
    assert.equal(campaignMatchesPlatformFilter("youtube", "all"), true);
  });
});

describe("toggleCampaignPlatformFilter", () => {
  it("turns All Platforms into a single checked platform", () => {
    assert.equal(toggleCampaignPlatformFilter("all", "youtube"), "youtube");
  });

  it("adds and removes platforms, returning to all when none remain", () => {
    assert.equal(
      toggleCampaignPlatformFilter("youtube", "instagram"),
      "youtube,instagram",
    );
    assert.equal(toggleCampaignPlatformFilter("youtube", "youtube"), "all");
  });
});

describe("campaignPlatformFilterLabel", () => {
  it("labels all vs individual selections", () => {
    assert.equal(campaignPlatformFilterLabel("all"), "All Platforms");
    assert.equal(campaignPlatformFilterLabel("youtube"), "YouTube");
  });
});

describe("campaignPlatformsForMediaType", () => {
  it("limits video vs twitter options", () => {
    assert.deepEqual(campaignPlatformsForMediaType("media"), [
      "youtube",
      "instagram",
      "tiktok",
    ]);
    assert.deepEqual(campaignPlatformsForMediaType("text"), ["twitter"]);
  });
});

describe("postgrestPlatformOrFilter", () => {
  it("builds overlap clauses without using combined CSV values", () => {
    assert.equal(
      postgrestPlatformOrFilter("youtube"),
      "platform.ilike.%youtube%",
    );
    assert.equal(
      postgrestPlatformOrFilter("twitter"),
      "platform.ilike.%twitter%,platform.eq.x",
    );
    assert.equal(postgrestPlatformOrFilter("all"), null);
  });
});
