import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getContestBudgetRemainingForSort,
  getContestBudgetSpentForSort,
} from "./contest-budget-remaining-sort";

describe("contest-budget-remaining-sort dual rewards", () => {
  const dualContest = {
    contest_type: "dual_rewards",
    contest_based_details: {
      total_budget_cents: 18_000,
      pool_budget_spent_cents: 17_999,
      cpm_contest: { budget_spent: 18_000 },
      milestone_contest: { budget_spent: 18_000 },
    },
  };

  it("getContestBudgetSpentForSort uses unified pool spend not nested sum", () => {
    assert.equal(getContestBudgetSpentForSort(dualContest), 17_999);
  });

  it("getContestBudgetRemainingForSort uses unified pool spend", () => {
    assert.equal(getContestBudgetRemainingForSort(dualContest), 1);
  });
});
