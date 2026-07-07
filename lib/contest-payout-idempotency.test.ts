import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getContestPayoutLedgerState } from "./contest-payout-idempotency";
import { filterMoneyTxnsForContest } from "./dual-rewards-pool-budget";

describe("filterMoneyTxnsForContest bulk dual-rewards rows", () => {
  const contestId = "contest-1";
  const contestSubmissionIds = new Set(["sub-1", "sub-2"]);

  it("includes bulk reward rows matched by contest_id", () => {
    const rows = filterMoneyTxnsForContest(
      [
        {
          id: "reward-bulk",
          amount: 8597,
          metadata: {
            contest_id: contestId,
            dual_rewards_reward: true,
            bulk_dual_rewards_payment: true,
            breakdown: [{ submission_id: "sub-1", cpm_cents: 8000, milestone_cents: 597 }],
          },
        },
      ],
      contestId,
      contestSubmissionIds,
    );
    assert.equal(rows.length, 1);
  });

  it("includes bulk refund rows matched by contest_id", () => {
    const rows = filterMoneyTxnsForContest(
      [
        {
          id: "refund-bulk",
          amount: 8597,
          remarks: "Forfeited due to status reversal",
          metadata: {
            contest_id: contestId,
            dual_rewards_reversal: true,
            bulk_dual_rewards_reversal: true,
            breakdown: [{ submission_id: "sub-1", cpm_cents: 8000, milestone_cents: 597 }],
          },
        },
      ],
      contestId,
      contestSubmissionIds,
    );
    assert.equal(rows.length, 1);
  });
});

describe("getContestPayoutLedgerState fingerprint", () => {
  it("changes when reward and refund rows exist", async () => {
    const rewardId = "11111111-1111-1111-1111-111111111111";
    const refundId = "22222222-2222-2222-2222-222222222222";
    const creatorId = "33333333-3333-3333-3333-333333333333";
    const contestId = "44444444-4444-4444-4444-444444444444";

    const supabase = {
      from(table: string) {
        const api = {
          select() {
            return api;
          },
          eq(column: string, value: string) {
            this.filters = [...(this.filters || []), { column, value }];
            return api;
          },
          filters: [] as { column: string; value: string }[],
          then(resolve: (value: { data: unknown[]; error: null }) => void) {
            if (table === "submissions") {
              resolve({ data: [{ id: "sub-1" }], error: null });
              return;
            }
            const typeFilter = this.filters.find((f) => f.column === "type");
            const userFilter = this.filters.find((f) => f.column === "user_id");
            assert.equal(userFilter?.value, creatorId);
            if (typeFilter?.value === "reward") {
              resolve({
                data: [
                  {
                    id: rewardId,
                    amount: 8597,
                    metadata: {
                      contest_id: contestId,
                      bulk_dual_rewards_payment: true,
                      breakdown: [
                        { submission_id: "sub-1", cpm_cents: 8597, milestone_cents: 0 },
                      ],
                    },
                  },
                ],
                error: null,
              });
              return;
            }
            resolve({
              data: [
                {
                  id: refundId,
                  amount: 8597,
                  remarks: "Forfeited due to status reversal",
                  metadata: {
                    contest_id: contestId,
                    bulk_dual_rewards_reversal: true,
                    breakdown: [
                      { submission_id: "sub-1", cpm_cents: 8597, milestone_cents: 0 },
                    ],
                  },
                },
              ],
              error: null,
            });
          },
        };
        return api;
      },
    };

    const { state, errorMessage } = await getContestPayoutLedgerState(
      supabase as any,
      creatorId,
      contestId,
    );
    assert.equal(errorMessage, null);
    assert.equal(state.generation, 2);
    assert.equal(state.rewardCount, 1);
    assert.equal(state.refundCount, 1);
    assert.notEqual(state.fingerprint, "empty");
  });
});
