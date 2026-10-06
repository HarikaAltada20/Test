import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPayoutMethodDraft,
  checkWalletAddressFormat,
  emptyPayoutFormValues,
  getSupabaseErrorMessage,
  isAlphabeticName,
  isValidUpiId,
  validatePayoutForm,
  type PayoutFormValues,
  type PayoutValidationContext,
} from "./payout-method-validation";
import { canRemoveSkydo } from "./skydo-payout";

const ctx: PayoutValidationContext = {
  isEditing: false,
  hasExistingSkydo: false,
  skydoEligible: true,
  skydoMinBalanceLabel: "$5.00",
  walletStatus: "idle",
};

const values = (overrides: Partial<PayoutFormValues>): PayoutFormValues => ({
  ...emptyPayoutFormValues(),
  ...overrides,
});

describe("name and UPI validators", () => {
  it("accepts alphabetic names with common punctuation", () => {
    assert.equal(isAlphabeticName("Anne-Marie O'Neil Jr."), true);
    assert.equal(isAlphabeticName("John2"), false);
    assert.equal(isAlphabeticName("  "), false);
  });

  it("validates UPI IDs", () => {
    assert.equal(isValidUpiId("name.1@okhdfc"), true);
    assert.equal(isValidUpiId("name@1bank"), false);
    assert.equal(isValidUpiId("noatsign"), false);
  });
});

describe("checkWalletAddressFormat", () => {
  it("checks BEP20 addresses", () => {
    assert.deepEqual(
      checkWalletAddressFormat("BNB_SMART_CHAIN", `0x${"a".repeat(40)}`),
      { valid: true }
    );
    assert.equal(checkWalletAddressFormat("BNB_SMART_CHAIN", "0x123").valid, false);
  });

  it("checks Solana addresses", () => {
    assert.equal(
      checkWalletAddressFormat("SOLANA", "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T").valid,
      true
    );
    assert.equal(checkWalletAddressFormat("SOLANA", "0OIl").valid, false);
  });

  it("rejects unknown networks", () => {
    assert.equal(checkWalletAddressFormat("BNB_BEP20", `0x${"a".repeat(40)}`).valid, false);
  });
});

describe("validatePayoutForm", () => {
  it("builds the UPI payload", () => {
    const result = validatePayoutForm(
      "upi",
      values({ friendlyName: "My UPI", upiId: " me@okaxis ", accountHolder: "Asha Rao" }),
      ctx
    );
    assert.deepEqual(result.errors, {});
    assert.deepEqual(result.details, { account_holder_name: "Asha Rao", upi_id: "me@okaxis" });
  });

  it("reports every missing UPI field at once", () => {
    const result = validatePayoutForm("upi", values({}), ctx);
    assert.equal(result.details, null);
    assert.deepEqual(Object.keys(result.errors).sort(), ["accountHolder", "friendlyName", "upiId"]);
  });

  it("rejects numeric-only friendly names", () => {
    const result = validatePayoutForm("upi", values({ friendlyName: "1234" }), ctx);
    assert.match(result.errors.friendlyName ?? "", /only numbers/);
  });

  it("adds optional bank fields only when set", () => {
    const base = {
      friendlyName: "HDFC",
      accountHolder: "Asha Rao",
      accountNumber: "123456",
      ifscCode: "HDFC0001234",
    };
    assert.deepEqual(validatePayoutForm("bank_transfer", values(base), ctx).details, {
      account_holder_name: "Asha Rao",
      account_number: "123456",
      ifsc_code: "HDFC0001234",
      country: "IN",
    });
    assert.deepEqual(
      validatePayoutForm("bank_transfer", values({ ...base, bankName: "HDFC Bank" }), ctx).details,
      {
        account_holder_name: "Asha Rao",
        account_number: "123456",
        ifsc_code: "HDFC0001234",
        country: "IN",
        bank_name: "HDFC Bank",
      }
    );
  });

  it("requires a checked wallet before saving crypto", () => {
    const form = values({ friendlyName: "Wallet", cryptoAddress: `0x${"b".repeat(40)}` });
    assert.match(
      validatePayoutForm("crypto", form, ctx).errors.cryptoAddress ?? "",
      /Check the address format/
    );
    const ok = validatePayoutForm("crypto", form, { ...ctx, walletStatus: "valid" });
    assert.deepEqual(ok.details, {
      wallet_address: `0x${"b".repeat(40)}`,
      network: "BNB_SMART_CHAIN",
      currency: "BNB",
    });
  });

  it("enforces Skydo rules", () => {
    const form = values({ skydoEmail: " Me@Example.com ", skydoConfirmed: true });
    assert.deepEqual(validatePayoutForm("skydo", form, ctx).details, { email: "me@example.com" });
    assert.ok(validatePayoutForm("skydo", form, { ...ctx, hasExistingSkydo: true }).errors.form);
    assert.match(
      validatePayoutForm("skydo", form, { ...ctx, skydoEligible: false }).errors.form ?? "",
      /\$5\.00/
    );
    assert.ok(
      validatePayoutForm("skydo", values({ skydoEmail: "me@example.com" }), ctx).errors
        .skydoConfirmed
    );
  });
});

describe("buildPayoutMethodDraft", () => {
  it("uses the fixed Skydo name and includes the id when editing", () => {
    const draft = buildPayoutMethodDraft("upi", { upi_id: "a@b" } as never, " Mine ", "abc");
    assert.deepEqual(draft, {
      method_type: "upi",
      details: { upi_id: "a@b" },
      friendly_name: "Mine",
      id: "abc",
    });
    assert.notEqual(
      buildPayoutMethodDraft("skydo", { email: "a@b.co" } as never, "ignored").friendly_name,
      "ignored"
    );
  });
});

describe("canRemoveSkydo", () => {
  it("allows removal only while the Skydo email is pending", () => {
    assert.equal(canRemoveSkydo({ method_type: "skydo", skydo_status: "email_pending" }), true);
    assert.equal(canRemoveSkydo({ method_type: "skydo", skydo_status: null }), true);
    assert.equal(canRemoveSkydo({ method_type: "skydo", skydo_status: "email_sent" }), false);
    assert.equal(canRemoveSkydo({ method_type: "skydo", skydo_status: "verified" }), false);
    assert.equal(canRemoveSkydo({ method_type: "upi", skydo_status: null }), false);
  });
});

describe("getSupabaseErrorMessage", () => {
  it("prefers message, then details, then code", () => {
    assert.equal(getSupabaseErrorMessage({ message: "boom", details: "d" }), "boom");
    assert.equal(getSupabaseErrorMessage({ message: "", details: "d" }), "d");
    assert.equal(getSupabaseErrorMessage({ code: "23505" }), "Error code: 23505");
    assert.equal(getSupabaseErrorMessage(null), "Something went wrong. Please try again.");
  });
});
