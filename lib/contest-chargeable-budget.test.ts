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
