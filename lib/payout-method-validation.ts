import type { PayoutMethodDetails, PayoutMethodType } from "@/types/earnings";
import {
  SKYDO_FRIENDLY_NAME,
  isValidSkydoEmail,
  normalizeSkydoEmail,
} from "@/lib/skydo-payout";

export type PayoutCountry = "IN" | "OTHER";
export type WalletValidationStatus = "idle" | "validating" | "valid" | "invalid";

export const CRYPTO_NETWORKS = {
  BNB_SMART_CHAIN: {
    label: "BNB Smart Chain (BEP20)",
    shortLabel: "BNB Smart Chain (BEP20)",
    currencies: [
      { value: "BNB", label: "BNB" },
      { value: "USDT", label: "USDT (BEP20)" },
    ],
    defaultCurrency: "BNB",
  },
  SOLANA: {
    label: "Solana",
    shortLabel: "Solana",
    currencies: [
      { value: "SOL", label: "SOL" },
      { value: "USDT", label: "USDT" },
      { value: "USDC", label: "USDC" },
    ],
    defaultCurrency: "SOL",
  },
} as const;

export type CryptoNetwork = keyof typeof CRYPTO_NETWORKS;

export const DEFAULT_CRYPTO_NETWORK: CryptoNetwork = "BNB_SMART_CHAIN";

/** Methods offered per country, in display order. */
export const PAYOUT_TYPES_BY_COUNTRY: Record<PayoutCountry, PayoutMethodType[]> = {
  IN: ["upi", "bank_transfer", "crypto", "skydo"],
  OTHER: ["crypto"],
};

export interface PayoutFormValues {
  friendlyName: string;
  upiId: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  /** No inputs; preserved from an edited method. */
  bankBranchName: string;
  bankCountry: string;
  bankRoutingNumber: string;
  cryptoAddress: string;
  cryptoNetwork: string;
  cryptoCurrency: string;
  skydoEmail: string;
  skydoConfirmed: boolean;
}

export type PayoutFieldKey =
  | "friendlyName"
  | "upiId"
  | "accountHolder"
  | "accountNumber"
  | "ifscCode"
  | "cryptoAddress"
  | "cryptoNetwork"
  | "skydoEmail"
  | "skydoConfirmed"
  | "form";

export type PayoutFieldErrors = Partial<Record<PayoutFieldKey, string>>;

export function emptyPayoutFormValues(): PayoutFormValues {
  return {
    friendlyName: "",
    upiId: "",
    accountHolder: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
    bankBranchName: "",
    bankCountry: "IN",
    bankRoutingNumber: "",
    cryptoAddress: "",
    cryptoNetwork: DEFAULT_CRYPTO_NETWORK,
    cryptoCurrency: CRYPTO_NETWORKS[DEFAULT_CRYPTO_NETWORK].defaultCurrency,
    skydoEmail: "",
    skydoConfirmed: false,
  };
}

export function isAlphabeticName(name: string): boolean {
  const cleanedName = name.trim();
  if (!cleanedName) return false;
  return /^[A-Za-z][A-Za-z\s'.-]*$/.test(cleanedName);
}

export function isValidUpiId(value: string): boolean {
  const trimmedValue = value.trim();
  if (!trimmedValue) return false;
  return /^[A-Za-z0-9][A-Za-z0-9.\-_]{1,}@[A-Za-z][A-Za-z0-9]{2,}$/.test(trimmedValue);
}

export function checkWalletAddressFormat(
  network: string,
  address: string
): { valid: true } | { valid: false; error: string } {
  const value = address.trim();
  if (network === "BNB_SMART_CHAIN") {
    return /^0x[a-fA-F0-9]{40}$/.test(value)
      ? { valid: true }
      : {
          valid: false,
          error:
            "Invalid BNB Smart Chain (BEP20) address format. Must start with 0x and be 42 characters total.",
        };
  }
  if (network === "SOLANA") {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
      ? { valid: true }
      : {
          valid: false,
          error: "Invalid Solana wallet address format. Must be 32-44 base58 characters.",
        };
  }
  return { valid: false, error: "Choose a supported network." };
}

export interface PayoutValidationContext {
  isEditing: boolean;
  hasExistingSkydo: boolean;
  skydoEligible: boolean;
  /** Formatted minimum balance, e.g. "$5.00". */
  skydoMinBalanceLabel: string;
  walletStatus: WalletValidationStatus;
  walletError?: string;
}

/**
 * Same rules as the original save handler, but collects every field error
 * instead of stopping at the first toast.
 */
export function validatePayoutForm(
  type: PayoutMethodType,
  values: PayoutFormValues,
  ctx: PayoutValidationContext
): { errors: PayoutFieldErrors; details: PayoutMethodDetails | null } {
  const errors: PayoutFieldErrors = {};
  const isSkydo = type === "skydo";

  if (!isSkydo) {
    const name = values.friendlyName.trim();
    if (!name) errors.friendlyName = "Enter a friendly name for this payout method.";
    else if (/^\d+$/.test(name)) errors.friendlyName = "Friendly name can't be only numbers.";
  }

  let details: PayoutMethodDetails | null = null;

  if (isSkydo) {
    if (ctx.isEditing || ctx.hasExistingSkydo) {
      errors.form = ctx.isEditing
        ? "Skydo email can't be edited. While it's pending you can remove it and add a different one."
        : "You've already added a Skydo email. Remove it first to add a different one.";
    } else if (!ctx.skydoEligible) {
      errors.form = `You need at least ${ctx.skydoMinBalanceLabel} in your withdrawable balance to add Skydo.`;
    }
    if (!isValidSkydoEmail(values.skydoEmail)) errors.skydoEmail = "Enter a valid email address.";
    if (!values.skydoConfirmed) errors.skydoConfirmed = "Confirm this is your permanent email.";
    details = { email: normalizeSkydoEmail(values.skydoEmail) };
  } else if (type === "crypto") {
    if (!values.cryptoNetwork.trim()) errors.cryptoNetwork = "Choose a network.";
    if (!values.cryptoAddress.trim()) errors.cryptoAddress = "Enter your wallet address.";
    else if (ctx.walletStatus === "invalid")
      errors.cryptoAddress = ctx.walletError || "Invalid wallet address format.";
    else if (ctx.walletStatus !== "valid")
      errors.cryptoAddress = "Check the address format before saving.";
    details = {
      wallet_address: values.cryptoAddress.trim(),
      network: values.cryptoNetwork.trim(),
      currency: values.cryptoCurrency.trim(),
    };
  } else if (type === "upi") {
    if (!values.accountHolder.trim()) errors.accountHolder = "Enter the account holder name.";
    else if (!isAlphabeticName(values.accountHolder))
      errors.accountHolder = "Use letters only. Spaces, apostrophes, dots and hyphens are fine.";
    if (!values.upiId.trim()) errors.upiId = "Enter your UPI ID.";
    else if (!isValidUpiId(values.upiId)) errors.upiId = "Enter a valid UPI ID, e.g. name@bank.";
    details = {
      account_holder_name: values.accountHolder.trim(),
      upi_id: values.upiId.trim(),
    };
  } else if (type === "bank_transfer") {
    if (!values.accountHolder.trim()) errors.accountHolder = "Enter the account holder name.";
    if (!values.accountNumber.trim()) errors.accountNumber = "Enter the account number.";
    if (!values.ifscCode.trim()) errors.ifscCode = "Enter the IFSC code.";
    const bankDetails: Record<string, string> = {
      account_holder_name: values.accountHolder.trim(),
      account_number: values.accountNumber.trim(),
      ifsc_code: values.ifscCode.trim(),
      country: values.bankCountry.trim(),
    };
    if (values.bankRoutingNumber.trim()) bankDetails.swift_bic_code = values.bankRoutingNumber.trim();
    if (values.bankName.trim()) bankDetails.bank_name = values.bankName.trim();
    if (values.bankBranchName.trim()) bankDetails.branch_name = values.bankBranchName.trim();
    details = bankDetails as unknown as PayoutMethodDetails;
  } else {
    errors.form = "Invalid payout method type selected.";
  }

  return { errors, details: Object.keys(errors).length === 0 ? details : null };
}

export interface PayoutMethodDraft {
  id?: string;
  method_type: PayoutMethodType;
  details: PayoutMethodDetails;
  friendly_name: string;
}

export function buildPayoutMethodDraft(
  type: PayoutMethodType,
  details: PayoutMethodDetails,
  friendlyName: string,
  editingId?: string | null
): PayoutMethodDraft {
  return {
    method_type: type,
    details,
    friendly_name: type === "skydo" ? SKYDO_FRIENDLY_NAME : friendlyName.trim(),
    ...(editingId ? { id: editingId } : {}),
  };
}

/** Best human-readable message from a Supabase/PostgREST error (or anything thrown). */
export function getSupabaseErrorMessage(error: unknown): string {
  const fallback = "Something went wrong. Please try again.";
  if (typeof error === "string") return error.trim() || fallback;
  if (!error || typeof error !== "object") return fallback;
  const e = error as { message?: unknown; details?: unknown; code?: unknown };
  if (typeof e.message === "string" && e.message.trim()) return e.message;
  if (typeof e.details === "string" && e.details.trim()) return e.details;
  if (typeof e.code === "string" && e.code.trim()) return `Error code: ${e.code}`;
  return fallback;
}
