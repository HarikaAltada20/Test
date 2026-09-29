import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildLedgerScopedReversalDebitIdempotencyKey,
  buildWalletRollbackDebitIdempotencyKey,
  bulkPaymentRollbackRevertFlags,
  sortUniqueTransactionIds,
  splitFreshBulkCreditCents,
} from "./bulk-payment-rollback";

describe("buildWalletRollbackDebitIdempotencyKey", () => {
  it("is stable for the same payout key + reason", () => {
    assert.equal(
      buildWalletRollbackDebitIdempotencyKey({
        payoutOperationKey: "bulk_pay_v2:abc",
        reason: "submission_row_update_failed",
      }),
      buildWalletRollbackDebitIdempotencyKey({
        payoutOperationKey: "bulk_pay_v2:abc",
        reason: "submission_row_update_failed",
      }),
    );
  });

  it("changes when reason changes so different rollback stages stay distinct", () => {
    const a = buildWalletRollbackDebitIdempotencyKey({
      payoutOperationKey: "twitter_creator_pay:v1:c1:u1:cycle:1",
      reason: "tweet_fetch_failed",
    });
    const b = buildWalletRollbackDebitIdempotencyKey({
      payoutOperationKey: "twitter_creator_pay:v1:c1:u1:cycle:1",
      reason: "tweet_update_failed",
    });
    assert.notEqual(a, b);
    assert.match(a, /^wallet_rollback:v1:/);
  });
});

describe("buildLedgerScopedReversalDebitIdempotencyKey", () => {
  const base = {
    prefix: "verify_reversal:v1",
    reason: "paid_status_reversal",
    scope: {
      submissionId: "sub-1",
      creatorId: "creator-1",
      contestId: "contest-1",
      action: "pending",
    },
    debitCents: 1000,
  };

  it("is stable for the same ledger fingerprint (retry-safe)", () => {
    const a = buildLedgerScopedReversalDebitIdempotencyKey({
      ...base,
      rewardTransactionIds: ["r2", "r1"],
      refundTransactionIds: ["f1"],
    });
    const b = buildLedgerScopedReversalDebitIdempotencyKey({
      ...base,
      // Different order / duplicate ids must not change the key.
      rewardTransactionIds: ["r1", "r1", "r2"],
      refundTransactionIds: ["f1"],
    });
    assert.equal(a, b);
    assert.match(a, /^wallet_rollback:v1:verify_reversal:v1:/);
  });

  it("changes after a new pay→reverse cycle adds reward or refund rows", () => {
    const firstCycle = buildLedgerScopedReversalDebitIdempotencyKey({
      ...base,
      rewardTransactionIds: ["reward-1"],
      refundTransactionIds: [],
    });
    const secondCycle = buildLedgerScopedReversalDebitIdempotencyKey({
      ...base,
      rewardTransactionIds: ["reward-1", "reward-2"],
      refundTransactionIds: ["refund-1"],
    });
    assert.notEqual(firstCycle, secondCycle);
  });

  it("sortUniqueTransactionIds drops blanks and sorts", () => {
    assert.deepEqual(
      sortUniqueTransactionIds([
        { id: "b" },
        { id: "" },
        { id: "a" },
        { id: "b" },
        { id: null },
      ]),
      ["a", "b"],
    );
  });
});

describe("splitFreshBulkCreditCents", () => {
  it("attributes bonus-only credits to bonus", () => {
    assert.deepEqual(
      splitFreshBulkCreditCents({
        paymentType: "bonus",
        payableTotalAmount: 500,
        payableTotalMainPaid: 0,
        totalBonusPaid: 500,
        alreadyApplied: false,
      }),
      { freshPrizeCreditedCents: 0, freshBonusCreditedCents: 500 },
    );
  });

  it("attributes standard credits to prize", () => {
    assert.deepEqual(
      splitFreshBulkCreditCents({
        paymentType: "standard",
        payableTotalAmount: 1200,
        payableTotalMainPaid: 1200,
        totalBonusPaid: 0,
        alreadyApplied: false,
      }),
      { freshPrizeCreditedCents: 1200, freshBonusCreditedCents: 0 },
    );
  });

  it("splits both into prize + bonus components", () => {
    assert.deepEqual(
      splitFreshBulkCreditCents({
        paymentType: "both",
        payableTotalAmount: 1500,
        payableTotalMainPaid: 1000,
        totalBonusPaid: 500,
        alreadyApplied: false,
      }),
      { freshPrizeCreditedCents: 1000, freshBonusCreditedCents: 500 },
    );
  });

  it("returns zeros when credit was already applied", () => {
    assert.deepEqual(
      splitFreshBulkCreditCents({
        paymentType: "both",
        payableTotalAmount: 1500,
        payableTotalMainPaid: 1000,
        totalBonusPaid: 500,
        alreadyApplied: true,
      }),
      { freshPrizeCreditedCents: 0, freshBonusCreditedCents: 0 },
    );
  });
});

describe("bulkPaymentRollbackRevertFlags", () => {
  it("reverts bonus_paid for bonus-only rollback", () => {
    assert.deepEqual(
      bulkPaymentRollbackRevertFlags({
        paymentType: "bonus",
        prizeRollbackCents: 0,
        bonusRollbackCents: 500,
        rollbackCents: 500,
        hadBonusPaidUpdate: true,
      }),
      { revertPrize: false, revertBonus: true },
    );
  });

  it("reverts paid + bonus_paid for both", () => {
    assert.deepEqual(
      bulkPaymentRollbackRevertFlags({
        paymentType: "both",
        prizeRollbackCents: 1000,
        bonusRollbackCents: 500,
        rollbackCents: 1500,
        hadBonusPaidUpdate: true,
      }),
      { revertPrize: true, revertBonus: true },
    );
  });

  it("reverts only prize for standard", () => {
    assert.deepEqual(
      bulkPaymentRollbackRevertFlags({
        paymentType: "standard",
        prizeRollbackCents: 800,
        bonusRollbackCents: 0,
        rollbackCents: 800,
        hadBonusPaidUpdate: false,
      }),
      { revertPrize: true, revertBonus: false },
    );
  });
});
