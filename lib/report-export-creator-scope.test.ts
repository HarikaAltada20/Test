import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scopeCreatorGroupsForReportExport } from "@/lib/report-export-creator-scope";

describe("scopeCreatorGroupsForReportExport", () => {
  it("rebuilds creator totals from scoped submissions only", () => {
    const creatorGroups = [
      {
        creator: { id: "c1", username: "creator1" },
        submissions: [{ id: "s1" }, { id: "s2" }, { id: "s3" }],
        totalCount: 3,
        statusCounts: { verified: 1, paid: 2, pending: 0, rejected: 0, all: 3 },
        metrics: { views: 9000, likes: 300 },
        earnings: { expected: 900, granted: 600 },
        bonus: { expected: 0, granted: 0 },
      },
    ];

    const scoped = scopeCreatorGroupsForReportExport(
      creatorGroups,
      [
        {
          id: "s1",
          creator_id: "c1",
          status: "verified",
          views: 1000,
          creator: { id: "c1", username: "creator1" },
        },
        {
          id: "s2",
          creator_id: "c1",
          status: "paid",
          paid: true,
          views: 2000,
          earnings: 600,
          creator: { id: "c1", username: "creator1" },
        },
      ],
      {
        getStatus: (submission) => String(submission.status || "pending"),
        getMetrics: (submission) => ({ views: submission.views }),
      },
    );

    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.totalCount, 2);
    assert.equal((scoped[0]?.metrics as { views?: number }).views, 3000);
    assert.equal(
      (scoped[0]?.statusCounts as { verified?: number }).verified,
      1,
    );
    assert.equal((scoped[0]?.statusCounts as { paid?: number }).paid, 1);
  });
});
