import { CreditCard, Landmark, Mail, Sparkles, Wallet, type LucideIcon } from "lucide-react";
import type { PayoutMethod, PayoutMethodType } from "@/types/earnings";

export interface PayoutMethodMeta {
  label: string;
  icon: LucideIcon;
  /** One short line shown on the picker card. */
  descriptor: string;
}

// TODO: there is no payout timing config; replace this if one is added.
export const PAYOUT_PROCESSING_TIME = "2–48 hours";

export const PAYOUT_METHOD_META: Record<PayoutMethodType, PayoutMethodMeta> = {
  upi: { label: "UPI", icon: Sparkles, descriptor: PAYOUT_PROCESSING_TIME },
  bank_transfer: { label: "Bank transfer", icon: Landmark, descriptor: PAYOUT_PROCESSING_TIME },
  crypto: { label: "Crypto", icon: Wallet, descriptor: PAYOUT_PROCESSING_TIME },
  skydo: { label: "Skydo", icon: Mail, descriptor: PAYOUT_PROCESSING_TIME },
  phantom: { label: "Phantom", icon: Wallet, descriptor: PAYOUT_PROCESSING_TIME },
};

export function getPayoutMethodMeta(type: PayoutMethodType | string): PayoutMethodMeta {
  return (
    PAYOUT_METHOD_META[type as PayoutMethodType] ?? {
      label: "Payout method",
      icon: CreditCard,
      descriptor: "",
    }
  );
}

/** Title and masked detail line for a saved method. */
export function describeSavedMethod(method: PayoutMethod): { title: string; detail: string } {
  const d = (method.details ?? {}) as Record<string, string | undefined>;
  const meta = getPayoutMethodMeta(method.method_type);
  switch (method.method_type) {
    case "crypto":
      return {
        title: method.friendly_name || "Crypto wallet",
        detail: `${d.currency ?? ""}${d.network ? ` · ${d.network === "BNB_SMART_CHAIN" ? "BNB Smart Chain" : d.network === "SOLANA" ? "Solana" : d.network}` : ""} · …${d.wallet_address?.slice(-4) ?? "XXXX"}`,
      };
    case "upi":
      return { title: method.friendly_name || "UPI", detail: d.upi_id ?? "—" };
    case "bank_transfer":
      return {
        title: method.friendly_name || "Bank account",
        detail: `${d.bank_name ? `${d.bank_name} · ` : ""}…${d.account_number?.slice(-4) ?? "XXXX"}`,
      };
    case "phantom":
      return {
        title: method.friendly_name || "Phantom wallet",
        detail: `…${d.wallet_address?.slice(-4) ?? "XXXX"}`,
      };
    case "skydo":
      return { title: "Skydo", detail: d.email ?? "—" };
    default:
      return { title: meta.label, detail: "" };
  }
}
