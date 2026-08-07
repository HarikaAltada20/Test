import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bulkPaymentRollbackRevertFlags,
  splitFreshBulkCreditCents,
} from "./bulk-payment-rollback";

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
