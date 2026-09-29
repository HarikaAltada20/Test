import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  leaderboardBannerCountsFromPayload,
  leaderboardSubmissionBannerCounts,
} from "./leaderboard-submission-counts";

describe("leaderboardSubmissionBannerCounts", () => {
  it("matches single-platform banner math: active = total - rejected", () => {
    assert.deepEqual(leaderboardSubmissionBannerCounts(57, 51), {
      total: 57,
      rejected: 51,
      active: 6,
    });
  });

  it("does not treat the full contest total as active", () => {
    const allTab = leaderboardSubmissionBannerCounts(57, 51);
    assert.equal(allTab.active, 6);
    assert.notEqual(allTab.active, allTab.total);
  });

  it("keeps platform-scoped totals separate from contest-wide totals", () => {
    const youtube = leaderboardSubmissionBannerCounts(10, 4);
    const all = leaderboardSubmissionBannerCounts(57, 51);
    assert.deepEqual(youtube, { total: 10, rejected: 4, active: 6 });
    assert.equal(all.total, 57);
    assert.equal(youtube.total, 10);
  });

  it("clamps rejected so it cannot exceed total", () => {
    assert.deepEqual(leaderboardSubmissionBannerCounts(3, 9), {
      total: 3,
      rejected: 3,
      active: 0,
    });
  });

  it("maps All vs platform payloads without mixing contest-wide total into a tab", () => {
    const all = leaderboardBannerCountsFromPayload({
      totalSubmissions: 57,
      rejectedCount: 4,
      totalEntries: 53,
    });
    const youtube = leaderboardBannerCountsFromPayload({
      totalSubmissions: 6,
      rejectedCount: 0,
      totalEntries: 6,
    });
    assert.deepEqual(all, { total: 57, rejected: 4, active: 53 });
    assert.deepEqual(youtube, { total: 6, rejected: 0, active: 6 });
    assert.notEqual(youtube.total, all.total);
    assert.notEqual(all.active, all.total);
  });
});
