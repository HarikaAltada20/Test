import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ContestAnalyticsExportSubmission } from "@/lib/contest-analytics-export";
import {
  computePlatformCampaignMetrics,
  getPlatformCampaignMetricCards,
} from "@/lib/contest-analytics-campaign-metrics";

function sub(
  overrides: Partial<ContestAnalyticsExportSubmission> & {
    other_stats?: Record<string, unknown> | null;
  },
): ContestAnalyticsExportSubmission {
  return {
    id: overrides.id ?? "s1",
    views: overrides.views ?? 0,
    platform: overrides.platform,
    other_stats: overrides.other_stats,
  };
}

describe("computePlatformCampaignMetrics", () => {
  it("sums nested likes/comments/shares on multi-platform contests", () => {
    const metrics = computePlatformCampaignMetrics(
      [
        sub({
          id: "ig",
          platform: "instagram",
          views: 1000,
          other_stats: {
            instagram: { likes: 10, comments: 2, shares: 1, reach: 800, saved: 4 },
          },
        }),
        sub({
          id: "yt",
          platform: "youtube",
          views: 2000,
          other_stats: { youtube: { likes: 20, comments: 3 } },
        }),
        sub({
          id: "tt",
          platform: "tiktok",
          views: 500,
          other_stats: {
            tiktok: { like_count: 5, comment_count: 1, share_count: 2 },
          },
        }),
      ],
      "youtube,instagram,tiktok",
    );

    assert.equal(metrics.submissions, 3);
    assert.equal(metrics.views, 3500);
    assert.equal(metrics.likes, 35);
    assert.equal(metrics.comments, 6);
    assert.equal(metrics.shares, 3);
  });

  it("reads Instagram Graph media count aliases", () => {
    const metrics = computePlatformCampaignMetrics(
      [
        sub({
          platform: "instagram",
          views: 100,
          other_stats: {
            instagram: {
              like_count: 7,
              comments_count: 4,
              shares_count: 3,
            },
          },
        }),
      ],
      "instagram",
    );

    assert.equal(metrics.likes, 7);
    assert.equal(metrics.comments, 4);
    assert.equal(metrics.shares, 3);
  });

  it("infers platform from nested other_stats when submission.platform is missing", () => {
    const metrics = computePlatformCampaignMetrics(
      [
        sub({
          views: 50,
          other_stats: { instagram: { likes: 9, comments: 2, shares: 1 } },
        }),
      ],
      "youtube,instagram,tiktok",
    );

    assert.equal(metrics.likes, 9);
    assert.equal(metrics.comments, 2);
    assert.equal(metrics.shares, 1);
  });
});

describe("getPlatformCampaignMetricCards", () => {
  it("uses combined cards for multi-platform contests and includes engagement", () => {
    const cards = getPlatformCampaignMetricCards(
      [
        sub({
          platform: "instagram",
          views: 100,
          other_stats: { instagram: { likes: 8, comments: 1, shares: 2 } },
        }),
      ],
      "youtube,instagram,tiktok",
    );

    const byLabel = Object.fromEntries(cards.map((c) => [c.label, c.value]));
    assert.equal(byLabel.Likes, 8);
    assert.equal(byLabel.Comments, 1);
    assert.equal(byLabel.Shares, 2);
    assert.equal(byLabel.Reach, undefined);
  });

  it("shows Instagram reach/saved cards when scoped to Instagram", () => {
    const cards = getPlatformCampaignMetricCards(
      [
        sub({
          platform: "instagram",
          views: 100,
          other_stats: {
            instagram: { likes: 8, comments: 1, shares: 2, reach: 90, saved: 5 },
          },
        }),
      ],
      "instagram",
    );

    const byLabel = Object.fromEntries(cards.map((c) => [c.label, c.value]));
    assert.equal(byLabel.Reach, 90);
    assert.equal(byLabel.Saved, 5);
  });
});
