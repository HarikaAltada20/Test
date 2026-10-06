/** Accepts "12", "12.", "12.5", "12.50", ".5"; at most two decimals. */
const AMOUNT_PATTERN = /^(\d+\.?\d{0,2}|\.\d{1,2})$/;

/** Keeps only what the amount field may contain while typing. */
export function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

/** Dollars string to cents, using the same rounding as before (Math.round(dollars * 100)). */
export function parseAmountToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return null;
  const dollars = parseFloat(trimmed);
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

/** Cents to an editable dollars string, e.g. 3778 -> "37.78". */
export function centsToAmountInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export interface WithdrawAmountLimits {
  minCents: number;
  availableCents: number;
  /** Formatted minimum, e.g. "$5.00". */
  minLabel: string;
}

export function validateWithdrawAmount(
  value: string,
  limits: WithdrawAmountLimits
): { cents: number; error: null } | { cents: null; error: string } {
  const cents = parseAmountToCents(value);
  if (cents === null || cents <= 0) {
    return { cents: null, error: "Enter a valid withdrawal amount." };
  }
  if (cents < limits.minCents) {
    return { cents: null, error: `Minimum cash withdrawal amount is ${limits.minLabel}.` };
  }
  if (cents > limits.availableCents) {
    return { cents: null, error: "Insufficient cash balance." };
  }
  return { cents, error: null };
}
