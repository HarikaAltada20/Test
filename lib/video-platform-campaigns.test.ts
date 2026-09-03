import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  attachPlatformCampaignsToDetails,
  buildFlushedPlatformCampaigns,
  createDefaultAllSectionLive,
  createDefaultPlatformCampaignSnapshot,
  createDefaultSectionPlatforms,
  parseVideoContestPlatforms,
  patchSnapshotSection,
  platformsForTab,
  serializeVideoContestPlatforms,
  snapshotToPersistedPlatformCampaign,
  persistedPlatformCampaignToSnapshot,
  sumPersistedPlatformCampaignsChargeableCents,
  sumSnapshotChargeableCents,
} from "./video-platform-campaigns";

describe("parseVideoContestPlatforms", () => {
  it("parses comma-separated video platforms in order", () => {
    assert.deepEqual(parseVideoContestPlatforms("youtube,instagram,tiktok"), [
      "youtube",
      "instagram",
      "tiktok",
    ]);
  });

  it("ignores twitter and duplicates", () => {
    assert.deepEqual(parseVideoContestPlatforms("instagram,twitter,instagram"), [
      "instagram",
    ]);
  });
});

describe("serializeVideoContestPlatforms", () => {
  it("joins unique platforms", () => {
    assert.equal(
      serializeVideoContestPlatforms(["youtube", "youtube", "tiktok"]),
      "youtube,tiktok",
    );
  });
});

describe("multi-platform payout persistence", () => {
  it("stores platform_campaigns only when two or more platforms are selected", () => {
    const youtube = createDefaultPlatformCampaignSnapshot();
    youtube.totalPrizePool = 10_000;
    const instagram = createDefaultPlatformCampaignSnapshot();
    instagram.contestType = "cpm";
    instagram.totalBudget = "50";
    instagram.cpmRate = "2";

    const single = attachPlatformCampaignsToDetails(
      { leaderboard_contest: { total_prize: 10_000 } },
      ["youtube"],
      { youtube },
    );
    assert.equal(single.platform_campaigns, undefined);

    const multi = attachPlatformCampaignsToDetails({}, ["youtube", "instagram"], {
      youtube,
      instagram,
    }) as {
      platform_campaigns: Record<
        string,
        { contest_type: string; cpm_contest?: { total_budget?: number } }
      >;
    };
    assert.equal(multi.platform_campaigns.youtube.contest_type, "leaderboard");
    assert.equal(multi.platform_campaigns.instagram.contest_type, "cpm");
    assert.equal(
      multi.platform_campaigns.instagram.cpm_contest?.total_budget,
      5_000,
    );
  });

  it("sums chargeable cents across platform snapshots", () => {
    const youtube = createDefaultPlatformCampaignSnapshot();
    youtube.totalPrizePool = 10_000;
    const instagram = createDefaultPlatformCampaignSnapshot();
    instagram.contestType = "cpm";
    instagram.totalBudget = "40";
    assert.equal(
      sumSnapshotChargeableCents(["youtube", "instagram"], {
        youtube,
        instagram,
      }),
      14_000,
    );
  });

  it("sums persisted platform_campaigns for chargeable budget", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      totalPrizePool: 8_000,
    });
    const tiktok = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "milestone",
      totalBudget: "25",
    });
    const cents = sumPersistedPlatformCampaignsChargeableCents({
      platform_campaigns: { youtube, tiktok },
    });
    assert.equal(cents, 10_500);
  });
});

describe("platformsForTab", () => {
  it("returns all selected platforms for the All tab", () => {
    assert.deepEqual(
      platformsForTab("all", ["youtube", "instagram"]),
      ["youtube", "instagram"],
    );
  });

  it("returns only the matching platform for a single-platform tab", () => {
    assert.deepEqual(platformsForTab("instagram", ["youtube", "instagram"]), [
      "instagram",
    ]);
  });
});

describe("patchSnapshotSection", () => {
  it("copies only the requested section onto the target snapshot", () => {
    const target = createDefaultPlatformCampaignSnapshot();
    target.contestType = "leaderboard";
    target.briefHtml = "youtube brief";
    const source = createDefaultPlatformCampaignSnapshot();
    source.contestType = "cpm";
    source.briefHtml = "instagram brief";
    source.cpmRate = "3";

    const patchedType = patchSnapshotSection(target, "campaignType", source);
    assert.equal(patchedType.contestType, "cpm");
    assert.equal(patchedType.briefHtml, "youtube brief");

    const patchedBrief = patchSnapshotSection(target, "brief", source);
    assert.equal(patchedBrief.contestType, "leaderboard");
    assert.equal(patchedBrief.briefHtml, "instagram brief");
  });
});

describe("buildFlushedPlatformCampaigns resources", () => {
  it("copies All-tab resources and inspiration to every platform", () => {
    const tabs = createDefaultSectionPlatforms();
    const live = createDefaultAllSectionLive();
    const current = createDefaultPlatformCampaignSnapshot();
    current.resources = [
      { url: "https://brand.com/kit", description: "Brand kit", type: "external" },
    ];
    current.inspirationLinks = [
      { url: "https://youtube.com/watch?v=example", description: "Example" },
    ];

    const flushed = buildFlushedPlatformCampaigns(
      ["youtube", "instagram"],
      tabs,
      current,
      {},
      live,
    );

    assert.equal(flushed.youtube?.resources[0]?.url, "https://brand.com/kit");
    assert.equal(flushed.instagram?.resources[0]?.url, "https://brand.com/kit");
    assert.equal(
      flushed.instagram?.inspirationLinks[0]?.url,
      "https://youtube.com/watch?v=example",
    );
  });

  it("does not copy per-platform resources onto other platforms", () => {
    const tabs = createDefaultSectionPlatforms();
    tabs.resources = "youtube";
    tabs.inspiration = "youtube";
    const live = createDefaultAllSectionLive();
    live.resources = false;
    live.inspiration = false;

    const current = createDefaultPlatformCampaignSnapshot();
    current.resources = [
      { url: "https://yt-only.com", description: "YouTube", type: "external" },
    ];
    current.inspirationLinks = [
      { url: "https://youtube.com/watch?v=yt", description: "YT inspo" },
    ];

    const existingIg = createDefaultPlatformCampaignSnapshot();
    existingIg.resources = [
      { url: "https://ig-only.com", description: "Instagram", type: "external" },
    ];
    existingIg.inspirationLinks = [
      { url: "https://instagram.com/p/ig", description: "IG inspo" },
    ];

    const flushed = buildFlushedPlatformCampaigns(
      ["youtube", "instagram"],
      tabs,
      current,
      { instagram: existingIg },
      live,
    );

    assert.equal(flushed.youtube?.resources[0]?.url, "https://yt-only.com");
    assert.equal(flushed.instagram?.resources[0]?.url, "https://ig-only.com");
    assert.equal(
      flushed.instagram?.inspirationLinks[0]?.url,
      "https://instagram.com/p/ig",
    );
  });

  it("round-trips resources through persisted platform campaigns", () => {
    const snapshot = createDefaultPlatformCampaignSnapshot();
    snapshot.resources = [
      { url: "https://cdn.example.com/logo.png", description: "Logo", type: "internal" },
    ];
    snapshot.inspirationLinks = [
      { url: "https://tiktok.com/@brand", description: "Tone" },
    ];
    const restored = persistedPlatformCampaignToSnapshot(
      snapshotToPersistedPlatformCampaign(snapshot),
    );
    assert.deepEqual(restored.resources, snapshot.resources);
    assert.deepEqual(restored.inspirationLinks, snapshot.inspirationLinks);
  });
});
