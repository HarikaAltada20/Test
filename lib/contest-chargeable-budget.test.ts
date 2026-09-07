import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getChargeableBudgetCents } from "./contest-chargeable-budget";

describe("getChargeableBudgetCents", () => {
  it("leaderboard uses total_prize only without flat fee bonus", () => {
    const cents = getChargeableBudgetCents({
      id: "c1",
      contest_type: "leaderboard",
      contest_based_details: {
        leaderboard_contest: { total_prize: 10_000 },
      },
    });
    assert.equal(cents, 10_000);
  });

  it("leaderboard adds bonus budget when flat fee bonus is enabled", () => {
    const cents = getChargeableBudgetCents({
      id: "c1",
      contest_type: "leaderboard",
      contest_based_details: {
        leaderboard_contest: {
          total_prize: 10_000,
          flat_fee_bonus: 500,
          total_budget: 10_000,
        },
      },
    });
    assert.equal(cents, 20_000);
  });

  it("leaderboard falls back to sum of prizes", () => {
    const cents = getChargeableBudgetCents({
      id: "c1",
      contest_type: "leaderboard",
      contest_based_details: {
        leaderboard_contest: {
          prizes: [{ amount: 5_000 }, { amount: 3_000 }],
        },
      },
    });
    assert.equal(cents, 8_000);
  });

  it("cpm uses pool budget from details", () => {
    const cents = getChargeableBudgetCents({
      id: "c1",
      contest_type: "cpm",
      contest_based_details: {
        cpm_contest: { total_budget: 25_000 },
      },
    });
    assert.equal(cents, 25_000);
  });

  it("sums per-platform campaigns when multiple platforms are configured", () => {
    const cents = getChargeableBudgetCents({
      id: "c1",
      contest_type: "leaderboard",
      contest_based_details: {
        leaderboard_contest: { total_prize: 10_000 },
        youtube: {
          contest_type: "leaderboard",
          leaderboard_contest: { total_prize: 10_000 },
        },
        instagram: {
          contest_type: "leaderboard",
          leaderboard_contest: { total_prize: 4_000 },
        },
      },
    });
    assert.equal(cents, 14_000);
  });

  it("sums per-platform leaderboard bonus budgets when configured", () => {
    const cents = getChargeableBudgetCents({
      id: "c1",
      contest_type: "leaderboard",
      contest_based_details: {
        youtube: {
          contest_type: "leaderboard",
          leaderboard_contest: {
            total_prize: 10_000,
            flat_fee_bonus: 200,
            total_budget: 4_000,
          },
        },
        instagram: {
          contest_type: "leaderboard",
          leaderboard_contest: {
            total_prize: 4_000,
            flat_fee_bonus: 500,
            total_budget: 2_500,
          },
        },
      },
    });
    assert.equal(cents, 20_500);
  });

  it("uses shared campaign budget once for multi-platform CPM", () => {
    const cents = getChargeableBudgetCents({
      id: "c1",
      contest_type: "cpm",
      contest_based_details: {
        cpm_contest: { total_budget: 4_000 },
        youtube: {
          contest_type: "cpm",
          cpm_contest: { total_budget: 4_000 },
        },
        instagram: {
          contest_type: "cpm",
          cpm_contest: { total_budget: 4_000 },
        },
      },
    });
    assert.equal(cents, 4_000);
  });

  it("dual_rewards uses root total_budget_cents", () => {
    const cents = getChargeableBudgetCents({
      id: "c1",
      contest_type: "dual_rewards",
      contest_based_details: {
        total_budget_cents: 40_000,
      },
    });
    assert.equal(cents, 40_000);
  });
});
