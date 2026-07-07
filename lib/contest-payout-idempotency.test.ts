import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildContestPayoutIdempotencyPayload,
  creditWithWalletShortfallRetry,
  getContestPayoutLedgerState,
} from "./contest-payout-idempotency";
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

describe("buildContestPayoutIdempotencyPayload pay-refund cycles", () => {
  const base = {
    contest_id: "c1",
    creator_id: "u1",
    payment_type: "both",
    requested_submission_ids: ["sub-1"],
  };

  function keyForLedger(rewardCount: number, refundCount: number) {
    const seed = JSON.stringify(
      buildContestPayoutIdempotencyPayload(base, {
        generation: rewardCount + refundCount,
        fingerprint: `fp-${rewardCount}-${refundCount}`,
        rewardCount,
        refundCount,
      }),
    );
    return createHash("sha256").update(seed).digest("hex").slice(0, 16);
  }

  it("produces a unique idempotency seed for each completed pay→refund cycle", () => {
    const keys = new Set<string>();
    for (let cycle = 0; cycle < 6; cycle += 1) {
      keys.add(keyForLedger(cycle, cycle));
    }
    assert.equal(keys.size, 6);
  });
});

describe("creditWithWalletShortfallRetry", () => {
  it("retries with a new key when wallet still owes after alreadyApplied", async () => {
    const usedKeys: string[] = [];
    const ledger = {
      generation: 2,
      fingerprint: "fp-1-1",
      rewardCount: 1,
      refundCount: 1,
    };

    const result = await creditWithWalletShortfallRetry({
      payableCents: 8597,
      walletNetBeforePay: 0,
      baseIdempotencyKey: "bulk_pay_dual_v1:abc",
      ledger,
      credit: async (key) => {
        usedKeys.push(key);
        if (usedKeys.length === 1) {
          return { success: true, alreadyApplied: true };
        }
        return { success: true, alreadyApplied: false, transactionId: "tx-new" };
      },
    });

    assert.equal(result.success, true);
    assert.equal(result.alreadyApplied, false);
    assert.equal(usedKeys.length, 2);
    assert.match(usedKeys[1], /ledger_r1_f1/);
  });

  it("does not retry after a fresh credit satisfies the payable amount", async () => {
    const usedKeys: string[] = [];
    const result = await creditWithWalletShortfallRetry({
      payableCents: 5000,
      walletNetBeforePay: 0,
      baseIdempotencyKey: "bulk_pay_v1:abc",
      ledger: {
        generation: 1,
        fingerprint: "fp",
        rewardCount: 1,
        refundCount: 0,
      },
      credit: async (key) => {
        usedKeys.push(key);
        return { success: true, alreadyApplied: false, transactionId: "tx-1" };
      },
    });

    assert.equal(result.success, true);
    assert.equal(usedKeys.length, 1);
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
          contains(column: string, value: Record<string, unknown>) {
            this.containsFilters = [
              ...(this.containsFilters || []),
              { column, value },
            ];
            return api;
          },
          or(filter: string) {
            this.orFilters = [...(this.orFilters || []), filter];
            return api;
          },
          order() {
            return api;
          },
          range() {
            return api;
          },
          limit() {
            return api;
          },
          in(column: string, values: string[]) {
            this.inFilters = [...(this.inFilters || []), { column, values }];
            return api;
          },
          filters: [] as { column: string; value: string }[],
          containsFilters: [] as {
            column: string;
            value: Record<string, unknown>;
          }[],
          orFilters: [] as string[],
          inFilters: [] as { column: string; values: string[] }[],
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
