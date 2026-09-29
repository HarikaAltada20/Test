import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  METRICS_REFRESH_PLATFORM_ORDER,
  MULTI_PLATFORM_YOUTUBE_REFRESH_SCOPE,
  parseRequestedRefreshPlatforms,
  partitionRefreshPlatformsByQueueAvailability,
  platformsForRefreshTab,
  resolveLiveContestVideoPlatforms,
  resolveMetricsRefreshPlatformQueue,
  resolveSequentialRefreshPollIndex,
  youtubeScopeForMetricsRefresh,
  platformsWithLocalSubmissionsForRefresh,
} from "./multi-platform-metrics-refresh";
import { ALL_PLATFORM_TAB } from "./video-platform-campaigns";

describe("METRICS_REFRESH_PLATFORM_ORDER", () => {
  it("is YouTube then Instagram then TikTok", () => {
    assert.deepEqual([...METRICS_REFRESH_PLATFORM_ORDER], [
      "youtube",
      "instagram",
      "tiktok",
    ]);
  });
});

describe("parseRequestedRefreshPlatforms", () => {
  it("parses and dedupes valid platforms", () => {
    assert.deepEqual(
      parseRequestedRefreshPlatforms(["Instagram", "youtube", "instagram"]),
      ["instagram", "youtube"],
    );
  });

  it("drops invalid tokens", () => {
    assert.deepEqual(parseRequestedRefreshPlatforms(["twitter", "foo", 1]), []);
  });
});

describe("resolveMetricsRefreshPlatformQueue", () => {
  it("orders All / unrestricted as YouTube → Instagram → TikTok", () => {
    assert.deepEqual(
      resolveMetricsRefreshPlatformQueue({
        allowedPlatforms: ["tiktok", "youtube", "instagram"],
      }),
      ["youtube", "instagram", "tiktok"],
    );
  });

  it("filters to two campaign platforms in fixed order", () => {
    assert.deepEqual(
      resolveMetricsRefreshPlatformQueue({
        allowedPlatforms: ["instagram", "tiktok"],
      }),
      ["instagram", "tiktok"],
    );
    assert.deepEqual(
      resolveMetricsRefreshPlatformQueue({
        allowedPlatforms: ["youtube", "tiktok"],
      }),
      ["youtube", "tiktok"],
    );
  });

  it("honors requested single platform", () => {
    assert.deepEqual(
      resolveMetricsRefreshPlatformQueue({
        allowedPlatforms: ["youtube", "instagram", "tiktok"],
        requestedPlatforms: ["instagram"],
      }),
      ["instagram"],
    );
  });

  it("intersects requested with allowed", () => {
    assert.deepEqual(
      resolveMetricsRefreshPlatformQueue({
        allowedPlatforms: ["youtube", "instagram"],
        requestedPlatforms: ["instagram", "tiktok"],
      }),
      ["instagram"],
    );
  });
});

describe("partitionRefreshPlatformsByQueueAvailability", () => {
  it("keeps unavailable platforms visible instead of silently dropping them", () => {
    assert.deepEqual(
      partitionRefreshPlatformsByQueueAvailability(
        ["youtube", "instagram", "tiktok"],
        { youtube: true, instagram: false, tiktok: true },
      ),
      {
        available: ["youtube", "tiktok"],
        unavailable: ["instagram"],
      },
    );
  });
});

describe("platformsForRefreshTab", () => {
  it("returns ordered campaign platforms for All", () => {
    assert.deepEqual(
      platformsForRefreshTab(ALL_PLATFORM_TAB, [
        "tiktok",
        "youtube",
        "instagram",
      ]),
      ["youtube", "instagram", "tiktok"],
    );
  });

  it("returns only the selected tab platform", () => {
    assert.deepEqual(
      platformsForRefreshTab("instagram", ["youtube", "instagram", "tiktok"]),
      ["instagram"],
    );
  });

  it("falls back to campaign set when tab not in campaign", () => {
    assert.deepEqual(platformsForRefreshTab("tiktok", ["youtube", "instagram"]), [
      "youtube",
      "instagram",
    ]);
  });
});

describe("resolveLiveContestVideoPlatforms", () => {
  it("parses hybrid CSV into fixed order", () => {
    assert.deepEqual(
      resolveLiveContestVideoPlatforms("instagram,youtube,tiktok"),
      ["youtube", "instagram", "tiktok"],
    );
  });
});

describe("resolveSequentialRefreshPollIndex", () => {
  it("points at the first non-terminal platform", () => {
    assert.equal(
      resolveSequentialRefreshPollIndex([
        { tracked: true, terminal: true },
        { tracked: true, terminal: false },
        { tracked: false, terminal: false },
      ]),
      1,
    );
  });

  it("points at the next unstarted platform after prior terminals", () => {
    assert.equal(
      resolveSequentialRefreshPollIndex([
        { tracked: true, terminal: true },
        { tracked: false, terminal: false },
        { tracked: false, terminal: false },
      ]),
      1,
    );
  });

  it("returns length when all platforms are done", () => {
    assert.equal(
      resolveSequentialRefreshPollIndex([
        { tracked: true, terminal: true },
        { tracked: true, terminal: true },
      ]),
      2,
    );
  });
});

describe("youtubeScopeForMetricsRefresh", () => {
  it("uses all for multi-platform campaigns", () => {
    assert.equal(
      youtubeScopeForMetricsRefresh({ campaignPlatformCount: 2 }),
      MULTI_PLATFORM_YOUTUBE_REFRESH_SCOPE,
    );
    assert.equal(
      youtubeScopeForMetricsRefresh({ campaignPlatformCount: 3 }),
      "all",
    );
  });

  it("uses basic for single-platform campaigns", () => {
    assert.equal(
      youtubeScopeForMetricsRefresh({ campaignPlatformCount: 1 }),
      "basic",
    );
  });

  it("honors an explicit requested scope", () => {
    assert.equal(
      youtubeScopeForMetricsRefresh({
        campaignPlatformCount: 3,
        requestedScope: "basic",
      }),
      "basic",
    );
  });

  it("forceBasic wins over multi-platform default and requestedScope", () => {
    assert.equal(
      youtubeScopeForMetricsRefresh({
        campaignPlatformCount: 3,
        forceBasic: true,
      }),
      "basic",
    );
    assert.equal(
      youtubeScopeForMetricsRefresh({
        campaignPlatformCount: 3,
        requestedScope: "all",
        forceBasic: true,
      }),
      "basic",
    );
  });

  it("admin multi-platform still defaults to all without forceBasic", () => {
    assert.equal(
      youtubeScopeForMetricsRefresh({
        campaignPlatformCount: 2,
        forceBasic: false,
      }),
      "all",
    );
  });
});

describe("platformsWithLocalSubmissionsForRefresh", () => {
  it("keeps only platforms with non-rejected submissions", () => {
    assert.deepEqual(
      platformsWithLocalSubmissionsForRefresh(
        ["youtube", "instagram", "tiktok"],
        [
          { platform: "youtube", status: "verified" },
          { platform: "instagram", status: "rejected" },
          { platform: "tiktok", status: "pending" },
        ],
      ),
      ["youtube", "tiktok"],
    );
  });
});
