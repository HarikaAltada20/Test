import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReportExportBundle } from "@/lib/report-export-context";
import type { ContestAnalyticsExportSubmission } from "@/lib/contest-analytics-export";

function sub(
  partial: Partial<ContestAnalyticsExportSubmission> & { id: string },
): ContestAnalyticsExportSubmission {
  return {
    views: 0,
    ...partial,
  } as ContestAnalyticsExportSubmission;
}

const contest = {
  contestTitle: "Test Campaign",
  contestType: "leaderboard",
  durationDays: 7,
};

describe("buildReportExportBundle", () => {
  const submissions = [
    sub({ id: "1", views: 1000, status: "verified" }),
    sub({ id: "2", views: 2000, status: "paid", paid: true }),
    sub({ id: "3", views: 500, status: "pending" }),
    sub({ id: "4", views: 100, status: "rejected" }),
  ];

  const getStatus = (submission: ContestAnalyticsExportSubmission) =>
    String(submission.status || "pending");

  it("scopes metrics to pending submissions when submissionFilter is pending", () => {
    const bundle = buildReportExportBundle({
      contest,
      reportType: "submissions",
      submissions,
      getStatus,
      getSubmissionExpectedCents: () => 100,
      submissionFilter: "pending",
      exportedAt: new Date("2026-06-01T12:00:00Z"),
    });

    assert.equal(bundle.filteredSubmissions.length, 1);
    assert.equal(bundle.metrics.totalSubmissions, 1);
    assert.equal(bundle.metrics.totalViews, 500);
    assert.equal(bundle.branding.dataScopeLabel, "Pending Submissions Data");
  });

  it("uses different scope labels and counts for all vs verified_or_paid", () => {
    const allBundle = buildReportExportBundle({
      contest,
      reportType: "full",
      submissions,
      getStatus,
      getSubmissionExpectedCents: () => 100,
      submissionFilter: "all",
      exportedAt: new Date("2026-06-01T12:00:00Z"),
    });
    const verifiedPaidBundle = buildReportExportBundle({
      contest,
      reportType: "full",
      submissions,
      getStatus,
      getSubmissionExpectedCents: () => 100,
      submissionFilter: "verified_or_paid",
      exportedAt: new Date("2026-06-01T12:00:00Z"),
    });

    assert.equal(allBundle.metrics.totalSubmissions, 4);
    assert.equal(allBundle.metrics.totalViews, 3600);
    assert.equal(allBundle.branding.dataScopeLabel, "All Submissions Data");

    assert.equal(verifiedPaidBundle.metrics.totalSubmissions, 2);
    assert.equal(verifiedPaidBundle.metrics.totalViews, 3000);
    assert.equal(
      verifiedPaidBundle.branding.dataScopeLabel,
      "Verified + Paid Submissions Data",
    );
  });
});
