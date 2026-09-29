import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contestMatchesAnalyticsContestTypes,
  contestMatchesAnalyticsPlatforms,
  hasAdminAnalyticsVideoPlatform,
  listAnalyticsContestPlatforms,
  normalizeAnalyticsPlatform,
  resolveAnalyticsSubmissionPlatform,
} from "@/lib/admin-analytics";

describe("listAnalyticsContestPlatforms", () => {
  it("parses multi-platform CSV contests", () => {
    assert.deepEqual(
      listAnalyticsContestPlatforms("youtube,instagram,tiktok"),
      ["youtube", "instagram", "tiktok"],
    );
  });

  it("normalizes twitter aliases", () => {
    assert.deepEqual(listAnalyticsContestPlatforms("x"), ["twitter"]);
  });
});

describe("normalizeAnalyticsPlatform", () => {
  it("returns primary video platform for multi-platform contests", () => {
    assert.equal(
      normalizeAnalyticsPlatform("youtube,instagram,tiktok"),
      "youtube",
    );
  });

  it("does not mark multi-platform contests as unknown", () => {
    assert.notEqual(
      normalizeAnalyticsPlatform("instagram,tiktok"),
      "unknown",
    );
  });
});

describe("contestMatchesAnalyticsPlatforms", () => {
  it("includes multi-platform contests when any selected platform overlaps", () => {
    const contest = { platform: "youtube,instagram,tiktok" };
    assert.equal(
      contestMatchesAnalyticsPlatforms(contest, ["instagram"]),
      true,
    );
    assert.equal(
      contestMatchesAnalyticsPlatforms(contest, ["youtube", "tiktok"]),
      true,
    );
    assert.equal(
      contestMatchesAnalyticsPlatforms(contest, ["twitter"]),
      false,
    );
  });
});

describe("hasAdminAnalyticsVideoPlatform", () => {
  it("accepts multi-platform video contests for admin analytics", () => {
    assert.equal(
      hasAdminAnalyticsVideoPlatform({
        platform: "youtube,instagram,tiktok",
      }),
      true,
    );
  });

  it("rejects twitter-only contests", () => {
    assert.equal(
      hasAdminAnalyticsVideoPlatform({ platform: "twitter" }),
      false,
    );
  });
});

describe("contestMatchesAnalyticsContestTypes", () => {
  it("matches multi-platform contests via nested platform contest types", () => {
    const contest = {
      contest_type: null,
      platform: "youtube,instagram",
      contest_based_details: {
        youtube: { contest_type: "cpm" },
        instagram: { contest_type: "milestone" },
      },
    };
    assert.equal(
      contestMatchesAnalyticsContestTypes(contest, ["milestone"]),
      true,
    );
    assert.equal(
      contestMatchesAnalyticsContestTypes(contest, ["leaderboard"]),
      false,
    );
  });
});

describe("resolveAnalyticsSubmissionPlatform", () => {
  it("prefers submission platform over contest CSV", () => {
    assert.equal(
      resolveAnalyticsSubmissionPlatform(
        "instagram",
        "youtube,instagram,tiktok",
      ),
      "instagram",
    );
  });

  it("infers platform from nested other_stats when submission platform is missing", () => {
    assert.equal(
      resolveAnalyticsSubmissionPlatform(
        null,
        "youtube,instagram,tiktok",
        null,
        { tiktok: { view_count: 10 } },
      ),
      "tiktok",
    );
  });

  it("does not treat multi-platform contest CSV as a single platform", () => {
    assert.equal(
      resolveAnalyticsSubmissionPlatform(null, "youtube,instagram,tiktok"),
      "unknown",
    );
  });
});
