import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sortCampaignsForList } from "./contest-list-sort";

describe("sortCampaignsForList (lazy-load correctness)", () => {
  it("orders by views across the full set, not only a page-sized subset", () => {
    const contests = [
      { id: "a", created_at: "2026-01-01", not_rejected_views: 10 },
      { id: "b", created_at: "2026-01-02", not_rejected_views: 5000 },
      { id: "c", created_at: "2026-01-03", not_rejected_views: 100 },
      { id: "d", created_at: "2026-01-04", not_rejected_views: 9000 },
      { id: "e", created_at: "2026-01-05", not_rejected_views: 50 },
    ];

    const sorted = sortCampaignsForList(contests, "views_desc");
    const page = sorted.slice(0, 2);

    assert.deepEqual(
      page.map((c) => c.id),
      ["d", "b"],
    );
    assert.equal(page[0].not_rejected_views, 9000);
    assert.equal(page[1].not_rejected_views, 5000);
  });

  it("keeps the highest-views campaign first even when it is not in the first loaded chunk by created_at", () => {
    const contests = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      created_at: `2026-01-${String(i + 1).padStart(2, "0")}`,
      not_rejected_views: i === 15 ? 1_000_000 : i,
    }));

    const sorted = sortCampaignsForList(contests, "views_desc");
    assert.equal(sorted[0].id, "c15");
    assert.equal(sorted.slice(0, 9)[0].id, "c15");
  });
});
