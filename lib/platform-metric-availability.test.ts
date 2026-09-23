import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  creatorGroupHasMetric,
  videoPlatformHasMetric,
} from "./platform-metric-availability";

describe("videoPlatformHasMetric", () => {
  it("keeps shared metrics for every platform", () => {
    for (const platform of ["youtube", "instagram", "tiktok"]) {
      assert.equal(videoPlatformHasMetric(platform, "views"), true);
      assert.equal(videoPlatformHasMetric(platform, "likes"), true);
      assert.equal(videoPlatformHasMetric(platform, "comments"), true);
      assert.equal(videoPlatformHasMetric(platform, "shares"), true);
    }
  });

  it("treats YouTube-only columns as unavailable on Instagram and TikTok", () => {
    assert.equal(videoPlatformHasMetric("youtube", "dislikes"), true);
    assert.equal(videoPlatformHasMetric("instagram", "dislikes"), false);
    assert.equal(videoPlatformHasMetric("tiktok", "clip_duration"), false);
  });

  it("treats Instagram-only columns as unavailable on YouTube and TikTok", () => {
    assert.equal(videoPlatformHasMetric("instagram", "saves"), true);
    assert.equal(videoPlatformHasMetric("youtube", "saves"), false);
    assert.equal(videoPlatformHasMetric("tiktok", "avg_watch_time"), false);
  });

  it("treats TikTok-only columns as unavailable on YouTube and Instagram", () => {
    assert.equal(videoPlatformHasMetric("tiktok", "engagement_rate"), true);
    assert.equal(videoPlatformHasMetric("youtube", "total_interactions"), false);
    assert.equal(videoPlatformHasMetric("instagram", "total_engagement"), false);
  });
});

describe("creatorGroupHasMetric", () => {
  it("dashes platform-only metrics when the creator has no submissions on that platform", () => {
    const youtubeOnly = [{ platform: "youtube" }];
    assert.equal(creatorGroupHasMetric(youtubeOnly, "saves"), false);
    assert.equal(creatorGroupHasMetric(youtubeOnly, "engagement_rate"), false);
    assert.equal(creatorGroupHasMetric(youtubeOnly, "dislikes"), true);
    assert.equal(creatorGroupHasMetric(youtubeOnly, "views"), true);
  });

  it("keeps a metric when any submission on the creator is that platform", () => {
    const mixed = [{ platform: "youtube" }, { platform: "instagram" }];
    assert.equal(creatorGroupHasMetric(mixed, "saves"), true);
    assert.equal(creatorGroupHasMetric(mixed, "dislikes"), true);
    assert.equal(creatorGroupHasMetric(mixed, "engagement_rate"), false);
  });
});
