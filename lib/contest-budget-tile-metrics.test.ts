import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeBudgetFilledCents,
  computeBudgetPaidCents,
  getBudgetTileMode,
  getPoolBudgetSpentCentsForDisplay,
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

  it("dual rewards paid uses dual_rewards_payout components only", () => {
    const contest = {
      contest_type: "dual_rewards",
      post_contest_status: "payouts_processed",
      contest_based_details: {
        total_budget_cents: 18_000,
        cpm_contest: { cpm_rate_usd: 1, budget_spent: 18_000 },
        milestone_contest: {
          budget_spent: 18_000,
          milestones: [
            { target_views: 1000, payout_cents: 500, winner_limit: null },
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
        earnings: 17_999,
        bonus_paid: true,
        bonus_amount: 500,
        views: 50_000,
        platform: "youtube",
        dual_rewards_payout: { cpm_cents: 16_499, milestone_cents: 1500 },
      },
    ];
    assert.equal(computeBudgetPaidCents(contest, submissions), 17_999);
  });

  it("getPoolBudgetSpentCentsForDisplay prefers pool_budget_spent_cents for dual", () => {
    const contest = {
      contest_type: "dual_rewards",
      post_contest_status: "payouts_processed",
      contest_based_details: {
        total_budget_cents: 18_000,
        pool_budget_spent_cents: 17_999,
        cpm_contest: { budget_spent: 18_000 },
        milestone_contest: { budget_spent: 18_000 },
      },
    };
    assert.equal(getPoolBudgetSpentCentsForDisplay(contest), 17_999);
  });

  it("getPoolBudgetSpentCentsForDisplay caps legacy nested dual sum at pool", () => {
    const contest = {
      contest_type: "dual_rewards",
      post_contest_status: "in_review",
      contest_based_details: {
        total_budget_cents: 18_000,
        cpm_contest: { budget_spent: 18_000, cpm_rate_usd: 1 },
        milestone_contest: { budget_spent: 17_998 },
      },
    };
    assert.equal(getPoolBudgetSpentCentsForDisplay(contest), 18_000);
  });

  it("resolveBudgetTileMetrics reports dual filled numerator above pool when overfilled", () => {
    const contest = {
      contest_type: "dual_rewards",
      post_contest_status: "verification_complete",
      max_earnings_per_creator: null,
      contest_based_details: {
        total_budget_cents: 10_000,
        cpm_contest: { cpm_rate_usd: 10 },
        milestone_contest: {
          milestones: [
            { target_views: 100, payout_cents: 8000, winner_limit: null },
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
        views: 100_000,
        platform: "youtube",
      },
    ];
    const tile = resolveBudgetTileMetrics(contest, submissions);
    assert.ok(tile);
    assert.equal(tile!.numeratorCents, 108_000);
    assert.equal(tile!.denominatorCents, 10_000);
  });
});
