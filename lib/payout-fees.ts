import { formatCurrencyFromCents } from "@/lib/currency-utils";

/**
 * Processing fees and USD to INR conversion for withdrawals.
 *
 * The maths must match public._payout_fee_quote in
 * SUPABASE/migrations/20261014150000_payout_fees_and_fx.sql:
 *   fee   = round(amount * feeBps / 10000), half up
 *   net   = amount - fee
 *   paise = round(net * usdInrRate), half up (UPI and bank transfer only)
 * Integer maths only, so the preview never differs from what is stored.
 */

export const PAYOUT_FEE_METHOD_TYPES = ["upi", "bank_transfer", "crypto", "skydo"] as const;
export type PayoutFeeMethodType = (typeof PAYOUT_FEE_METHOD_TYPES)[number];

/** Methods paid out in INR at the admin-set rate. */
export const INR_PAYOUT_METHOD_TYPES: readonly string[] = ["upi", "bank_transfer"];

export const DEFAULT_USD_INR_RATE = 90;
export const MAX_FEE_BPS = 5000;
export const MIN_USD_INR_RATE = 1;
export const MAX_USD_INR_RATE = 500;

export type PayoutCurrency = "INR" | "USD";

export interface PayoutQuote {
  feeBps: number;
  feeCents: number;
  netCents: number;
  currency: PayoutCurrency;
  /** Rate used for INR payouts; null for USD payouts. */
  usdInrRate: number | null;
  /** Amount to send in paise; null for USD payouts. */
  netLocalMinor: number | null;
}

export function payoutCurrencyFor(methodType: string): PayoutCurrency {
  return INR_PAYOUT_METHOD_TYPES.includes(methodType) ? "INR" : "USD";
}

function roundHalfUpDiv(numerator: number, divisor: number): number {
  return Math.floor((numerator + divisor / 2) / divisor);
}

/** 90.1234 -> 901234. Rates are stored with at most 4 decimals. */
export function rateToE4(rate: number): number {
  return Math.round(rate * 10000);
}

export function quotePayout({
  amountCents,
  methodType,
  feeBps,
  usdInrRate,
}: {
  amountCents: number;
  methodType: string;
  feeBps: number;
  usdInrRate: number;
}): PayoutQuote {
  const bps = Math.max(0, Math.min(MAX_FEE_BPS, Math.round(feeBps || 0)));
  const amount = Math.max(0, Math.round(amountCents));
  const feeCents = roundHalfUpDiv(amount * bps, 10000);
  const netCents = amount - feeCents;
  const currency = payoutCurrencyFor(methodType);
  if (currency === "INR") {
    const rate = usdInrRate > 0 ? usdInrRate : DEFAULT_USD_INR_RATE;
    return {
      feeBps: bps,
      feeCents,
      netCents,
      currency,
      usdInrRate: rate,
      netLocalMinor: roundHalfUpDiv(netCents * rateToE4(rate), 10000),
    };
  }
  return { feeBps: bps, feeCents, netCents, currency, usdInrRate: null, netLocalMinor: null };
}

/** 250 -> "2.5%", 1000 -> "10%", 0 -> "0%". */
export function formatFeePercent(feeBps: number): string {
  return `${formatFeePercentNumber(feeBps)}%`;
}

/** 250 -> "2.5" (for inputs). */
export function formatFeePercentNumber(feeBps: number): string {
  return String(Number(((feeBps || 0) / 100).toFixed(2)));
}

/** "2.5" -> 250. Null when not a number from 0 to 50 with at most 2 decimals. */
export function parseFeePercentToBps(input: string): number | null {
  const s = input.trim().replace(/%$/, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const bps = Math.round(Number(s) * 100);
  if (!Number.isFinite(bps) || bps < 0 || bps > MAX_FEE_BPS) return null;
  return bps;
}

/** "90.5" -> 90.5. Null when not a number from 1 to 500 with at most 4 decimals. */
export function parseUsdInrRate(input: string): number | null {
  const s = input.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(s)) return null;
  const rate = Number(s);
  if (!Number.isFinite(rate) || rate < MIN_USD_INR_RATE || rate > MAX_USD_INR_RATE) return null;
  return rate;
}

export function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function formatUsdInrRate(rate: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate);
}

/** The amount the user receives, in the currency it is paid in. */
export function formatQuoteReceive(quote: PayoutQuote): string {
  if (quote.currency === "INR" && quote.netLocalMinor !== null) {
    return formatInrFromPaise(quote.netLocalMinor);
  }
  return formatCurrencyFromCents(quote.netCents);
}

/** Text behind the (i) icon next to the processing fee. */
export function processingFeeExplainer(feeBps: number): string {
  return `A ${formatFeePercent(feeBps)} fee is deducted from each withdrawal to cover payment processing, transfers and platform costs. No other charges from us.`;
}

export const SKYDO_CONVERSION_NOTE =
  "Converted to INR at approximately the market rate on the day you receive the funds.";

/** Settings creators and brands see, from GET /api/payout-method-settings. */
export interface PayoutFeeSettings {
  pausedMethodTypes: string[];
  feeBpsByMethod: Record<string, number>;
  usdInrRate: number;
}

export const DEFAULT_PAYOUT_FEE_SETTINGS: PayoutFeeSettings = {
  pausedMethodTypes: [],
  feeBpsByMethod: {},
  usdInrRate: DEFAULT_USD_INR_RATE,
};

export function parsePayoutFeeSettings(json: unknown): PayoutFeeSettings {
  const j = (json ?? {}) as {
    pausedMethodTypes?: unknown;
    methods?: unknown;
    usdInrRate?: unknown;
  };
  const paused = Array.isArray(j.pausedMethodTypes)
    ? j.pausedMethodTypes.filter((t): t is string => typeof t === "string")
    : [];
  const feeBpsByMethod: Record<string, number> = {};
  if (Array.isArray(j.methods)) {
    for (const m of j.methods as { method_type?: unknown; fee_bps?: unknown }[]) {
      const bps = Number(m?.fee_bps);
      if (typeof m?.method_type === "string" && Number.isFinite(bps)) {
        feeBpsByMethod[m.method_type] = bps;
      }
    }
  }
  const rate = Number(j.usdInrRate);
  return {
    pausedMethodTypes: paused,
    feeBpsByMethod,
    usdInrRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_INR_RATE,
  };
}

/**
 * What a stored withdrawal pays out. Requests made before fees existed have
 * no payout_currency and pay the full amount in USD.
 */
export function withdrawalPayout(row: {
  amount?: unknown;
  fee_bps?: unknown;
  fee_cents?: unknown;
  net_amount_cents?: unknown;
  payout_currency?: unknown;
  fx_rate_snapshot?: unknown;
  net_amount_local_minor?: unknown;
}): {
  grossCents: number;
  feeBps: number;
  feeCents: number;
  netCents: number;
  currency: PayoutCurrency;
  usdInrRate: number | null;
  netLocalMinor: number | null;
  receiveLabel: string;
} {
  const num = (v: unknown) => {
    const n = Number(v);
    return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? n : null;
  };
  const grossCents = num(row.amount) ?? 0;
  const feeCents = num(row.fee_cents) ?? 0;
  const netCents = num(row.net_amount_cents) ?? grossCents - feeCents;
  const netLocalMinor = num(row.net_amount_local_minor);
  const currency: PayoutCurrency =
    row.payout_currency === "INR" && netLocalMinor !== null ? "INR" : "USD";
  return {
    grossCents,
    feeBps: num(row.fee_bps) ?? 0,
    feeCents,
    netCents,
    currency,
    usdInrRate: currency === "INR" ? num(row.fx_rate_snapshot) : null,
    netLocalMinor: currency === "INR" ? netLocalMinor : null,
    receiveLabel:
      currency === "INR" && netLocalMinor !== null
        ? formatInrFromPaise(netLocalMinor)
        : formatCurrencyFromCents(netCents),
  };
}
