import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const paymentUtilsSrc = readFileSync(
  fileURLToPath(new URL("./payment-utils.ts", import.meta.url)),
  "utf8",
);

describe("debitCreatorReversalClawback", () => {
  it("exports clawback helper that forces allowNegativeBalance", () => {
    assert.match(paymentUtilsSrc, /export function debitCreatorReversalClawback/);
    assert.match(
      paymentUtilsSrc,
      /debitCreatorWithdrawableBalance\([\s\S]*?allowNegativeBalance:\s*true/,
    );
  });

  it("passes p_allow_negative_balance to payout debit RPCs", () => {
    assert.match(paymentUtilsSrc, /p_allow_negative_balance:\s*allowNegativeBalance/);
    assert.match(
      paymentUtilsSrc,
      /allowNegativeBalance\s*=\s*Boolean\(opts\?\.allowNegativeBalance\)/,
    );
  });

  it("legacy fallback honors allowNegativeBalance when RPC is missing", () => {
    assert.match(
      paymentUtilsSrc,
      /async function debitCreatorWithdrawableBalanceLegacy\([\s\S]*?allowNegativeBalance/,
    );
    assert.match(
      paymentUtilsSrc,
      /if \(!allowNegativeBalance && currentBalance < amountInCents\)/,
    );
  });
});
