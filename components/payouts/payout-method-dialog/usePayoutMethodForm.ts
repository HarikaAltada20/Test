"use client";

import { useCallback, useMemo, useState } from "react";
import type { PayoutMethod, PayoutMethodType } from "@/types/earnings";
import {
  CRYPTO_NETWORKS,
  DEFAULT_CRYPTO_NETWORK,
  PAYOUT_TYPES_BY_COUNTRY,
  buildPayoutMethodDraft,
  checkWalletAddressFormat,
  emptyPayoutFormValues,
  validatePayoutForm,
  type CryptoNetwork,
  type PayoutCountry,
  type PayoutFieldErrors,
  type PayoutFieldKey,
  type PayoutFormValues,
  type PayoutMethodDraft,
  type PayoutValidationContext,
  type WalletValidationStatus,
} from "@/lib/payout-method-validation";

/** Order in which invalid fields get focused after a failed submit. */
const FIELD_FOCUS_ORDER: PayoutFieldKey[] = [
  "upiId",
  "accountHolder",
  "accountNumber",
  "ifscCode",
  "cryptoNetwork",
  "cryptoAddress",
  "skydoEmail",
  "friendlyName",
  "skydoConfirmed",
];

export const PAYOUT_FIELD_IDS: Record<Exclude<PayoutFieldKey, "form">, string> = {
  friendlyName: "payoutFriendlyName",
  upiId: "payoutUpiId",
  accountHolder: "payoutAccountHolder",
  accountNumber: "payoutAccountNumber",
  ifscCode: "payoutIfscCode",
  cryptoAddress: "payoutCryptoAddress",
  cryptoNetwork: "payoutCryptoNetwork",
  skydoEmail: "skydoEmail",
  skydoConfirmed: "skydoConfirm",
};

type ContextInput = Omit<PayoutValidationContext, "walletStatus" | "walletError">;

export function usePayoutMethodForm(context: ContextInput) {
  const [country, setCountryState] = useState<PayoutCountry>("IN");
  const [type, setType] = useState<PayoutMethodType>("upi");
  const [values, setValues] = useState<PayoutFormValues>(emptyPayoutFormValues);
  const [touched, setTouched] = useState<Partial<Record<PayoutFieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [walletStatus, setWalletStatus] = useState<WalletValidationStatus>("idle");
  const [walletError, setWalletError] = useState("");
  const [editingMethod, setEditingMethod] = useState<PayoutMethod | null>(null);

  const fullContext: PayoutValidationContext = useMemo(
    () => ({ ...context, isEditing: context.isEditing || !!editingMethod, walletStatus, walletError }),
    [context, editingMethod, walletStatus, walletError]
  );

  const validation = useMemo(
    () => validatePayoutForm(type, values, fullContext),
    [type, values, fullContext]
  );

  /** Errors shown in the UI: only for touched fields, or everything after a submit attempt. */
  const visibleErrors: PayoutFieldErrors = useMemo(() => {
    const out: PayoutFieldErrors = {};
    for (const [key, message] of Object.entries(validation.errors) as [PayoutFieldKey, string][]) {
      if (submitted || touched[key]) out[key] = message;
    }
    // A failed format check is shown immediately, not only after blur.
    if (type === "crypto" && walletStatus === "invalid" && walletError) out.cryptoAddress = walletError;
    return out;
  }, [validation.errors, submitted, touched, type, walletStatus, walletError]);

  const setField = useCallback(
    <K extends keyof PayoutFormValues>(key: K, value: PayoutFormValues[K]) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "cryptoNetwork") {
          const network = CRYPTO_NETWORKS[value as CryptoNetwork];
          if (network) next.cryptoCurrency = network.defaultCurrency;
        }
        return next;
      });
      if (key === "cryptoAddress" || key === "cryptoNetwork") {
        setWalletStatus("idle");
        setWalletError("");
      }
    },
    []
  );

  const markTouched = useCallback((key: PayoutFieldKey) => {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  const setCountry = useCallback((next: PayoutCountry) => {
    setCountryState(next);
    setType(PAYOUT_TYPES_BY_COUNTRY[next][0]);
    setTouched({});
    setSubmitted(false);
  }, []);

  const selectType = useCallback((next: PayoutMethodType) => {
    setType(next);
    setTouched({});
    setSubmitted(false);
  }, []);

  const checkWallet = useCallback(() => {
    if (!values.cryptoAddress.trim()) {
      setWalletStatus("idle");
      return;
    }
    setWalletStatus("validating");
    const result = checkWalletAddressFormat(values.cryptoNetwork, values.cryptoAddress);
    if (result.valid) {
      setWalletStatus("valid");
      setWalletError("");
    } else {
      setWalletStatus("invalid");
      setWalletError(result.error);
    }
    markTouched("cryptoAddress");
  }, [markTouched, values.cryptoAddress, values.cryptoNetwork]);

  const reset = useCallback(() => {
    setCountryState("IN");
    setType(PAYOUT_TYPES_BY_COUNTRY.IN[0]);
    setValues(emptyPayoutFormValues());
    setTouched({});
    setSubmitted(false);
    setWalletStatus("idle");
    setWalletError("");
    setEditingMethod(null);
  }, []);

  const loadForEdit = useCallback((method: PayoutMethod) => {
    const d = (method.details ?? {}) as Record<string, string | undefined>;
    const base = emptyPayoutFormValues();
    base.friendlyName = method.friendly_name || "";
    if (method.method_type === "crypto") {
      base.cryptoAddress = d.wallet_address || "";
      base.cryptoNetwork = d.network || DEFAULT_CRYPTO_NETWORK;
      base.cryptoCurrency = d.currency || CRYPTO_NETWORKS[DEFAULT_CRYPTO_NETWORK].defaultCurrency;
    } else if (method.method_type === "upi") {
      base.upiId = d.upi_id || "";
      base.accountHolder = d.account_holder_name || "";
    } else if (method.method_type === "bank_transfer") {
      base.accountHolder = d.account_holder_name || "";
      base.accountNumber = d.account_number || "";
      base.ifscCode = d.ifsc_code || "";
      base.bankRoutingNumber = d.swift_bic_code || "";
      base.bankName = d.bank_name || "";
      base.bankBranchName = d.branch_name || "";
      base.bankCountry = d.country || "IN";
    }
    setEditingMethod(method);
    setType(method.method_type);
    setCountryState(
      method.method_type === "upi" || method.method_type === "bank_transfer" || method.method_type === "skydo"
        ? "IN"
        : "OTHER"
    );
    setValues(base);
    setTouched({});
    setSubmitted(false);
    setWalletStatus("idle");
    setWalletError("");
  }, []);

  /**
   * Validates everything. Returns the draft to save, or null and focuses the
   * first invalid field.
   */
  const prepareSubmit = useCallback((): PayoutMethodDraft | null => {
    setSubmitted(true);
    const { errors, details } = validatePayoutForm(type, values, fullContext);
    if (details && Object.keys(errors).length === 0) {
      return buildPayoutMethodDraft(type, details, values.friendlyName, editingMethod?.id);
    }
    const first = FIELD_FOCUS_ORDER.find((k) => errors[k]);
    if (first && first !== "form") {
      requestAnimationFrame(() => {
        document.getElementById(PAYOUT_FIELD_IDS[first])?.focus();
      });
    }
    return null;
  }, [editingMethod?.id, fullContext, type, values]);

  return {
    country,
    setCountry,
    type,
    selectType,
    values,
    setField,
    markTouched,
    errors: visibleErrors,
    formError: visibleErrors.form,
    walletStatus,
    checkWallet,
    editingMethod,
    loadForEdit,
    reset,
    prepareSubmit,
  };
}

export type PayoutMethodFormState = ReturnType<typeof usePayoutMethodForm>;
