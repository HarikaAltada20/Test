import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatBulkModerationRefundToast,
  formatRefundReversalToastLine,
} from "./bulk-payment-toast";

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

describe("formatRefundReversalToastLine", () => {
  it("omits a $0 bonus line", () => {
    assert.equal(
      formatRefundReversalToastLine(
        {
          reward_refunded_cents: 164,
          bonus_refunded_cents: 0,
          total_refunded_cents: 164,
        },
        fmt,
      ),
      "$1.64 reversed ($1.64 total).",
    );
  });

  it("includes bonus when present", () => {
    assert.equal(
      formatRefundReversalToastLine(
        {
          reward_refunded_cents: 100,
          bonus_refunded_cents: 50,
          total_refunded_cents: 150,
        },
        fmt,
      ),
      "$1.00 reward reversed, $0.50 bonus reversed ($1.50 total).",
    );
  });
});

describe("formatBulkModerationRefundToast", () => {
  it("matches video-style one-line refunded/skipped/total layout", () => {
    assert.equal(
      formatBulkModerationRefundToast({
        actionText: "Verified",
        successCount: 6,
        failedCount: 0,
        refundedCount: 3,
        skippedCount: 3,
        rewardCents: 176,
        bonusCents: 0,
        totalCents: 176,
      }),
      "Successfully Verified 6 submission(s). Refunded 3 · Skipped 3. $1.76 reversed ($1.76 total).",
    );
  });

  it("includes bonus only when bonus cents are > 0", () => {
    assert.equal(
      formatBulkModerationRefundToast({
        actionText: "Verified",
        successCount: 2,
        refundedCount: 2,
        skippedCount: 0,
        rewardCents: 100,
        bonusCents: 50,
        totalCents: 150,
      }),
      "Successfully Verified 2 submission(s). Refunded 2. $1.00 reward reversed, $0.50 bonus reversed ($1.50 total).",
    );
  });

  it("omits refunded/skipped when no paid submissions were reversed", () => {
    assert.equal(
      formatBulkModerationRefundToast({
        actionText: "Verified",
        successCount: 17,
        refundedCount: 0,
        skippedCount: 17,
        rewardCents: 0,
        bonusCents: 0,
        totalCents: 0,
      }),
      "Successfully Verified 17 submission(s).",
    );
  });
});
