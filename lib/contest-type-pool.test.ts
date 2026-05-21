import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPoolBudgetCentsFromDetails } from "./contest-type";

describe("getPoolBudgetCentsFromDetails dual_rewards", () => {
  it("uses root total_budget_cents when set", () => {
    const cents = getPoolBudgetCentsFromDetails("dual_rewards", {
      total_budget_cents: 50_000,
      milestone_contest: { total_budget_cents: 30_000 },
      cpm_contest: { total_budget: 30_000 },
    });
    assert.equal(cents, 50_000);
  });

  it("does not sum nested budgets when both are set without root", () => {
    const cents = getPoolBudgetCentsFromDetails("dual_rewards", {
      milestone_contest: { total_budget_cents: 30_000 },
      cpm_contest: { total_budget: 25_000 },
    });
    assert.equal(cents, 30_000);
  });

  it("uses single nested budget when only one side is set", () => {
    assert.equal(
      getPoolBudgetCentsFromDetails("dual_rewards", {
        cpm_contest: { total_budget: 12_000 },
      }),
      12_000,
    );
  });
});
