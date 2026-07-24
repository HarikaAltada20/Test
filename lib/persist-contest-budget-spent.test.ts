import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergePersistedBudgetSpentFields } from "./persist-contest-budget-spent";

describe("mergePersistedBudgetSpentFields", () => {
  it("writes spend for leaderboard, cpm, milestone, and dual pool", () => {
    const merged = mergePersistedBudgetSpentFields(
      {
        leaderboard_contest: { total_prize: 1000, flat_fee_bonus: 5 },
        cpm_contest: { cpm_rate_usd: 1, total_budget: 50_000 },
        milestone_contest: { total_budget_cents: 500, milestones: [] },
        other: "keep",
      },
      {
        leaderboard_contest: { budget_spent: 100 },
        cpm_contest: { budget_spent: 200 },
        milestone_contest: { budget_spent: 515 },
        pool_budget_spent_cents: 700,
      },
    );

    assert.equal(merged.other, "keep");
    assert.equal(
      (merged.leaderboard_contest as { budget_spent: number }).budget_spent,
      100,
    );
    assert.equal(
      (merged.leaderboard_contest as { total_prize: number }).total_prize,
      1000,
    );
    assert.equal(
      (merged.cpm_contest as { budget_spent: number }).budget_spent,
      200,
    );
    assert.equal(
      (merged.cpm_contest as { cpm_rate_usd: number }).cpm_rate_usd,
      1,
    );
    assert.equal(
      (merged.milestone_contest as { budget_spent: number }).budget_spent,
      515,
    );
    assert.equal(
      (merged.milestone_contest as { total_budget_cents: number })
        .total_budget_cents,
      500,
    );
    assert.equal(merged.pool_budget_spent_cents, 700);
  });

  it("allows zero spend and does not drop base nests when enriched omit spend", () => {
    const merged = mergePersistedBudgetSpentFields(
      {
        milestone_contest: { total_budget_cents: 500, budget_spent: 99 },
      },
      {
        milestone_contest: { budget_spent: 0 },
        cpm_contest: { title: "ignored without spend" },
      },
    );

    assert.equal(
      (merged.milestone_contest as { budget_spent: number }).budget_spent,
      0,
    );
    assert.equal(merged.cpm_contest, undefined);
  });
});
