import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeBudgetFilledCents,
  computeBudgetPaidCents,
  getBudgetTileMode,
  resolveBudgetTileMetrics,
} from "./contest-budget-tile-metrics";

describe("contest-budget-tile-metrics", () => {
  it("selects paid mode only for payouts_processed", () => {
    assert.equal(getBudgetTileMode("payouts_processed"), "paid");
    assert.equal(getBudgetTileMode("in_review"), "filled");
    assert.equal(getBudgetTileMode(null), "filled");
  });

  it("CPM filled uses views formula for unpaid verified submissions", () => {
    const contest = {
      contest_type: "cpm",
      post_contest_status: "pending_review",
      contest_based_details: {
        cpm_contest: {
          total_budget: 100_000,
          cpm_rate_usd: 10,
        },
      },
    };
    const submissions = [
      {
        id: "s1",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 10_000,
        platform: "youtube",
      },
    ];
    const filled = computeBudgetFilledCents(contest, submissions);
    assert.equal(filled, 10_000);
  });

  it("CPM filled uses stored earnings for paid submissions", () => {
    const contest = {
      contest_type: "cpm",
      post_contest_status: "in_review",
      contest_based_details: {
        cpm_contest: {
          total_budget: 100_000,
          cpm_rate_usd: 1000,
        },
      },
    };
    const submissions = [
      {
        id: "s1",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "paid",
        paid: true,
        earnings: 7500,
        bonus_paid: false,
        views: 10_000,
        platform: "youtube",
      },
    ];
    const filled = computeBudgetFilledCents(contest, submissions);
    assert.equal(filled, 7500);
  });

  it("CPM paid sums only paid earnings and bonuses", () => {
    const contest = {
      contest_type: "cpm",
      post_contest_status: "payouts_processed",
      contest_based_details: {
        cpm_contest: { total_budget: 100_000, cpm_rate_usd: 1000 },
      },
    };
    const submissions = [
      {
        id: "s1",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "paid",
        paid: true,
        earnings: 5000,
        bonus_paid: true,
        bonus_amount: 500,
        views: 10_000,
        platform: "youtube",
      },
      {
        id: "s2",
        creator_id: "c2",
        created_at: "2026-06-02T00:00:00.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 20_000,
        platform: "youtube",
      },
    ];
    assert.equal(computeBudgetPaidCents(contest, submissions), 5500);
  });

  it("milestone filled is non-zero when verified submissions qualify", () => {
    const contest = {
      contest_type: "milestone",
      post_contest_status: null,
      contest_based_details: {
        milestone_contest: {
          total_budget_cents: 500_000,
          milestones: [
            { target_views: 1000, payout_cents: 25_000, winner_limit: null },
          ],
        },
      },
    };
    const submissions = [
      {
        id: "s1",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 5000,
        platform: "youtube",
      },
    ];
    const filled = computeBudgetFilledCents(contest, submissions);
    assert.equal(filled, 25_000);
  });

  it("resolveBudgetTileMetrics returns ratio fields and label", () => {
    const contest = {
      contest_type: "milestone",
      post_contest_status: "payouts_processed",
      contest_based_details: {
        milestone_contest: {
          total_budget_cents: 100_000,
          milestones: [
            { target_views: 100, payout_cents: 10_000, winner_limit: null },
          ],
        },
      },
    };
    const submissions = [
      {
        id: "s1",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "paid",
        paid: true,
        earnings: 8000,
        bonus_paid: false,
        views: 500,
        platform: "youtube",
      },
    ];
    const tile = resolveBudgetTileMetrics(contest, submissions);
    assert.ok(tile);
    assert.equal(tile!.mode, "paid");
    assert.equal(tile!.denominatorCents, 100_000);
    assert.equal(tile!.numeratorCents, 8000);
    assert.equal(tile!.label, "Budget paid / Campaign budget");
  });
});
