import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { preserveExistingBudgetSpentFields } from "./contest-budget-spent-fields";

describe("preserveExistingBudgetSpentFields", () => {
  it("restores omitted milestone/leaderboard/cpm spend and dual pool spend", () => {
    const preserved = preserveExistingBudgetSpentFields(
      {
        milestone_contest: { total_budget_cents: 26_000, milestones: [] },
        leaderboard_contest: { total_prize: 100 },
        cpm_contest: { cpm_rate_usd: 1, total_budget: 50_000 },
        other: "keep",
      },
      {
        milestone_contest: {
          total_budget_cents: 26_000,
          budget_spent: 24_800,
        },
        leaderboard_contest: { budget_spent: 100 },
        cpm_contest: { budget_spent: 200 },
        pool_budget_spent_cents: 700,
      },
    );

    assert.equal(preserved.other, "keep");
    assert.equal(
      (preserved.milestone_contest as { budget_spent: number }).budget_spent,
      24_800,
    );
    assert.equal(
      (preserved.leaderboard_contest as { budget_spent: number }).budget_spent,
      100,
    );
    assert.equal(
      (preserved.cpm_contest as { budget_spent: number }).budget_spent,
      200,
    );
    assert.equal(preserved.pool_budget_spent_cents, 700);
  });

  it("does not overwrite explicit incoming spend (including zero)", () => {
    const preserved = preserveExistingBudgetSpentFields(
      {
        milestone_contest: { total_budget_cents: 500, budget_spent: 0 },
        pool_budget_spent_cents: 0,
      },
      {
        milestone_contest: { budget_spent: 99 },
        pool_budget_spent_cents: 700,
      },
    );

    assert.equal(
      (preserved.milestone_contest as { budget_spent: number }).budget_spent,
      0,
    );
    assert.equal(preserved.pool_budget_spent_cents, 0);
  });

  it("does not invent nests that were removed from the payload", () => {
    const preserved = preserveExistingBudgetSpentFields(
      { cpm_contest: { cpm_rate_usd: 1, budget_spent: 5 } },
      {
        milestone_contest: { budget_spent: 99 },
        cpm_contest: { budget_spent: 5 },
      },
    );

    assert.equal(preserved.milestone_contest, undefined);
    assert.equal(
      (preserved.cpm_contest as { budget_spent: number }).budget_spent,
      5,
    );
  });
});
