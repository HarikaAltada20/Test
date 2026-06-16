import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getContestBudgetPaymentMismatch,
  getSafeContestPaymentReturnPath,
  resolveExpectedContestPayment,
  ContestPaymentValidationError,
} from "./contest-payment-validation";
import type { PaymentDetails } from "./payment-utils";

describe("getSafeContestPaymentReturnPath", () => {
  it("allows create path", () => {
    assert.equal(
      getSafeContestPaymentReturnPath("/dashboard/contests/create"),
      "/dashboard/contests/create",
    );
  });

  it("allows edit path with uuid", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    assert.equal(
      getSafeContestPaymentReturnPath(`/dashboard/contests/${id}/edit`),
      `/dashboard/contests/${id}/edit`,
    );
  });

  it("rejects external urls", () => {
    assert.equal(
      getSafeContestPaymentReturnPath("https://evil.com/phish"),
      null,
    );
  });

  it("rejects path traversal", () => {
    assert.equal(
      getSafeContestPaymentReturnPath("/dashboard/contests/../admin"),
      null,
    );
  });

  it("rejects unrelated dashboard paths", () => {
    assert.equal(
      getSafeContestPaymentReturnPath("/dashboard/billing"),
      null,
    );
  });
});

function completedPaymentDetails(
  overrides: Partial<PaymentDetails> = {},
): PaymentDetails {
  return {
    first_payment_at: "2026-01-01T00:00:00.000Z",
    last_updated: "2026-01-01T00:00:00.000Z",
    payment_status: "completed",
    total_prize_pool: 25_000,
    commission_amount: 5_000,
    total_amount_paid: 30_000,
    commission_percentage: 20,
    payment_intent_ids: ["pi_test"],
    stripe_amounts_paid: [30_000],
    wallet_amounts_used: [0],
    amount_changes: [30_000],
    change_history: ["initial_payment"],
    ...overrides,
  };
}

describe("resolveExpectedContestPayment", () => {
  it("computes budget increase delta using stored commission", async () => {
    const result = await resolveExpectedContestPayment(
      {
        id: "c1",
        contest_type: "cpm",
        contest_based_details: {
          cpm_contest: { total_budget: 30_000 },
        },
        payment_details: completedPaymentDetails(),
      },
      "user-1",
      { isIncrease: true },
    );

    assert.equal(result.prizePoolInCents, 5_000);
    assert.equal(result.commissionPercentage, 20);
    assert.equal(result.totalAmountInCents, 6_000);
    assert.equal(result.changeType, "increase");
  });

  it("rejects budget decrease on payment endpoints", async () => {
    await assert.rejects(
      () =>
        resolveExpectedContestPayment(
          {
            id: "c1",
            contest_type: "cpm",
            contest_based_details: {
              cpm_contest: { total_budget: 20_000 },
            },
            payment_details: completedPaymentDetails(),
          },
          "user-1",
          { isDecrease: true },
        ),
      ContestPaymentValidationError,
    );
  });

  it("rejects increase when no delta exists", async () => {
    await assert.rejects(
      () =>
        resolveExpectedContestPayment(
          {
            id: "c1",
            contest_type: "cpm",
            contest_based_details: {
              cpm_contest: { total_budget: 25_000 },
            },
            payment_details: completedPaymentDetails(),
          },
          "user-1",
          { isIncrease: true },
        ),
      ContestPaymentValidationError,
    );
  });
});

describe("getContestBudgetPaymentMismatch", () => {
  it("returns null when chargeable budget matches payment", () => {
    const mismatch = getContestBudgetPaymentMismatch({
      id: "c1",
      contest_type: "cpm",
      contest_based_details: {
        cpm_contest: { total_budget: 25_000 },
      },
      payment_details: completedPaymentDetails(),
    });
    assert.equal(mismatch, null);
  });

  it("detects unpaid budget increase", () => {
    const mismatch = getContestBudgetPaymentMismatch({
      id: "c1",
      contest_type: "cpm",
      contest_based_details: {
        cpm_contest: { total_budget: 30_000 },
      },
      payment_details: completedPaymentDetails(),
    });
    assert.ok(mismatch);
    assert.equal(mismatch?.deltaCents, 5_000);
  });

  it("detects unrefunded budget decrease", () => {
    const mismatch = getContestBudgetPaymentMismatch({
      id: "c1",
      contest_type: "cpm",
      contest_based_details: {
        cpm_contest: { total_budget: 20_000 },
      },
      payment_details: completedPaymentDetails(),
    });
    assert.ok(mismatch);
    assert.equal(mismatch?.deltaCents, -5_000);
  });
});
