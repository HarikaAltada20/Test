import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessBulkVideoDownloadJob,
  countDownloadJobsByStatusTab,
  countDownloadRowsByStatusTab,
  defaultBulkDownloadSummaryTab,
  groupBulkDownloadJobsByUserType,
  jobMatchesListStatusTab,
  jobRowToDownloadSummary,
  rowMatchesDownloadStatusTab,
  sortDownloadSummaryRows,
} from "./bulk-video-download-summary";

describe("groupBulkDownloadJobsByUserType", () => {
  it("splits admin and advertiser jobs newest first", () => {
    const grouped = groupBulkDownloadJobsByUserType([
      { id: "old-admin", userType: "admin" as const, createdAt: "2026-01-01" },
      {
        id: "new-adv",
        userType: "advertiser" as const,
        createdAt: "2026-05-01",
      },
      { id: "new-admin", userType: "admin" as const, createdAt: "2026-06-01" },
    ]);
    assert.deepEqual(
      grouped.admin.map((job) => job.id),
      ["new-admin", "old-admin"],
    );
    assert.deepEqual(
      grouped.advertiser.map((job) => job.id),
      ["new-adv"],
    );
  });
});

describe("defaultBulkDownloadSummaryTab", () => {
  it("prefers the live download type when that tab has jobs", () => {
    assert.equal(
      defaultBulkDownloadSummaryTab({
        viewerUserType: "admin",
        hasAdminJobs: true,
        hasAdvertiserJobs: true,
        preferLiveUserType: "advertiser",
      }),
      "advertiser",
    );
  });

  it("lets admins open the advertiser tab when they have no jobs of their own", () => {
    assert.equal(
      defaultBulkDownloadSummaryTab({
        viewerUserType: "admin",
        hasAdminJobs: false,
        hasAdvertiserJobs: true,
      }),
      "advertiser",
    );
  });

  it("keeps advertisers on their own tab", () => {
    assert.equal(
      defaultBulkDownloadSummaryTab({
        viewerUserType: "advertiser",
        hasAdminJobs: true,
        hasAdvertiserJobs: true,
      }),
      "advertiser",
    );
  });
});

describe("canAccessBulkVideoDownloadJob", () => {
  it("allows admins to view any contest download", () => {
    assert.equal(
      canAccessBulkVideoDownloadJob({
        viewerUserType: "admin",
        viewerUserId: "admin-1",
        jobUserId: "brand-9",
      }),
      true,
    );
  });

  it("allows advertisers to view only their own downloads", () => {
    assert.equal(
      canAccessBulkVideoDownloadJob({
        viewerUserType: "advertiser",
        viewerUserId: "brand-9",
        jobUserId: "brand-9",
      }),
      true,
    );
    assert.equal(
      canAccessBulkVideoDownloadJob({
        viewerUserType: "advertiser",
        viewerUserId: "brand-9",
        jobUserId: "admin-1",
      }),
      false,
    );
  });
});

describe("jobRowToDownloadSummary", () => {
  it("normalizes a stored job row", () => {
    const summary = jobRowToDownloadSummary({
      id: "job-1",
      contest_id: "contest-1",
      user_id: "user-1",
      user_type: "advertiser",
      status: "completed",
      total_count: 12,
      success_count: 10,
      failed_count: 2,
      zip_part_total: 2,
      naming_pattern: "views",
      file_name_prefix:
        "bulk_submissions_Summer_views_high_to_low_all_quality_verified",
      created_at: "2026-05-29T00:00:00.000Z",
      finished_at: "2026-05-29T01:00:00.000Z",
    });
    assert.equal(summary.userType, "advertiser");
    assert.equal(summary.totalCount, 12);
    assert.equal(summary.zipPartTotal, 2);
    assert.equal(
      summary.fileNamePrefix,
      "bulk_submissions_Summer_views_high_to_low_all_quality_verified",
    );
  });
});

describe("download summary status tabs", () => {
  const rows = [
    { submissionStatus: "verified" },
    { submissionStatus: "paid" },
    { submissionStatus: "pending" },
    { submissionStatus: "rejected" },
    { submissionStatus: "approved" },
  ];

  it("counts all / verified / pending / rejected / paid / not rejected / verified paid", () => {
    const counts = countDownloadRowsByStatusTab(rows);
    assert.equal(counts.all, 5);
    assert.equal(counts.verified, 2);
    assert.equal(counts.paid, 1);
    assert.equal(counts.pending, 1);
    assert.equal(counts.rejected, 1);
    assert.equal(counts.not_rejected, 4);
    assert.equal(counts.verified_paid, 3);
  });

  it("filters rows by the selected status tab", () => {
    assert.equal(rowMatchesDownloadStatusTab("verified", "verified"), true);
    assert.equal(rowMatchesDownloadStatusTab("paid", "verified"), false);
    assert.equal(rowMatchesDownloadStatusTab("rejected", "not_rejected"), false);
    assert.equal(rowMatchesDownloadStatusTab("paid", "not_rejected"), true);
    assert.equal(rowMatchesDownloadStatusTab("pending", "all"), true);
    assert.equal(rowMatchesDownloadStatusTab("verified", "verified_paid"), true);
    assert.equal(rowMatchesDownloadStatusTab("paid", "verified_paid"), true);
    assert.equal(rowMatchesDownloadStatusTab("pending", "verified_paid"), false);
  });

  it("filters download cards by the status used at download time", () => {
    const jobs = [
      { statusSlug: "verified" },
      { statusSlug: "nonrejected" },
      { statusSlug: "paid" },
      { statusSlug: "verified_paid" },
      { statusSlug: "all" },
    ];
    const counts = countDownloadJobsByStatusTab(jobs);
    assert.equal(counts.all, 5);
    assert.equal(counts.verified, 1);
    assert.equal(counts.paid, 1);
    assert.equal(counts.not_rejected, 1);
    assert.equal(counts.verified_paid, 1);
    assert.equal(jobMatchesListStatusTab("verified", "verified"), true);
    assert.equal(jobMatchesListStatusTab("verified", "paid"), false);
    assert.equal(jobMatchesListStatusTab("nonrejected", "not_rejected"), true);
    assert.equal(jobMatchesListStatusTab("verified_paid", "verified_paid"), true);
    assert.equal(jobMatchesListStatusTab("verified_paid", "verified"), false);
    assert.equal(jobMatchesListStatusTab("all", "all"), true);
    assert.equal(jobMatchesListStatusTab("all", "verified"), false);
  });
});

describe("sortDownloadSummaryRows", () => {
  const rows = [
    { id: "a", views: 10, qualityScore: 1, downloadedAt: "2026-01-01" },
    { id: "b", views: 50, qualityScore: 3, downloadedAt: "2026-03-01" },
    { id: "c", views: 20, qualityScore: null, downloadedAt: "2026-02-01" },
  ];

  it("sorts by quality score then views", () => {
    assert.deepEqual(
      sortDownloadSummaryRows(rows, "quality_desc").map((row) => row.id),
      ["b", "a", "c"],
    );
  });

  it("sorts by downloaded date then views", () => {
    assert.deepEqual(
      sortDownloadSummaryRows(rows, "downloaded_desc").map((row) => row.id),
      ["b", "c", "a"],
    );
  });
});
