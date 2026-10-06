import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  centsToAmountInput,
  parseAmountToCents,
  sanitizeAmountInput,
  validateWithdrawAmount,
} from "./withdraw-amount";

const limits = { minCents: 500, availableCents: 3778, minLabel: "$5.00" };

describe("sanitizeAmountInput", () => {
  it("keeps digits and one dot with two decimals", () => {
    assert.equal(sanitizeAmountInput("$1,234.567"), "1234.56");
    assert.equal(sanitizeAmountInput("0"), "0");
    assert.equal(sanitizeAmountInput("0."), "0.");
    assert.equal(sanitizeAmountInput("1.2.3"), "1.23");
    assert.equal(sanitizeAmountInput("abc"), "");
  });
});

describe("parseAmountToCents", () => {
  it("parses partial and full amounts", () => {
    assert.equal(parseAmountToCents("5"), 500);
    assert.equal(parseAmountToCents("5."), 500);
    assert.equal(parseAmountToCents("0.5"), 50);
    assert.equal(parseAmountToCents(".75"), 75);
    assert.equal(parseAmountToCents("37.78"), 3778);
  });

  it("rejects malformed input", () => {
    assert.equal(parseAmountToCents(""), null);
    assert.equal(parseAmountToCents("."), null);
    assert.equal(parseAmountToCents("1.234"), null);
    assert.equal(parseAmountToCents("-5"), null);
  });
});

describe("centsToAmountInput", () => {
  it("formats cents as a two-decimal string", () => {
    assert.equal(centsToAmountInput(3778), "37.78");
    assert.equal(centsToAmountInput(500), "5.00");
    assert.equal(centsToAmountInput(-1), "0.00");
  });
});

describe("validateWithdrawAmount", () => {
  it("accepts amounts within the limits, including the full balance", () => {
    assert.deepEqual(validateWithdrawAmount("5", limits), { cents: 500, error: null });
    assert.deepEqual(validateWithdrawAmount("37.78", limits), { cents: 3778, error: null });
  });

  it("explains each failure", () => {
    assert.equal(validateWithdrawAmount("", limits).error, "Enter a valid withdrawal amount.");
    assert.equal(validateWithdrawAmount("0", limits).error, "Enter a valid withdrawal amount.");
    assert.equal(
      validateWithdrawAmount("4.99", limits).error,
      "Minimum cash withdrawal amount is $5.00."
    );
    assert.equal(validateWithdrawAmount("37.79", limits).error, "Insufficient cash balance.");
  });
});
