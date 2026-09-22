import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  campaignMatchesPlatformFilter,
  campaignPlatformMatchMode,
  campaignPlatformFilterLabel,
  campaignPlatformsForMediaType,
  expandAvailableCampaignPlatforms,
  isCampaignPlatformSelected,
  normalizeCampaignPlatformFilter,
  parseCampaignPlatformTokens,
  postgrestPlatformOrFilter,
  setCampaignPlatformMatchMode,
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

  it("parses the multiple-platform mode prefix separately from platforms", () => {
    assert.deepEqual(
      parseCampaignPlatformTokens("multiple:instagram,youtube"),
      ["instagram", "youtube"],
    );
    assert.equal(
      campaignPlatformMatchMode("multiple:instagram,youtube"),
      "multiple",
    );
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
    assert.equal(normalizeCampaignPlatformFilter("all"), "all");
    assert.equal(normalizeCampaignPlatformFilter("not-a-platform"), "all");
  });

  it("keeps selecting every checkbox distinct from the All Platforms option", () => {
    assert.equal(
      normalizeCampaignPlatformFilter(
        "youtube,instagram,tiktok,twitter",
      ),
      "youtube,instagram,tiktok,twitter",
    );
    assert.equal(
      normalizeCampaignPlatformFilter(
        "multiple:youtube,instagram,tiktok,twitter",
      ),
      "multiple:youtube,instagram,tiktok,twitter",
    );
  });

  it("preserves multiple-platform mode, including an unfiltered selection", () => {
    assert.equal(
      normalizeCampaignPlatformFilter("multiple:instagram,youtube"),
      "multiple:youtube,instagram",
    );
    assert.equal(
      normalizeCampaignPlatformFilter("multiple:all"),
      "multiple:all",
    );
  });
});

describe("campaignMatchesPlatformFilter", () => {
  it("single mode returns one-platform campaigns for any selected platform", () => {
    assert.equal(
      campaignMatchesPlatformFilter("youtube", "youtube,instagram"),
      true,
    );
    assert.equal(
      campaignMatchesPlatformFilter("instagram", "youtube,instagram"),
      true,
    );
    assert.equal(
      campaignMatchesPlatformFilter("youtube,instagram", "youtube,instagram"),
      false,
    );
    assert.equal(campaignMatchesPlatformFilter("youtube", "all"), true);
  });

  it("multiple mode requires the exact selected platform set", () => {
    assert.equal(
      campaignMatchesPlatformFilter(
        "instagram,youtube",
        "multiple:youtube,instagram",
      ),
      true,
    );
    assert.equal(
      campaignMatchesPlatformFilter(
        "youtube,instagram,tiktok",
        "multiple:youtube,instagram",
      ),
      false,
    );
    assert.equal(
      campaignMatchesPlatformFilter("youtube", "multiple:youtube,instagram"),
      false,
    );
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

  it("preserves exact matching when toggling multiple-platform selections", () => {
    assert.equal(
      setCampaignPlatformMatchMode("youtube", "multiple"),
      "multiple:youtube",
    );
    assert.equal(
      toggleCampaignPlatformFilter("multiple:youtube", "instagram"),
      "multiple:youtube,instagram",
    );
    assert.equal(
      toggleCampaignPlatformFilter("multiple:youtube", "youtube"),
      "multiple:all",
    );
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
  it("builds exact single-platform clauses", () => {
    assert.equal(
      postgrestPlatformOrFilter("youtube"),
      "platform.eq.youtube",
    );
    assert.equal(
      postgrestPlatformOrFilter("twitter"),
      "platform.eq.twitter,platform.eq.x",
    );
    assert.equal(postgrestPlatformOrFilter("all"), null);
  });

  it("builds exact clauses for either CSV order in multiple mode", () => {
    const clause = postgrestPlatformOrFilter("multiple:youtube,instagram");
    assert.match(clause ?? "", /platform\.eq\."youtube,instagram"/);
    assert.match(clause ?? "", /platform\.eq\."instagram,youtube"/);
  });
});

describe("isCampaignPlatformSelected", () => {
  it("does not treat the multiple-mode prefix as part of the first platform", () => {
    const filter = "multiple:youtube,tiktok,twitter";
    assert.equal(isCampaignPlatformSelected(filter, "youtube"), true);
    assert.equal(isCampaignPlatformSelected(filter, "tiktok"), true);
    assert.equal(isCampaignPlatformSelected(filter, "twitter"), true);
    assert.equal(isCampaignPlatformSelected(filter, "instagram"), false);
  });
});
