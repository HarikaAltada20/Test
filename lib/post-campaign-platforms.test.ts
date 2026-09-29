import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyPostCampaignSubmissionPlatform,
  parsePostCampaignVideoPlatforms,
  resolvePostCampaignRefreshPlatforms,
} from "./post-campaign-platforms";

describe("parsePostCampaignVideoPlatforms", () => {
  it("parses single platforms", () => {
    assert.deepEqual(parsePostCampaignVideoPlatforms("youtube"), ["youtube"]);
    assert.deepEqual(parsePostCampaignVideoPlatforms("Instagram"), [
      "instagram",
    ]);
    assert.deepEqual(parsePostCampaignVideoPlatforms("tiktok"), ["tiktok"]);
  });

  it("preserves hybrid order instead of Instagram-first if-chain", () => {
    assert.deepEqual(parsePostCampaignVideoPlatforms("youtube,instagram"), [
      "youtube",
      "instagram",
    ]);
    assert.deepEqual(parsePostCampaignVideoPlatforms("instagram,youtube"), [
      "instagram",
      "youtube",
    ]);
    assert.deepEqual(parsePostCampaignVideoPlatforms("tiktok + youtube"), [
      "tiktok",
      "youtube",
    ]);
  });

  it("returns empty for unsupported platforms", () => {
    assert.deepEqual(parsePostCampaignVideoPlatforms("twitter"), []);
    assert.deepEqual(parsePostCampaignVideoPlatforms(null), []);
  });
});

describe("classifyPostCampaignSubmissionPlatform", () => {
  it("classifies submission platform fields", () => {
    assert.equal(classifyPostCampaignSubmissionPlatform("YouTube"), "youtube");
    assert.equal(
      classifyPostCampaignSubmissionPlatform("instagram"),
      "instagram",
    );
    assert.equal(classifyPostCampaignSubmissionPlatform("x"), null);
  });
});

describe("resolvePostCampaignRefreshPlatforms", () => {
  it("prefers distinct row platforms over contest string order conflicts", () => {
    assert.deepEqual(
      resolvePostCampaignRefreshPlatforms({
        contestPlatform: "instagram,youtube",
        rowPlatforms: ["youtube", "youtube", "tiktok"],
      }),
      ["youtube", "tiktok"],
    );
  });

  it("falls back to contest platform when rows have no classifiable platform", () => {
    assert.deepEqual(
      resolvePostCampaignRefreshPlatforms({
        contestPlatform: "youtube,instagram",
        rowPlatforms: [null, ""],
      }),
      ["youtube", "instagram"],
    );
  });
});
