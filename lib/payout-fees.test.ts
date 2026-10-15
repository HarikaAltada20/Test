import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatFeePercent,
  formatInrFromPaise,
  parseFeePercentToBps,
  parsePayoutFeeSettings,
  parseUsdInrRate,
  processingFeeExplainer,
  quotePayout,
  withdrawalPayout,
} from "./payout-fees";

describe("quotePayout", () => {
  it("converts UPI to INR after the fee", () => {
    const q = quotePayout({ amountCents: 10000, methodType: "upi", feeBps: 2000, usdInrRate: 90 });
    assert.equal(q.feeCents, 2000);
    assert.equal(q.netCents, 8000);
    assert.equal(q.currency, "INR");
    assert.equal(q.netLocalMinor, 720000);
  });

  it("treats bank transfer as INR", () => {
    const q = quotePayout({ amountCents: 500, methodType: "bank_transfer", feeBps: 1000, usdInrRate: 90 });
    assert.equal(q.currency, "INR");
    assert.equal(q.netLocalMinor, 40500);
  });

  it("keeps crypto and Skydo in USD with no INR amount", () => {
    for (const methodType of ["crypto", "skydo"]) {
      const q = quotePayout({ amountCents: 10000, methodType, feeBps: 1000, usdInrRate: 90 });
      assert.equal(q.currency, "USD");
      assert.equal(q.netCents, 9000);
      assert.equal(q.netLocalMinor, null);
      assert.equal(q.usdInrRate, null);
    }
  });

  it("rounds half up like the database", () => {
    // 105 * 2.5% = 2.625 -> 3
    assert.equal(quotePayout({ amountCents: 105, methodType: "crypto", feeBps: 250, usdInrRate: 90 }).feeCents, 3);
    // 101 * 2.5% = 2.525 -> 3
    assert.equal(quotePayout({ amountCents: 101, methodType: "crypto", feeBps: 250, usdInrRate: 90 }).feeCents, 3);
    // 99 * 2.5% = 2.475 -> 2
    assert.equal(quotePayout({ amountCents: 99, methodType: "crypto", feeBps: 250, usdInrRate: 90 }).feeCents, 2);
    // 333 cents * 83.3333 = 27749.9889 paise -> 27750
    assert.equal(quotePayout({ amountCents: 333, methodType: "upi", feeBps: 0, usdInrRate: 83.3333 }).netLocalMinor, 27750);
  });

  it("charges nothing at 0%", () => {
    const q = quotePayout({ amountCents: 3778, methodType: "upi", feeBps: 0, usdInrRate: 90 });
    assert.equal(q.feeCents, 0);
    assert.equal(q.netCents, 3778);
  });
});

describe("fee percent parsing and formatting", () => {
  it("parses percent input to basis points", () => {
    assert.equal(parseFeePercentToBps("10"), 1000);
    assert.equal(parseFeePercentToBps("2.5"), 250);
    assert.equal(parseFeePercentToBps("2.55%"), 255);
    assert.equal(parseFeePercentToBps("0"), 0);
    assert.equal(parseFeePercentToBps("50"), 5000);
    assert.equal(parseFeePercentToBps("50.01"), null);
    assert.equal(parseFeePercentToBps("2.555"), null);
    assert.equal(parseFeePercentToBps("-1"), null);
    assert.equal(parseFeePercentToBps(""), null);
  });

  it("formats basis points as a percent", () => {
    assert.equal(formatFeePercent(1000), "10%");
    assert.equal(formatFeePercent(250), "2.5%");
    assert.equal(formatFeePercent(255), "2.55%");
    assert.equal(formatFeePercent(0), "0%");
  });

  it("validates the INR rate", () => {
    assert.equal(parseUsdInrRate("90"), 90);
    assert.equal(parseUsdInrRate("83.1234"), 83.1234);
    assert.equal(parseUsdInrRate("83.12345"), null);
    assert.equal(parseUsdInrRate("0.5"), null);
    assert.equal(parseUsdInrRate("501"), null);
  });

  it("formats INR in Indian grouping", () => {
    assert.equal(formatInrFromPaise(877500), "₹8,775.00");
    assert.equal(formatInrFromPaise(12345600), "₹1,23,456.00");
  });

  it("uses the approved explainer text", () => {
    assert.equal(
      processingFeeExplainer(1000),
      "A 10% fee is deducted from each withdrawal to cover payment processing, transfers and platform costs. No other charges from us."
    );
  });
});

describe("parsePayoutFeeSettings", () => {
  it("reads fees and rate, with safe defaults", () => {
    const s = parsePayoutFeeSettings({
      pausedMethodTypes: ["crypto"],
      methods: [{ method_type: "upi", fee_bps: 1000, is_paused: false }],
      usdInrRate: 88.5,
    });
    assert.deepEqual(s.pausedMethodTypes, ["crypto"]);
    assert.equal(s.feeBpsByMethod.upi, 1000);
    assert.equal(s.usdInrRate, 88.5);
    assert.equal(parsePayoutFeeSettings(null).usdInrRate, 90);
  });
});

describe("withdrawalPayout", () => {
  it("shows INR for new UPI requests", () => {
    const p = withdrawalPayout({
      amount: 10000,
      fee_bps: 1000,
      fee_cents: 1000,
      net_amount_cents: 9000,
      payout_currency: "INR",
      fx_rate_snapshot: "90.0000",
      net_amount_local_minor: 810000,
    });
    assert.equal(p.receiveLabel, "₹8,100.00");
    assert.equal(p.usdInrRate, 90);
  });

  it("falls back to the full USD amount for older requests", () => {
    const p = withdrawalPayout({ amount: 2000 });
    assert.equal(p.feeCents, 0);
    assert.equal(p.netCents, 2000);
    assert.equal(p.currency, "USD");
    assert.equal(p.receiveLabel, "$20.00");
  });
});
