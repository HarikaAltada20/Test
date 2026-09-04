import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  attachPlatformCampaignsToDetails,
  applyPlatformContentColumnsToSnapshots,
  buildFlushedPlatformCampaigns,
  buildPlatformContentColumns,
  createDefaultAllSectionLive,
  createDefaultPlatformCampaignSnapshot,
  createDefaultSectionPlatforms,
  deriveSectionPlatformUiState,
  parseVideoContestPlatforms,
  patchSnapshotSection,
  platformsForTab,
  preparePlatformCampaignsForSave,
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
  it("stores platform payout keys only when two or more platforms are selected", () => {
    const youtube = createDefaultPlatformCampaignSnapshot();
    youtube.totalPrizePool = 10_000;
    const instagram = createDefaultPlatformCampaignSnapshot();
    instagram.contestType = "cpm";
    instagram.totalBudget = "50";
    instagram.cpmRate = "2";

    const single = attachPlatformCampaignsToDetails(
      { leaderboard_contest: { total_prize: 10_000 }, youtube: { contest_type: "leaderboard" } },
      ["youtube"],
      { youtube },
    );
    assert.equal(single.platform_campaigns, undefined);
    assert.equal(single.youtube, undefined);
    assert.equal(single.instagram, undefined);

    const multi = attachPlatformCampaignsToDetails({}, ["youtube", "instagram"], {
      youtube,
      instagram,
    }) as {
      youtube: { contest_type: string };
      instagram: { contest_type: string; cpm_contest?: { total_budget?: number } };
      platform_campaigns?: unknown;
    };
    assert.equal(multi.platform_campaigns, undefined);
    assert.equal(multi.youtube.contest_type, "leaderboard");
    assert.equal(multi.instagram.contest_type, "cpm");
    assert.equal(multi.instagram.cpm_contest?.total_budget, 5_000);
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

  it("sums persisted platform payout keys for chargeable budget", () => {
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
      youtube,
      tiktok,
    });
    assert.equal(cents, 10_500);
  });
});

describe("preparePlatformCampaignsForSave", () => {
  it("forces shared campaign/content type onto every selected platform", () => {
    const tabs = createDefaultSectionPlatforms();
    tabs.brief = "instagram";
    tabs.prize = "youtube";
    const live = createDefaultAllSectionLive();
    live.brief = false;
    live.prize = false;

    const current = createDefaultPlatformCampaignSnapshot();
    current.contestType = "cpm";
    current.contentType = "ugc";
    current.cpmRate = "2.5";
    current.totalBudget = "100";
    current.briefHtml = "instagram brief";

    const existingYt = createDefaultPlatformCampaignSnapshot();
    existingYt.contestType = "leaderboard";
    existingYt.briefHtml = "youtube brief";
    existingYt.totalPrizePool = 5000;

    const existingIg = createDefaultPlatformCampaignSnapshot();
    existingIg.contestType = "leaderboard";
    existingIg.briefHtml = "old ig brief";

    const prepared = preparePlatformCampaignsForSave(
      ["youtube", "instagram", "tiktok"],
      tabs,
      current,
      { youtube: existingYt, instagram: existingIg },
      live,
    );

    assert.equal(prepared.youtube?.contestType, "cpm");
    assert.equal(prepared.instagram?.contestType, "cpm");
    assert.equal(prepared.tiktok?.contestType, "cpm");
    assert.equal(prepared.youtube?.contentType, "ugc");
    assert.equal(prepared.instagram?.contentType, "ugc");
    assert.equal(prepared.tiktok?.contentType, "ugc");
    assert.equal(prepared.instagram?.briefHtml, "instagram brief");
    assert.equal(prepared.youtube?.briefHtml, "youtube brief");
    assert.ok(prepared.tiktok);
  });

  it("always persists every selected platform in attachPlatformCampaignsToDetails", () => {
    const youtube = createDefaultPlatformCampaignSnapshot();
    youtube.totalPrizePool = 1000;
    const details = attachPlatformCampaignsToDetails({}, ["youtube", "tiktok"], {
      youtube,
    }) as {
      youtube: { contest_type: string };
      tiktok: { contest_type: string };
      platform_campaigns?: unknown;
    };
    assert.equal(details.platform_campaigns, undefined);
    assert.equal(details.youtube.contest_type, "leaderboard");
    assert.equal(details.tiktok.contest_type, "leaderboard");
  });
});

describe("deriveSectionPlatformUiState", () => {
  it("opens divergent sections in selected-platforms mode", () => {
    const youtube = createDefaultPlatformCampaignSnapshot();
    youtube.briefHtml = "yt brief";
    const instagram = createDefaultPlatformCampaignSnapshot();
    instagram.briefHtml = "ig brief";
    const { tabs, allLive } = deriveSectionPlatformUiState(
      ["youtube", "instagram"],
      { youtube, instagram },
    );
    assert.equal(tabs.brief, "youtube");
    assert.equal(allLive.brief, false);
    assert.equal(tabs.campaignType, "all");
    assert.equal(allLive.campaignType, true);
  });

  it("keeps uniform sections on All", () => {
    const youtube = createDefaultPlatformCampaignSnapshot();
    youtube.briefHtml = "same";
    const instagram = createDefaultPlatformCampaignSnapshot();
    instagram.briefHtml = "same";
    const { tabs, allLive } = deriveSectionPlatformUiState(
      ["youtube", "instagram"],
      { youtube, instagram },
    );
    assert.equal(tabs.brief, "all");
    assert.equal(allLive.brief, true);
  });
});

describe("buildFlushedPlatformCampaigns All-guard", () => {
  it("does not broadcast All over divergent per-platform briefs", () => {
    const tabs = createDefaultSectionPlatforms();
    const live = createDefaultAllSectionLive();
    const current = createDefaultPlatformCampaignSnapshot();
    current.briefHtml = "editor buffer";

    const youtube = createDefaultPlatformCampaignSnapshot();
    youtube.briefHtml = "yt only";
    const instagram = createDefaultPlatformCampaignSnapshot();
    instagram.briefHtml = "ig only";

    const flushed = buildFlushedPlatformCampaigns(
      ["youtube", "instagram"],
      tabs,
      current,
      { youtube, instagram },
      live,
    );

    assert.equal(flushed.youtube?.briefHtml, "yt only");
    assert.equal(flushed.instagram?.briefHtml, "ig only");
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

  it("round-trips content via top-level platform content columns", () => {
    const snapshot = createDefaultPlatformCampaignSnapshot();
    snapshot.resources = [
      { url: "https://cdn.example.com/logo.png", description: "Logo", type: "internal" },
    ];
    snapshot.inspirationLinks = [
      { url: "https://tiktok.com/@brand", description: "Tone" },
    ];
    snapshot.briefHtml = "<p>brief</p>";
    snapshot.rulesHtml = "<p>rules</p>";

    const columns = buildPlatformContentColumns(["youtube"], { youtube: snapshot });
    assert.deepEqual(columns.resources, snapshot.resources);
    assert.deepEqual(columns.inspiration_links, snapshot.inspirationLinks);

    const multi = buildPlatformContentColumns(
      ["youtube", "tiktok"],
      { youtube: snapshot, tiktok: createDefaultPlatformCampaignSnapshot() },
    );
    assert.ok(!Array.isArray(multi.resources));
    assert.deepEqual(
      (multi.resources as Record<string, unknown>).youtube,
      snapshot.resources,
    );

    const restored = applyPlatformContentColumnsToSnapshots(
      ["youtube", "tiktok"],
      multi,
      {
        youtube: createDefaultPlatformCampaignSnapshot(),
        tiktok: createDefaultPlatformCampaignSnapshot(),
      },
    );
    assert.deepEqual(restored.youtube?.resources, snapshot.resources);
    assert.deepEqual(
      restored.youtube?.inspirationLinks,
      snapshot.inspirationLinks,
    );

    // Persisted platform payout objects no longer carry content fields.
    const persisted = snapshotToPersistedPlatformCampaign(snapshot);
    assert.equal((persisted as { resources?: unknown }).resources, undefined);
    assert.equal(
      (persisted as { inspiration_links?: unknown }).inspiration_links,
      undefined,
    );
    assert.equal((persisted as { brief_html?: unknown }).brief_html, undefined);
    assert.equal((persisted as { content_type?: unknown }).content_type, undefined);
  });
});
