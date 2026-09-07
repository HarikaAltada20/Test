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
  prizePoolCentsForPlatformScope,
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
  leaderboardPrizeStructuresDifferAcrossPlatforms,
  resolveLeaderboardPrizeRankingPlan,
  resolveFlatFeeBonusPlan,
  resolveLeaderboardFlatFeeBonusBudgetCents,
  resolveLeaderboardFlatFeeBonusSpentCents,
  resolveFlatFeeBonusListDisplay,
  flatFeeBonusesDifferAcrossPlatforms,
  leaderboardBonusBudgetsDifferAcrossPlatforms,
  sumLeaderboardBonusBudgetCents,
  briefsDifferAcrossPlatforms,
  rulesDifferAcrossPlatforms,
  inspirationLinksDifferAcrossPlatforms,
  resourcesDifferAcrossPlatforms,
  bonusDetailsDifferAcrossPlatforms,
  maxEarningsDifferAcrossPlatforms,
  videoPayoutConfigsDifferAcrossPlatforms,
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

    const ytLb = createDefaultPlatformCampaignSnapshot();
    ytLb.totalPrizePool = 10_000;
    ytLb.flatFeeBonus = "2";
    ytLb.totalBudget = "40";
    const igLb = createDefaultPlatformCampaignSnapshot();
    igLb.totalPrizePool = 4_000;
    igLb.flatFeeBonus = "5";
    igLb.totalBudget = "25";
    assert.equal(
      sumSnapshotChargeableCents(["youtube", "instagram"], {
        youtube: ytLb,
        instagram: igLb,
      }),
      14_000 + 4_000 + 2_500,
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

  it("keeps per-platform leaderboard bonus budgets when earnings tab is not All", () => {
    const tabs = createDefaultSectionPlatforms();
    tabs.earnings = "youtube";
    tabs.prize = "youtube";
    const live = createDefaultAllSectionLive();
    live.earnings = false;
    live.prize = false;

    const current = createDefaultPlatformCampaignSnapshot();
    current.contestType = "leaderboard";
    current.flatFeeBonus = "2";
    current.totalBudget = "40";
    current.totalPrizePool = 24_000;

    const yt = createDefaultPlatformCampaignSnapshot();
    yt.contestType = "leaderboard";
    yt.flatFeeBonus = "2";
    yt.totalBudget = "10";
    yt.totalPrizePool = 24_000;

    const ig = createDefaultPlatformCampaignSnapshot();
    ig.contestType = "leaderboard";
    ig.flatFeeBonus = "3";
    ig.totalBudget = "15";
    ig.totalPrizePool = 10_000;

    const prepared = preparePlatformCampaignsForSave(
      ["youtube", "instagram"],
      tabs,
      current,
      { youtube: yt, instagram: ig },
      live,
    );

    assert.equal(prepared.youtube?.totalBudget, "40");
    assert.equal(prepared.instagram?.totalBudget, "15");
    assert.equal(prepared.youtube?.flatFeeBonus, "2");
    assert.equal(prepared.instagram?.flatFeeBonus, "3");
  });

  it("applies All-tab leaderboard bonus budget to every platform on save", () => {
    const tabs = createDefaultSectionPlatforms();
    tabs.earnings = "all";
    const live = createDefaultAllSectionLive();
    live.earnings = false;

    const current = createDefaultPlatformCampaignSnapshot();
    current.contestType = "leaderboard";
    current.flatFeeBonus = "2";
    current.totalBudget = "40";

    const yt = createDefaultPlatformCampaignSnapshot();
    yt.contestType = "leaderboard";
    yt.flatFeeBonus = "1";
    yt.totalBudget = "10";
    const ig = createDefaultPlatformCampaignSnapshot();
    ig.contestType = "leaderboard";
    ig.flatFeeBonus = "3";
    ig.totalBudget = "15";

    const prepared = preparePlatformCampaignsForSave(
      ["youtube", "instagram"],
      tabs,
      current,
      { youtube: yt, instagram: ig },
      live,
    );

    assert.equal(prepared.youtube?.totalBudget, "40");
    assert.equal(prepared.instagram?.totalBudget, "40");
    assert.equal(prepared.youtube?.flatFeeBonus, "2");
    assert.equal(prepared.instagram?.flatFeeBonus, "2");
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

  it("keeps leaderboard Total Budget for Bonuses per platform", () => {
    const tabs = createDefaultSectionPlatforms();
    tabs.earnings = "youtube";
    tabs.prize = "youtube";
    const live = createDefaultAllSectionLive();
    live.earnings = false;
    live.prize = false;

    const current = createDefaultPlatformCampaignSnapshot();
    current.contestType = "leaderboard";
    current.flatFeeBonus = "2";
    current.totalBudget = "40";
    current.totalPrizePool = 24_000;

    const existingIg = createDefaultPlatformCampaignSnapshot();
    existingIg.contestType = "leaderboard";
    existingIg.flatFeeBonus = "1";
    existingIg.totalBudget = "15";
    existingIg.totalPrizePool = 10_000;

    const flushed = buildFlushedPlatformCampaigns(
      ["youtube", "instagram"],
      tabs,
      current,
      { instagram: existingIg },
      live,
    );

    assert.equal(flushed.youtube?.totalBudget, "40");
    assert.equal(flushed.instagram?.totalBudget, "15");
    assert.equal(flushed.youtube?.flatFeeBonus, "2");
    assert.equal(flushed.instagram?.flatFeeBonus, "1");
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

describe("prizePoolCentsForPlatformScope", () => {
  it("uses the stored Instagram prize pool when earnings is on Instagram", () => {
    const youtube = createDefaultPlatformCampaignSnapshot();
    youtube.totalPrizePool = 10_000;
    const instagram = createDefaultPlatformCampaignSnapshot();
    instagram.totalPrizePool = 6_000;
    assert.equal(
      prizePoolCentsForPlatformScope({
        scopeTab: "instagram",
        prizeTab: "youtube",
        selected: ["youtube", "instagram"],
        snapshots: { youtube, instagram },
        livePrizePoolCents: 10_000,
      }),
      6_000,
    );
  });

  it("uses the live prize editor when earnings and prize tabs match", () => {
    const youtube = createDefaultPlatformCampaignSnapshot();
    youtube.totalPrizePool = 10_000;
    assert.equal(
      prizePoolCentsForPlatformScope({
        scopeTab: "youtube",
        prizeTab: "youtube",
        selected: ["youtube", "instagram"],
        snapshots: { youtube },
        livePrizePoolCents: 12_000,
      }),
      12_000,
    );
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

describe("per-platform leaderboard prize and flat fee display", () => {
  const platforms = ["youtube", "instagram"] as const;

  it("keeps prize structures equal when amounts match", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      totalPrizePool: 6_000,
      winnerCount: 3,
      winnerAmounts: [3_000, 2_000, 1_000],
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      totalPrizePool: 6_000,
      winnerCount: 3,
      winnerAmounts: [3_000, 2_000, 1_000],
    });
    assert.equal(
      leaderboardPrizeStructuresDifferAcrossPlatforms(
        { youtube, instagram },
        [...platforms],
      ),
      false,
    );
    const plan = resolveLeaderboardPrizeRankingPlan(
      { youtube, instagram },
      "youtube,instagram",
    );
    assert.equal(plan.rankAcrossAllPlatforms, true);
    assert.equal(plan.sharedPrizes[0]?.amount, 3_000);
  });

  it("detects different prize amounts across platforms", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      totalPrizePool: 6_000,
      winnerCount: 3,
      winnerAmounts: [3_000, 2_000, 1_000],
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      totalPrizePool: 9_000,
      winnerCount: 3,
      winnerAmounts: [5_000, 3_000, 1_000],
    });
    assert.equal(
      leaderboardPrizeStructuresDifferAcrossPlatforms(
        { youtube, instagram },
        [...platforms],
      ),
      true,
    );
    const plan = resolveLeaderboardPrizeRankingPlan(
      { youtube, instagram },
      "youtube,instagram",
    );
    assert.equal(plan.rankAcrossAllPlatforms, false);
    assert.equal(plan.prizesByPlatform.youtube?.[0]?.amount, 3_000);
    assert.equal(plan.prizesByPlatform.instagram?.[0]?.amount, 5_000);
  });

  it("detects different flat fee bonuses and bonus budgets", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      flatFeeBonus: "2",
      totalBudget: "30",
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      flatFeeBonus: "1",
      totalBudget: "50",
    });
    assert.equal(
      flatFeeBonusesDifferAcrossPlatforms({ youtube, instagram }, [...platforms]),
      true,
    );
    assert.equal(
      leaderboardBonusBudgetsDifferAcrossPlatforms(
        { youtube, instagram },
        [...platforms],
      ),
      true,
    );
    assert.equal(
      sumLeaderboardBonusBudgetCents({ youtube, instagram }, [...platforms]),
      8_000,
    );
    const plan = resolveFlatFeeBonusPlan(
      { youtube, instagram },
      "youtube,instagram",
      "leaderboard",
    );
    assert.equal(plan.shareAcrossAllPlatforms, false);
    assert.equal(plan.byPlatform.youtube?.amountCents, 200);
    assert.equal(plan.byPlatform.instagram?.amountCents, 100);
  });

  it("treats matching flat fees as a whole-contest value", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      flatFeeBonus: "2",
      totalBudget: "30",
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      flatFeeBonus: "2",
      totalBudget: "30",
    });
    assert.equal(
      flatFeeBonusesDifferAcrossPlatforms({ youtube, instagram }, [...platforms]),
      false,
    );
    assert.equal(
      leaderboardBonusBudgetsDifferAcrossPlatforms(
        { youtube, instagram },
        [...platforms],
      ),
      false,
    );
  });

  it("sums matching per-platform bonus budgets instead of sharing one pool", () => {
    const campaign = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      flatFeeBonus: "2",
      totalBudget: "50",
    });
    const details = {
      youtube: campaign,
      instagram: campaign,
      tiktok: campaign,
      leaderboard_contest: { budget_spent: 12_800 },
    };
    assert.equal(
      resolveLeaderboardFlatFeeBonusBudgetCents(
        details,
        "youtube,instagram,tiktok",
      ),
      15_000,
    );
    const plan = resolveFlatFeeBonusPlan(
      details,
      "youtube,instagram,tiktok",
      "leaderboard",
    );
    assert.equal(plan.shareAcrossAllPlatforms, false);
  });

  it("sums per-platform bonus spend when present", () => {
    assert.equal(
      resolveLeaderboardFlatFeeBonusSpentCents(
        {
          youtube: {
            contest_type: "leaderboard",
            leaderboard_contest: { budget_spent: 4_000 },
          },
          instagram: {
            contest_type: "leaderboard",
            leaderboard_contest: { budget_spent: 8_000 },
          },
          tiktok: {
            contest_type: "leaderboard",
            leaderboard_contest: { budget_spent: 1_200 },
          },
          leaderboard_contest: { budget_spent: 12_800 },
        },
        "youtube,instagram,tiktok",
      ),
      13_200,
    );
  });

  it("sums differing per-platform bonus budgets", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      flatFeeBonus: "2",
      totalBudget: "30",
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      flatFeeBonus: "1",
      totalBudget: "50",
    });
    assert.equal(
      resolveLeaderboardFlatFeeBonusBudgetCents(
        { youtube, instagram },
        "youtube,instagram",
      ),
      8_000,
    );
  });

  it("falls back to root leaderboard total_budget", () => {
    assert.equal(
      resolveLeaderboardFlatFeeBonusBudgetCents({
        leaderboard_contest: { total_budget: 9_000, flat_fee_bonus: 100 },
      }),
      9_000,
    );
  });

  it("uses a shared list badge when per-submission bonuses match", () => {
    const campaign = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      flatFeeBonus: "4",
      totalBudget: "120",
    });
    assert.deepEqual(
      resolveFlatFeeBonusListDisplay(
        { youtube: campaign, instagram: campaign, tiktok: campaign },
        "youtube,instagram,tiktok",
        "leaderboard",
      ),
      { kind: "shared", amountCents: 400 },
    );
  });

  it("splits the list badge by platform when per-submission bonuses differ", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      flatFeeBonus: "4",
      totalBudget: "120",
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      flatFeeBonus: "2",
      totalBudget: "80",
    });
    assert.deepEqual(
      resolveFlatFeeBonusListDisplay(
        { youtube, instagram },
        "youtube,instagram",
        "leaderboard",
      ),
      {
        kind: "byPlatform",
        rows: [
          { platform: "youtube", amountCents: 400 },
          { platform: "instagram", amountCents: 200 },
        ],
      },
    );
  });
});

describe("content differ-across-platforms helpers", () => {
  const platforms = ["youtube", "instagram"] as const;

  it("detects differing briefs and matching rules", () => {
    const contest = {
      platform: "youtube,instagram",
      brief_html: "",
      brief_json: {
        youtube: { html: "<p>YT brief</p>", json: null },
        instagram: { html: "<p>IG brief</p>", json: null },
      },
      rules_html: "",
      rules_json: {
        youtube: { html: "<p>Same rules</p>", json: null },
        instagram: { html: "<p>Same rules</p>", json: null },
      },
    };
    assert.equal(briefsDifferAcrossPlatforms(contest, [...platforms]), true);
    assert.equal(rulesDifferAcrossPlatforms(contest, [...platforms]), false);
  });

  it("detects differing inspiration links and resources", () => {
    const links = {
      youtube: [{ url: "https://yt.example", description: "a" }],
      instagram: [{ url: "https://ig.example", description: "b" }],
    };
    const sameLinks = {
      youtube: [{ url: "https://same.example", description: "x" }],
      instagram: [{ url: "https://same.example", description: "x" }],
    };
    assert.equal(
      inspirationLinksDifferAcrossPlatforms(links, [...platforms]),
      true,
    );
    assert.equal(
      inspirationLinksDifferAcrossPlatforms(sameLinks, [...platforms]),
      false,
    );

    const resources = {
      youtube: [{ url: "https://yt.res", description: "yt", type: "link" }],
      instagram: [{ url: "https://ig.res", description: "ig", type: "link" }],
    };
    assert.equal(resourcesDifferAcrossPlatforms(resources, [...platforms]), true);
  });

  it("detects differing creator bonus and max earnings", () => {
    assert.equal(
      bonusDetailsDifferAcrossPlatforms(
        {
          youtube: { description_html: "<p>YT bonus</p>" },
          instagram: { description_html: "<p>IG bonus</p>" },
        },
        [...platforms],
      ),
      true,
    );
    assert.equal(
      bonusDetailsDifferAcrossPlatforms(
        {
          youtube: { description_html: "<p>Shared</p>" },
          instagram: { description_html: "<p>Shared</p>" },
        },
        [...platforms],
      ),
      false,
    );
    assert.equal(
      maxEarningsDifferAcrossPlatforms(
        { youtube: 5000, instagram: 7000 },
        null,
        [...platforms],
      ),
      true,
    );
    assert.equal(
      maxEarningsDifferAcrossPlatforms(
        { youtube: 5000, instagram: 5000 },
        null,
        [...platforms],
      ),
      false,
    );
  });

  it("detects differing CPM payout configs", () => {
    const youtube = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      cpmRate: "1",
      totalBudget: "100",
    });
    const instagram = snapshotToPersistedPlatformCampaign({
      ...createDefaultPlatformCampaignSnapshot(),
      contestType: "cpm",
      cpmRate: "2",
      totalBudget: "100",
    });
    assert.equal(
      videoPayoutConfigsDifferAcrossPlatforms(
        { youtube, instagram },
        [...platforms],
      ),
      true,
    );
    assert.equal(
      videoPayoutConfigsDifferAcrossPlatforms(
        { youtube, instagram: youtube },
        [...platforms],
      ),
      false,
    );
  });
});
