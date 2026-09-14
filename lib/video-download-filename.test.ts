import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBulkZipFilenamePrefix,
  buildVideoDownloadFilename,
  buildViewsBasedVideoFilename,
  formatBulkZipQualityPart,
  formatQualityScorePart,
  joinedRecordAdvertiserId,
  joinedRecordUsername,
  parseVideoFilenamePattern,
  slugifyBulkZipSort,
  slugifyBulkZipStatusTab,
  parseBulkZipFilenamePrefix,
  uniqueVideoDownloadFilename,
  toBulkZipDownloadFilename,
  bulkZipFilenameFromContestTitle,
} from "./video-download-filename";

describe("video download filename patterns", () => {
  it("defaults unknown patterns to views only", () => {
    assert.equal(parseVideoFilenamePattern("nope"), "views");
    assert.equal(parseVideoFilenamePattern("views_username"), "views_username");
  });

  it("zero-pads views so lexical sort matches numeric order", () => {
    const a = buildVideoDownloadFilename("views", { views: 999 });
    const b = buildVideoDownloadFilename("views", { views: 1500 });
    assert.equal(a < b, true);
    assert.equal(a, "000000000999");
    assert.equal(b, "000000001500");
    assert.equal(buildViewsBasedVideoFilename(1500), "000000001500");
  });

  it("prefixes sort rank so Explorer order matches table sort", () => {
    const first = buildVideoDownloadFilename("views", {
      views: 100,
      sortRank: 1,
      sortTotal: 125,
    });
    const second = buildVideoDownloadFilename("views", {
      views: 999999,
      sortRank: 2,
      sortTotal: 125,
    });
    assert.equal(first, "001_000000000100");
    assert.equal(second, "002_000000999999");
    assert.equal(first < second, true);
  });

  it("builds views_username names", () => {
    assert.equal(
      buildVideoDownloadFilename("views_username", {
        views: 12500,
        username: "Jane Creator!",
      }),
      "000000012500_Jane_Creator",
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
      "000000012500_jane_creator_verified_3",
    );
  });

  it("uses fallbacks for missing username, status, and quality", () => {
    assert.equal(
      buildVideoDownloadFilename("views_username_status_quality_score", {
        views: 10,
      }),
      "000000000010_unknown_unknown_unscored",
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
    assert.equal(first, "000000000100.mp4");
    assert.equal(second, "000000000100_abcd1234.mp4");
    assert.deepEqual([...used], [first, second]);
    const third = uniqueVideoDownloadFilename(used, "views", {
      views: 100,
      uniqueSuffix: "abcd1234",
    });
    assert.equal(third, "000000000100_abcd1234_2.mp4");
    assert.equal(used.has(third), true);
  });

  it("reads username from supabase join shapes", () => {
    assert.equal(joinedRecordUsername({ username: "alice" }), "alice");
    assert.equal(joinedRecordUsername([{ username: "bob" }]), "bob");
    assert.equal(joinedRecordUsername(null), "");
  });

  it("reads advertiser_id from contest join object or array", () => {
    assert.equal(
      joinedRecordAdvertiserId({ advertiser_id: "brand-1" }),
      "brand-1",
    );
    assert.equal(
      joinedRecordAdvertiserId([{ advertiser_id: "brand-2" }]),
      "brand-2",
    );
    assert.equal(joinedRecordAdvertiserId(null), null);
    assert.equal(joinedRecordAdvertiserId({ advertiser_id: "  " }), null);
  });

  it("names the ZIP after the contest title plus default filters", () => {
    assert.equal(
      bulkZipFilenameFromContestTitle(
        "Zahra Jani Premium Clips Challenge Milestone Rewards Original Edits only",
      ),
      "bulk_submissions_Zahra_Jani_Premium_Clips_Challenge_Miles_unsorted_all_quality_all.zip",
    );
    assert.equal(
      toBulkZipDownloadFilename("bulk_download_a14395c9.zip"),
      "bulk_download_a14395c9.zip",
    );
  });

  it("slugs sort, quality, and status tab into the ZIP prefix", () => {
    assert.equal(slugifyBulkZipSort("views_desc"), "views_high_to_low");
    assert.equal(slugifyBulkZipSort("views-asc"), "views_low_to_high");
    assert.equal(slugifyBulkZipStatusTab("not_rejected"), "nonrejected");
    assert.equal(slugifyBulkZipStatusTab("verified"), "verified");
    assert.equal(formatBulkZipQualityPart([]), "all_quality");
    assert.equal(
      formatBulkZipQualityPart([1, 2, 3, 4, 5]),
      "Q1_Q2_Q3_Q4_Q5",
    );
    assert.equal(formatBulkZipQualityPart([3, 1]), "Q1_Q3");
    assert.equal(formatBulkZipQualityPart([2, "unscored"]), "Q2_unscored");
    assert.equal(
      buildBulkZipFilenamePrefix({
        contestTitle: "Summer Launch",
        sort: "views_desc",
        qualityScores: [1, 2, 3, 4, 5],
        statusTab: "verified",
      }),
      "bulk_submissions_Summer_Launch_views_high_to_low_Q1_Q2_Q3_Q4_Q5_verified",
    );
  });

  it("parses sort, quality, and status back from a ZIP prefix", () => {
    const parsed = parseBulkZipFilenamePrefix(
      "bulk_submissions_Ranveer_BTS_Vlogs_views_high_to_low_all_quality_verified",
    );
    assert.equal(parsed.sortLabel, "Views (high to low)");
    assert.equal(parsed.qualityLabel, "All quality");
    assert.equal(parsed.statusLabel, "Verified");
    const quality = parseBulkZipFilenamePrefix(
      "bulk_submissions_Summer_Launch_views_high_to_low_Q1_Q2_Q3_Q4_Q5_verified",
    );
    assert.equal(quality.qualityLabel, "Q1, Q2, Q3, Q4, Q5");
    assert.equal(quality.sortLabel, "Views (high to low)");
  });
});
