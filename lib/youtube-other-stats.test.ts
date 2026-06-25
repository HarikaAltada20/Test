import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOtherStatsWithYoutube,
  getExistingYouTubeStats,
  parseSubmissionOtherStats,
} from "./youtube-other-stats";
import {
  isContestEligibleForScheduledMetricsRefresh,
  isPostContestMetricsLocked,
} from "./contest-metrics-refresh-eligibility";

describe("youtube-other-stats", () => {
  it("parses stringified other_stats", () => {
    const raw =
      '{"youtube":{"likes":40,"views":3155},"traffic_sources":{"SHORTS":90}}';
    const parsed = parseSubmissionOtherStats(raw);
    assert.ok(parsed.youtube);
    assert.deepEqual(parsed.traffic_sources, { SHORTS: 90 });
  });

  it("merges nested youtube with legacy root-level youtube metrics", () => {
    const raw = {
      youtube: { likes: 40, views: 3155, comments: 1 },
      traffic_sources: { SHORTS: 97.4 },
      estimated_minutes_watched: 43,
    };
    const merged = getExistingYouTubeStats(raw);
    assert.equal(merged.likes, 40);
    assert.deepEqual(merged.traffic_sources, { SHORTS: 97.4 });
    assert.equal(merged.estimated_minutes_watched, 43);
  });

  it("preserves detailed metrics when patching basic fields", () => {
    const raw = {
      youtube: { likes: 40, views: 3000, comments: 1 },
      traffic_sources: { SHORTS: 50 },
      demographics: { gender: { male: 100 } },
    };
    const next = buildOtherStatsWithYoutube(raw, {
      views: 3155,
      likes: 40,
      comments: 1,
      last_basic_update: "2026-06-25T01:32:08.577Z",
    });
    const yt = (next.youtube ?? {}) as Record<string, unknown>;
    assert.equal(yt.views, 3155);
    assert.deepEqual(yt.traffic_sources, { SHORTS: 50 });
    assert.deepEqual(yt.demographics, { gender: { male: 100 } });
  });
});

describe("contest-metrics-refresh-eligibility", () => {
  it("locks in_review and later statuses", () => {
    assert.equal(isPostContestMetricsLocked("in_review"), true);
    assert.equal(isPostContestMetricsLocked("verification_complete"), true);
    assert.equal(isPostContestMetricsLocked("pending_review"), false);
    assert.equal(isPostContestMetricsLocked(null), false);
  });

  it("allows pending_review contests without views lock", () => {
    assert.equal(
      isContestEligibleForScheduledMetricsRefresh({
        views_locked_at: null,
        post_contest_status: "pending_review",
      }),
      true,
    );
    assert.equal(
      isContestEligibleForScheduledMetricsRefresh({
        views_locked_at: null,
        post_contest_status: "in_review",
      }),
      false,
    );
  });
});
