import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sortSubmissionsForExport,
  getReportExportSortDividerLine,
} from "@/lib/report-export-sort";

describe("report-export-sort", () => {
  it("sorts submissions by views descending by default", () => {
    const submissions = [
      { id: "a", views: 100 },
      { id: "b", views: 5000 },
      { id: "c", views: 250 },
    ] as Record<string, unknown>[];

    const sorted = sortSubmissionsForExport(submissions, "views_desc");
    assert.deepEqual(
      sorted.map((row) => row.id),
      ["b", "c", "a"],
    );
  });

  it("builds divider copy from sort option", () => {
    assert.equal(
      getReportExportSortDividerLine("views_desc"),
      "Sorted by Views · High → Low",
    );
  });
});
