import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeBudgetFilledCents,
  computeBudgetPaidCents,
  computeDualRewardsCpmMilestoneFilledCents,
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

  it("ignores leftover nested dual spend when keyed platform payouts exist even without platform CSV", () => {
    const contest = {
      contest_type: "dual_rewards",
      post_contest_status: "in_review",
      contest_based_details: {
        total_budget_cents: 10_000,
        cpm_contest: { budget_spent: 708 },
        milestone_contest: { budget_spent: 7711 },
        youtube: {
          contest_type: "dual_rewards",
          cpm_contest: { cpm_rate_usd: 1, total_budget: 10_000 },
        },
        instagram: {
          contest_type: "dual_rewards",
          cpm_contest: { cpm_rate_usd: 1, total_budget: 10_000 },
        },
      },
    };
    assert.equal(getPoolBudgetSpentCentsForDisplay(contest), 0);
  });

  it("dual filled includes per-platform creator bonus expected", () => {
    const contest = {
      contest_type: "dual_rewards",
      post_contest_status: "in_review",
      platform: "youtube,tiktok",
      contest_based_details: {
        total_budget_cents: 100_000,
        youtube: {
          contest_type: "dual_rewards",
          cpm_contest: { cpm_rate_usd: 1, total_budget: 100_000 },
          milestone_contest: {
            milestones: [
              { order: 1, target_views: 1000, payout_cents: 1000, winner_limit: null },
            ],
            bonus: {
              enabled: true,
              most_verified_reels: {
                payout_cents: 200,
                min_verified_reels: 1,
              },
            },
          },
        },
        tiktok: {
          contest_type: "dual_rewards",
          cpm_contest: { cpm_rate_usd: 1, total_budget: 100_000 },
          milestone_contest: {
            milestones: [
              { order: 1, target_views: 1000, payout_cents: 1000, winner_limit: null },
            ],
            bonus: {
              enabled: true,
              most_verified_reels: {
                payout_cents: 200,
                min_verified_reels: 1,
              },
            },
          },
        },
      },
    };
    const submissions = [
      {
        id: "yt",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 1_000,
        platform: "youtube",
      },
      {
        id: "tt",
        creator_id: "c2",
        created_at: "2026-06-01T00:00:01.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 1_000,
        platform: "tiktok",
      },
    ];
    const filled = computeBudgetFilledCents(contest, submissions);
    // CPM $1/1k * 1000 views * 2 = 200 cents, ladder 1000*2 = 2000, bonus 200*2 = 400
    assert.equal(filled, 2_600);
  });

  it("dual CPM+milestone filled applies combined per-platform max earnings cap", () => {
    const contest = {
      contest_type: "dual_rewards",
      post_contest_status: "in_review",
      platform: "youtube,instagram",
      max_earnings_per_creator: {
        youtube: { max_earnings_per_creator: 200 },
        instagram: { max_earnings_per_creator: 250 },
      },
      contest_based_details: {
        total_budget_cents: 10_000,
        youtube: {
          contest_type: "dual_rewards",
          cpm_contest: { cpm_rate_usd: 10, total_budget: 10_000 },
          milestone_contest: {
            milestones: [
              {
                order: 1,
                target_views: 100,
                payout_cents: 8_000,
                winner_limit: null,
              },
            ],
          },
        },
        instagram: {
          contest_type: "dual_rewards",
          cpm_contest: { cpm_rate_usd: 10, total_budget: 10_000 },
          milestone_contest: {
            milestones: [
              {
                order: 1,
                target_views: 100,
                payout_cents: 8_000,
                winner_limit: null,
              },
            ],
          },
        },
      },
    };
    const submissions = [
      {
        id: "yt",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 100_000,
        platform: "youtube",
      },
      {
        id: "ig",
        creator_id: "c2",
        created_at: "2026-06-01T00:00:01.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 100_000,
        platform: "instagram",
      },
    ];
    assert.equal(
      computeDualRewardsCpmMilestoneFilledCents(contest, submissions),
      450,
    );
    assert.equal(computeBudgetFilledCents(contest, submissions), 450);
  });

  it("ignores leftover nested dual spend on multi-platform contests without pool_budget_spent_cents", () => {
    const contest = {
      contest_type: "dual_rewards",
      post_contest_status: "in_review",
      platform: "instagram,youtube,tiktok",
      contest_based_details: {
        total_budget_cents: 10_000,
        cpm_contest: { budget_spent: 708 },
        milestone_contest: { budget_spent: 7711 },
        youtube: {
          contest_type: "dual_rewards",
          cpm_contest: { cpm_rate_usd: 1, total_budget: 10_000 },
        },
      },
    };
    assert.equal(getPoolBudgetSpentCentsForDisplay(contest), 0);
  });

  it("uses pool_budget_spent_cents for multi-platform dual list cards", () => {
    const contest = {
      contest_type: "dual_rewards",
      post_contest_status: "in_review",
      platform: "instagram,youtube,tiktok",
      contest_based_details: {
        total_budget_cents: 10_000,
        pool_budget_spent_cents: 1_984,
        cpm_contest: { budget_spent: 708 },
        milestone_contest: { budget_spent: 7711 },
      },
    };
    assert.equal(getPoolBudgetSpentCentsForDisplay(contest), 1_984);
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

  it("CPM filled uses per-platform rates on multi-platform contests", () => {
    const contest = {
      contest_type: "cpm",
      post_contest_status: "pending_review",
      platform: "youtube,instagram",
      contest_based_details: {
        youtube: {
          contest_type: "cpm",
          cpm_contest: { cpm_rate_usd: 1, total_budget: 10_000 },
        },
        instagram: {
          contest_type: "cpm",
          cpm_contest: { cpm_rate_usd: 2, total_budget: 10_000 },
        },
      },
    };
    const submissions = [
      {
        id: "yt",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 10_000,
        platform: "youtube",
      },
      {
        id: "ig",
        creator_id: "c2",
        created_at: "2026-06-01T00:00:01.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 10_000,
        platform: "instagram",
      },
    ];
    // $1 CPM on 10k YT views = $10; $2 CPM on 10k IG views = $20
    assert.equal(computeBudgetFilledCents(contest, submissions), 3_000);
  });

  it("CPM filled uses TikTok other_stats view_count", () => {
    const contest = {
      contest_type: "cpm",
      post_contest_status: "pending_review",
      contest_based_details: {
        cpm_contest: { total_budget: 100_000, cpm_rate_usd: 1 },
      },
    };
    const submissions = [
      {
        id: "tt",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 0,
        platform: "tiktok",
        other_stats: { tiktok: { view_count: 20_000 } },
      },
    ];
    assert.equal(computeBudgetFilledCents(contest, submissions), 2_000);
  });

  it("milestone filled uses per-platform ladders on multi-platform contests", () => {
    const contest = {
      contest_type: "milestone",
      post_contest_status: "pending_review",
      platform: "youtube,tiktok",
      contest_based_details: {
        youtube: {
          contest_type: "milestone",
          milestone_contest: {
            milestones: [
              { target_views: 1000, payout_cents: 1_000, winner_limit: null },
            ],
          },
        },
        tiktok: {
          contest_type: "milestone",
          milestone_contest: {
            milestones: [
              { target_views: 1000, payout_cents: 5_000, winner_limit: null },
            ],
          },
        },
      },
    };
    const submissions = [
      {
        id: "yt",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 2_000,
        platform: "youtube",
      },
      {
        id: "tt",
        creator_id: "c2",
        created_at: "2026-06-01T00:00:01.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 2_000,
        platform: "tiktok",
      },
    ];
    assert.equal(computeBudgetFilledCents(contest, submissions), 6_000);
  });

  it("leaderboard filled uses All-tab ranking when platform prizes match", () => {
    const youtube = {
      contest_type: "leaderboard",
      leaderboard_contest: {
        prizes: [
          { position: 1, amount: 10000 },
          { position: 2, amount: 5000 },
        ],
        total_prize: 15000,
        winner_count: 2,
      },
    };
    const contest = {
      contest_type: "leaderboard",
      post_contest_status: "in_review",
      platform: "youtube,instagram",
      contest_based_details: {
        youtube,
        instagram: youtube,
      },
    };
    const submissions = [
      {
        id: "yt-1",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 500,
        platform: "youtube",
      },
      {
        id: "ig-1",
        creator_id: "c2",
        created_at: "2026-06-01T00:00:01.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 400,
        platform: "instagram",
      },
    ];
    assert.equal(computeBudgetFilledCents(contest, submissions), 15000);
  });

  it("leaderboard filled uses per-platform prizes when ladders differ", () => {
    const contest = {
      contest_type: "leaderboard",
      post_contest_status: "in_review",
      platform: "youtube,instagram",
      contest_based_details: {
        youtube: {
          contest_type: "leaderboard",
          leaderboard_contest: {
            prizes: [{ position: 1, amount: 20000 }],
            total_prize: 20000,
            winner_count: 1,
          },
        },
        instagram: {
          contest_type: "leaderboard",
          leaderboard_contest: {
            prizes: [{ position: 1, amount: 7000 }],
            total_prize: 7000,
            winner_count: 1,
          },
        },
      },
    };
    const submissions = [
      {
        id: "yt-1",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 500,
        platform: "youtube",
      },
      {
        id: "ig-1",
        creator_id: "c2",
        created_at: "2026-06-01T00:00:01.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 400,
        platform: "instagram",
      },
    ];
    assert.equal(computeBudgetFilledCents(contest, submissions), 27000);
  });

  it("leaderboard filled uses per-platform flat fee bonus when amounts differ", () => {
    const contest = {
      contest_type: "leaderboard",
      post_contest_status: "in_review",
      platform: "youtube,instagram",
      contest_based_details: {
        youtube: {
          contest_type: "leaderboard",
          leaderboard_contest: {
            prizes: [{ position: 1, amount: 10000 }],
            total_prize: 10000,
            winner_count: 1,
            flat_fee_bonus: 200,
            total_budget: 1000,
          },
        },
        instagram: {
          contest_type: "leaderboard",
          leaderboard_contest: {
            prizes: [{ position: 1, amount: 10000 }],
            total_prize: 10000,
            winner_count: 1,
            flat_fee_bonus: 500,
            total_budget: 1500,
          },
        },
      },
    };
    const submissions = [
      {
        id: "yt-1",
        creator_id: "c1",
        created_at: "2026-06-01T00:00:00.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 500,
        platform: "youtube",
      },
      {
        id: "ig-1",
        creator_id: "c2",
        created_at: "2026-06-01T00:00:01.000Z",
        status: "verified",
        paid: false,
        earnings: null,
        bonus_paid: false,
        views: 400,
        platform: "instagram",
      },
    ];
    // Same prize ladders → All-tab rank: 1st 10000, 2nd 0. Bonuses 200 + 500.
    assert.equal(computeBudgetFilledCents(contest, submissions), 10700);
  });
});
