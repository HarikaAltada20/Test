import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPerformanceMetrics,
  computeEngagementRate,
  getCreatorProfileUrl,
  getModerationOptions,
  getReviewOpenUrl,
  isVerticalReviewContent,
  resolveClipSeconds,
} from "./review-metrics";

const valueOf = (items: { key: string; value: string }[], key: string) =>
  items.find((item) => item.key === key)?.value;

describe("review-metrics", () => {
  it("uses the stored engagement rate when present", () => {
    assert.equal(computeEngagementRate({ engagement_rate: 4.2, views: 100 }), 4.2);
  });

  it("computes engagement from interactions when the platform omits it", () => {
    assert.equal(computeEngagementRate({ views: 1000, total_interactions: 50 }), 5);
    assert.equal(
      computeEngagementRate({ views: 1000, likes: 10, comments: 5, shares: 3, saves: 2 }),
      2,
    );
    assert.equal(computeEngagementRate({ reach: 200, likes: 10 }), 5);
    assert.equal(computeEngagementRate({ views: 0 }), null);
    assert.equal(computeEngagementRate({ views: 100 }), null);
  });

  it("maps moderation options per status", () => {
    assert.deepEqual(getModerationOptions("paid"), {
      locked: true,
      canApprove: false,
      canReject: false,
      canMoveToPending: false,
    });
    for (const status of ["verified", "approved"]) {
      assert.deepEqual(getModerationOptions(status), {
        locked: false,
        canApprove: false,
        canReject: true,
        canMoveToPending: true,
      });
    }
    assert.deepEqual(getModerationOptions("rejected"), {
      locked: false,
      canApprove: true,
      canReject: false,
      canMoveToPending: true,
    });
    assert.deepEqual(getModerationOptions("pending"), {
      locked: false,
      canApprove: true,
      canReject: true,
      canMoveToPending: false,
    });
  });

  it("detects vertical content", () => {
    assert.equal(isVerticalReviewContent("instagram", "https://instagram.com/reel/x"), true);
    assert.equal(isVerticalReviewContent("tiktok", null), true);
    assert.equal(
      isVerticalReviewContent("youtube", "https://www.youtube.com/shorts/abcdefghijk"),
      true,
    );
    const watch = "https://www.youtube.com/watch?v=abcdefghijk";
    assert.equal(isVerticalReviewContent("youtube", watch), false);
    assert.equal(isVerticalReviewContent("youtube", watch, { title: "Funny #shorts" }), true);
    assert.equal(isVerticalReviewContent("youtube", watch, { durationSeconds: 45 }), true);
    assert.equal(isVerticalReviewContent("youtube", watch, { durationSeconds: 600 }), false);
  });

  it("opens YouTube in the Shorts or watch player", () => {
    const link = "https://youtu.be/abcdefghijk";
    assert.equal(
      getReviewOpenUrl("youtube", link, true),
      "https://www.youtube.com/shorts/abcdefghijk",
    );
    assert.equal(
      getReviewOpenUrl("youtube", link, false),
      "https://www.youtube.com/watch?v=abcdefghijk",
    );
    assert.equal(
      getReviewOpenUrl("instagram", "https://instagram.com/reel/x/", true),
      "https://instagram.com/reel/x/",
    );
    assert.equal(getReviewOpenUrl("youtube", null, true), null);
  });

  it("builds creator profile URLs", () => {
    assert.equal(
      getCreatorProfileUrl("instagram", "@page_handle"),
      "https://www.instagram.com/page_handle/",
    );
    assert.equal(
      getCreatorProfileUrl("youtube", "@channel"),
      "https://www.youtube.com/@channel",
    );
    assert.equal(
      getCreatorProfileUrl("youtube", "UCabcdefghijklmnopqrstuv"),
      "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv",
    );
    assert.equal(getCreatorProfileUrl("tiktok", "maker"), "https://www.tiktok.com/@maker");
    assert.equal(getCreatorProfileUrl("instagram", "Unknown User"), null);
    assert.equal(getCreatorProfileUrl("instagram", ""), null);
    assert.equal(getCreatorProfileUrl("other", "someone"), null);
  });

  it("prefers stored clip length over the player's", () => {
    assert.equal(resolveClipSeconds({ duration_seconds: 30 }, 12), 30);
    assert.equal(resolveClipSeconds({ duration_seconds: null }, 12), 12);
    assert.equal(resolveClipSeconds({}, null), null);
    assert.equal(resolveClipSeconds({ duration_seconds: 0 }, 0), null);
  });

  it("normalizes Instagram skip rate fractions to percentages", () => {
    const fraction = buildPerformanceMetrics("instagram", { reels_skip_rate: 0.45 }, true);
    assert.equal(valueOf(fraction, "skip"), "45.0%");
    const percent = buildPerformanceMetrics("instagram", { reels_skip_rate: 62.5 }, true);
    assert.equal(valueOf(percent, "skip"), "62.5%");
    const missing = buildPerformanceMetrics("instagram", {}, true);
    assert.equal(valueOf(missing, "skip"), "-");
  });

  it("computes Instagram avg watch % from the resolved clip length", () => {
    const items = buildPerformanceMetrics("instagram", { avg_watch_time_ms: 6000 }, true, 12);
    assert.equal(valueOf(items, "avg_watch_pct"), "50%");
    assert.equal(valueOf(items, "clip"), "12s");
  });
});
