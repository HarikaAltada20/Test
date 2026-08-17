import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildVideoDownloadFilename,
  buildViewsBasedVideoFilename,
  formatQualityScorePart,
  joinedRecordUsername,
  parseVideoFilenamePattern,
  uniqueVideoDownloadFilename,
} from "./video-download-filename";

describe("video download filename patterns", () => {
  it("defaults unknown patterns to views only", () => {
    assert.equal(parseVideoFilenamePattern("nope"), "views");
    assert.equal(parseVideoFilenamePattern("views_username"), "views_username");
  });

  it("uses the raw view count without leading zeros", () => {
    const a = buildVideoDownloadFilename("views", { views: 999 });
    const b = buildVideoDownloadFilename("views", { views: 1500 });
    assert.equal(a, "999");
    assert.equal(b, "1500");
    assert.equal(buildViewsBasedVideoFilename(1500), "1500");
  });

  it("builds views_username names", () => {
    assert.equal(
      buildVideoDownloadFilename("views_username", {
        views: 12500,
        username: "Jane Creator!",
      }),
      "12500_Jane_Creator",
    );
  });

  it("builds views_username_status_quality_score names", () => {
    assert.equal(
      buildVideoDownloadFilename("views_username_status_quality_score", {
        views: 12500,
        username: "jane_creator",
        status: "verified",
        qualityScore: 3,
      }),
      "12500_jane_creator_verified_3",
    );
  });

  it("uses fallbacks for missing username, status, and quality", () => {
    assert.equal(
      buildVideoDownloadFilename("views_username_status_quality_score", {
        views: 10,
      }),
      "10_unknown_unknown_unscored",
    );
    assert.equal(formatQualityScorePart(null), "unscored");
    assert.equal(formatQualityScorePart(2.4), "2");
  });

  it("disambiguates duplicate filenames with a suffix", () => {
    const used = new Set<string>();
    const first = uniqueVideoDownloadFilename(used, "views", { views: 100 });
    const second = uniqueVideoDownloadFilename(used, "views", {
      views: 100,
      uniqueSuffix: "abcd1234",
    });
    assert.equal(first, "100.mp4");
    assert.equal(second, "100_abcd1234.mp4");
    assert.deepEqual([...used], [first, second]);
  });

  it("reads username from supabase join shapes", () => {
    assert.equal(joinedRecordUsername({ username: "alice" }), "alice");
    assert.equal(joinedRecordUsername([{ username: "bob" }]), "bob");
    assert.equal(joinedRecordUsername(null), "");
  });
});
