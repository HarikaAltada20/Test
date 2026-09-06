import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  attachPlatformCampaignsToDetails,
  applyPlatformContentColumnsToSnapshots,
  buildFlushedPlatformCampaigns,
  buildPlatformContentColumns,
  buildPlatformCreatorEarningsColumns,
  createDefaultAllSectionLive,
  createDefaultPlatformCampaignSnapshot,
  createDefaultSectionPlatforms,
  deriveSectionPlatformUiState,
  parseVideoContestPlatforms,
  videoContestPlatformFromValue,
  patchSnapshotSection,
  platformsForTab,
  preparePlatformCampaignsForSave,
  serializeVideoContestPlatforms,
  snapshotToPersistedPlatformCampaign,
  persistedPlatformCampaignToSnapshot,
  sumPersistedPlatformCampaignsChargeableCents,
  sumSnapshotChargeableCents,
  resolveContestPoolBudgetCents,
  formatContestPlatformLabel,
  resolveContestPlatformCpmRates,
  formatContestListCpmRatesText,
  withProjectedTopLevelPayout,
  resolveCpmContestConfigForPlatform,
  contestHasUsableCpmRate,
  briefHtmlForPlatform,
  rulesHtmlForPlatform,
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

describe("videoContestPlatformFromValue", () => {
  it("resolves a single platform", () => {
    assert.equal(videoContestPlatformFromValue("tiktok"), "tiktok");
  });

  it("does not treat a multi-platform CSV as YouTube", () => {
    assert.equal(
      videoContestPlatformFromValue("instagram,youtube,tiktok"),
      null,
    );
  });
});

describe("formatContestPlatformLabel", () => {
  it("formats multi-platform labels", () => {
    assert.equal(
      formatContestPlatformLabel("youtube,instagram"),
      "YouTube and Instagram",
    );
  });

  it("falls back for twitter", () => {
    assert.equal(formatContestPlatformLabel("twitter"), "Twitter");
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

    const multi = attachPlatformCampaignsToDetails(
      {
        cpm_contest: { cpm_rate_usd: 9 },
        milestone_contest: { milestones: [] },
        total_budget_cents: 99_000,
        leaderboard_contest: { total_prize: 1 },
      },
      ["youtube", "instagram"],
      {
        youtube,
        instagram,
      },
    ) as {
      youtube: { contest_type: string };
      instagram: { contest_type: string; cpm_contest?: { total_budget?: number } };
      platform_campaigns?: unknown;
      cpm_contest?: unknown;
      milestone_contest?: unknown;
      total_budget_cents?: unknown;
      leaderboard_contest?: unknown;
    };
    assert.equal(multi.platform_campaigns, undefined);
    assert.equal(multi.youtube.contest_type, "leaderboard");
    assert.equal(multi.instagram.contest_type, "cpm");
    assert.equal(multi.instagram.cpm_contest?.total_budget, 5_000);
    assert.equal(multi.cpm_contest, undefined);
    assert.equal(multi.milestone_contest, undefined);
    assert.equal(multi.total_budget_cents, undefined);
    assert.equal(multi.leaderboard_contest, undefined);
  });

  it("sums chargeable cents with a shared campaign budget", () => {
    const youtube = createDefaultPlatformCampaignSnapshot();
    youtube.totalPrizePool = 10_000;
    const instagram = createDefaultPlatformCampaignSnapshot();
    instagram.totalPrizePool = 4_000;
    assert.equal(
      sumSnapshotChargeableCents(["youtube", "instagram"], {
        youtube,
        instagram,
      }),
      14_000,
    );

    const ytCpm = createDefaultPlatformCampaignSnapshot();
    ytCpm.contestType = "cpm";
    ytCpm.totalBudget = "40";
    const igCpm = createDefaultPlatformCampaignSnapshot();
    igCpm.contestType = "cpm";
    igCpm.totalBudget = "40";
    assert.equal(
      sumSnapshotChargeableCents(["youtube", "instagram"], {
        youtube: ytCpm,
        instagram: igCpm,
      }),
      4_000,
    );
  });

  it("sums persisted platform payout keys for chargeable budget", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      totalPrizePool: 8_000,
    });
    const tiktok = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      totalPrizePool: 2_500,
    });
    const cents = sumPersistedPlatformCampaignsChargeableCents({
      youtube,
      tiktok,
    });
    assert.equal(cents, 10_500);

    const ytCpm = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      totalBudget: "25",
    });
    const igCpm = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      totalBudget: "25",
    });
    assert.equal(
      sumPersistedPlatformCampaignsChargeableCents({
        youtube: ytCpm,
        instagram: igCpm,
      }),
      2_500,
    );
  });
});

describe("briefHtmlForPlatform / rulesHtmlForPlatform", () => {
  it("reads platform-keyed brief_json and rules_json", () => {
    const contest = {
      platform: "youtube,instagram",
      brief_html: "<p>primary</p>",
      brief_json: {
        youtube: { html: "<p>yt</p>", json: null },
        instagram: { html: "<p>ig</p>", json: null },
      },
      rules_html: "<p>primary rules</p>",
      rules_json: {
        youtube: { html: "<p>yt rules</p>", json: null },
        instagram: { html: "<p>ig rules</p>", json: null },
      },
    };
    assert.equal(briefHtmlForPlatform(contest, "instagram"), "<p>ig</p>");
    assert.equal(rulesHtmlForPlatform(contest, "youtube"), "<p>yt rules</p>");
    assert.equal(briefHtmlForPlatform(contest, "youtube"), "<p>yt</p>");
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

  it("applies All-tab creator earnings to every platform on save", () => {
    const tabs = createDefaultSectionPlatforms();
    tabs.earnings = "all";
    tabs.prize = "youtube";
    const live = createDefaultAllSectionLive();
    live.earnings = false;
    live.prize = false;

    const current = createDefaultPlatformCampaignSnapshot();
    current.maxEarningsPerCreator = "70";
    current.bonusEnabled = true;
    current.bonusHtml = "<p>shared</p>";
    current.cpmRate = "1";

    const yt = createDefaultPlatformCampaignSnapshot();
    yt.maxEarningsPerCreator = "10";
    yt.cpmRate = "1";
    const ig = createDefaultPlatformCampaignSnapshot();
    ig.maxEarningsPerCreator = "20";
    ig.cpmRate = "2";

    const prepared = preparePlatformCampaignsForSave(
      ["youtube", "instagram"],
      tabs,
      current,
      { youtube: yt, instagram: ig },
      live,
    );

    assert.equal(prepared.youtube?.maxEarningsPerCreator, "70");
    assert.equal(prepared.instagram?.maxEarningsPerCreator, "70");
    assert.equal(prepared.youtube?.bonusHtml, "<p>shared</p>");
    assert.equal(prepared.instagram?.bonusHtml, "<p>shared</p>");
    // Payout stays per-platform — earnings All must not overwrite other CPM rates.
    assert.equal(prepared.youtube?.cpmRate, "1");
    assert.equal(prepared.instagram?.cpmRate, "2");
  });
  it("resolves shared multi-platform pool budget when root payout is empty", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "dual_rewards",
      totalBudget: "250",
      cpmRate: "1",
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "dual_rewards",
      totalBudget: "250",
      cpmRate: "2",
    });
    const details = {
      cpm_contest: {},
      total_budget_cents: 0,
      youtube,
      instagram,
    };
    assert.equal(
      resolveContestPoolBudgetCents(
        "dual_rewards",
        details,
        "youtube,instagram",
      ),
      25_000,
    );
  });
});

describe("resolveContestPlatformCpmRates", () => {
  it("reads per-platform CPM rates when root cpm_contest is empty", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "dual_rewards",
      totalBudget: "100",
      cpmRate: "0.5",
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "dual_rewards",
      totalBudget: "100",
      cpmRate: "0.75",
    });
    const rates = resolveContestPlatformCpmRates(
      { cpm_contest: {}, youtube, instagram },
      "youtube,instagram",
    );
    assert.deepEqual(rates, [
      { platform: "youtube", rateUsd: 0.5 },
      { platform: "instagram", rateUsd: 0.75 },
    ]);
    assert.equal(
      formatContestListCpmRatesText(rates, (c) => `$${(c / 100).toFixed(2)}`),
      "YouTube $0.50 · Instagram $0.75 / 1k views",
    );
  });

  it("collapses identical rates to a single amount", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      totalBudget: "100",
      cpmRate: "1",
    });
    const tiktok = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      totalBudget: "100",
      cpmRate: "1",
    });
    const text = formatContestListCpmRatesText(
      resolveContestPlatformCpmRates(
        { youtube, tiktok },
        "youtube,tiktok",
      ),
      (c) => `$${(c / 100).toFixed(2)}`,
    );
    assert.equal(text, "$1.00 / 1k views");
  });
});

describe("resolveCpmContestConfigForPlatform", () => {
  it("reads the submission platform rate on multi-platform contests", () => {
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
      resolveCpmContestConfigForPlatform(details, "instagram", "youtube,instagram")
        ?.cpm_rate_usd,
      2,
    );
    assert.equal(
      resolveCpmContestConfigForPlatform(details, "youtube", "youtube,instagram")
        ?.cpm_rate_usd,
      1,
    );
    assert.equal(
      contestHasUsableCpmRate(details, "youtube,instagram"),
      true,
    );
  });
});

describe("withProjectedTopLevelPayout", () => {
  it("projects primary platform payout onto root when root payout is missing", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "dual_rewards",
      totalBudget: "200",
      cpmRate: "0.2",
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "dual_rewards",
      totalBudget: "200",
      cpmRate: "0.75",
    });
    const projected = withProjectedTopLevelPayout(
      { youtube, instagram },
      "youtube,instagram",
    );
    assert.equal(
      (projected.cpm_contest as { cpm_rate_usd?: number } | undefined)
        ?.cpm_rate_usd,
      0.2,
    );
    assert.equal(projected.total_budget_cents, 20_000);
    assert.ok(projected.youtube);
    assert.ok(projected.instagram);
  });

  it("does not overwrite existing root payout blocks", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      totalBudget: "50",
      cpmRate: "1",
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      totalBudget: "50",
      cpmRate: "2",
    });
    const projected = withProjectedTopLevelPayout(
      {
        cpm_contest: { cpm_rate_usd: 9 },
        youtube,
        instagram,
      },
      "youtube,instagram",
    );
    assert.equal(
      (projected.cpm_contest as { cpm_rate_usd?: number }).cpm_rate_usd,
      9,
    );
  });

  it("preferPlatform projects that platform even when root payout exists", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      totalBudget: "50",
      cpmRate: "1",
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      totalBudget: "50",
      cpmRate: "2",
    });
    const projected = withProjectedTopLevelPayout(
      {
        cpm_contest: { cpm_rate_usd: 9 },
        youtube,
        instagram,
      },
      "youtube,instagram",
      "instagram",
    );
    assert.equal(
      (projected.cpm_contest as { cpm_rate_usd?: number }).cpm_rate_usd,
      2,
    );
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
  it("always syncs Total Campaign Budget onto every selected platform", () => {
    const tabs = createDefaultSectionPlatforms();
    tabs.prize = "youtube";
    const live = createDefaultAllSectionLive();
    live.prize = false;

    const current = createDefaultPlatformCampaignSnapshot();
    current.contestType = "cpm";
    current.totalBudget = "75";
    current.cpmRate = "1.5";

    const existingIg = createDefaultPlatformCampaignSnapshot();
    existingIg.contestType = "cpm";
    existingIg.totalBudget = "10";
    existingIg.cpmRate = "3";

    const flushed = buildFlushedPlatformCampaigns(
      ["youtube", "instagram"],
      tabs,
      current,
      { instagram: existingIg },
      live,
    );

    assert.equal(flushed.youtube?.totalBudget, "75");
    assert.equal(flushed.instagram?.totalBudget, "75");
    assert.equal(flushed.instagram?.cpmRate, "3");
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

  it("scopes submissions table column keys to the selected platform tab", () => {
    const platforms: Array<"youtube" | "instagram" | "tiktok"> = [
      "youtube",
      "instagram",
      "tiktok",
    ];
    const instagramKey = platformsForTab("instagram", platforms).join(",");
    assert.equal(instagramKey.includes("instagram"), true);
    assert.equal(instagramKey.includes("youtube"), false);
    assert.equal(instagramKey.includes("tiktok"), false);

    const allKey = platformsForTab("all", platforms).join(",");
    assert.equal(allKey.includes("instagram"), true);
    assert.equal(allKey.includes("youtube"), true);
    assert.equal(allKey.includes("tiktok"), true);
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
  it("copies creator earning fields with the earnings section only", () => {
    const target = createDefaultPlatformCampaignSnapshot();
    target.cpmRate = "1";
    const source = createDefaultPlatformCampaignSnapshot();
    source.maxEarningsPerCreator = "70";
    source.bonusEnabled = true;
    source.bonusHtml = "<p>bonus</p>";
    source.cpmRate = "9";
    const patchedEarnings = patchSnapshotSection(target, "earnings", source);
    assert.equal(patchedEarnings.maxEarningsPerCreator, "70");
    assert.equal(patchedEarnings.bonusEnabled, true);
    assert.equal(patchedEarnings.bonusHtml, "<p>bonus</p>");
    assert.equal(patchedEarnings.cpmRate, "1");

    const patchedPrize = patchSnapshotSection(target, "prize", source);
    assert.equal(patchedPrize.maxEarningsPerCreator, "");
    assert.equal(patchedPrize.cpmRate, "9");
  });

  it("keeps earnings All when payout differs across platforms", () => {
    const youtube = createDefaultPlatformCampaignSnapshot();
    youtube.cpmRate = "1";
    youtube.maxEarningsPerCreator = "50";
    youtube.bonusEnabled = true;
    youtube.bonusHtml = "<p>same</p>";
    const instagram = createDefaultPlatformCampaignSnapshot();
    instagram.cpmRate = "2";
    instagram.maxEarningsPerCreator = "50";
    instagram.bonusEnabled = true;
    instagram.bonusHtml = "<p>same</p>";

    const { tabs, allLive } = deriveSectionPlatformUiState(
      ["youtube", "instagram"],
      { youtube, instagram },
    );
    assert.equal(tabs.prize, "youtube");
    assert.equal(allLive.prize, false);
    assert.equal(tabs.earnings, "all");
    assert.equal(allLive.earnings, true);
  });

  it("persists creator earnings on top-level columns, not platform payout objects", () => {
    const youtube = createDefaultPlatformCampaignSnapshot();
    youtube.maxEarningsPerCreator = "70";
    youtube.bonusEnabled = true;
    youtube.bonusHtml = "<p>yt</p>";
    const instagram = createDefaultPlatformCampaignSnapshot();
    instagram.maxEarningsPerCreator = "40";
    instagram.bonusEnabled = true;
    instagram.bonusHtml = "<p>ig</p>";

    const columns = buildPlatformCreatorEarningsColumns(
      ["youtube", "instagram"],
      { youtube, instagram },
    );
    assert.deepEqual(columns.max_earnings_per_creator, {
      youtube: { max_earnings_per_creator: 7000 },
      instagram: { max_earnings_per_creator: 4000 },
    });
    assert.equal(
      (columns.bonus_details as Record<string, { description_html?: string }>)
        .youtube?.description_html,
      "<p>yt</p>",
    );
    assert.equal(
      (columns.bonus_details as Record<string, { max_earnings_per_creator?: number }>)
        .instagram?.max_earnings_per_creator,
      undefined,
    );

    const persisted = snapshotToPersistedPlatformCampaign(youtube);
    assert.equal(
      (persisted as { bonus_details?: unknown }).bonus_details,
      undefined,
    );
    assert.equal(
      (persisted as { max_earnings_per_creator?: unknown })
        .max_earnings_per_creator,
      undefined,
    );
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
