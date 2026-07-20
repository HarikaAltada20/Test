import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BrandContestRow } from "@/lib/brand-analytics-cache";
import { resolveContestBudgetTile } from "@/lib/brand-analytics-contest-budget";

describe("resolveContestBudgetTile", () => {
  it("uses Twitter leaderboard earnings for paid mode", () => {
    const contest: BrandContestRow = {
      id: "tw-1",
      title: "Twitter Campaign",
      platform: "twitter",
      contest_type: "leaderboard",
      start_date: "2026-05-02T00:00:00.000Z",
      end_date: "2026-05-05T00:00:00.000Z",
      created_at: "2026-05-01T00:00:00.000Z",
      contest_based_details: {
        leaderboard_contest: {
          total_prize: 100000,
        },
      },
      post_contest_status: "payouts_processed",
    };

    const tile = resolveContestBudgetTile(contest, [], 9990);

    assert.ok(tile);
    assert.equal(tile!.mode, "paid");
    assert.equal(tile!.numeratorCents, 9990);
    assert.equal(tile!.denominatorCents, 100000);
    assert.equal(tile!.label, "Budget paid / Campaign budget");
  });
});
