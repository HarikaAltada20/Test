
/**
 * Formats a cents amount as currency 
 * @param cents - Amount in cents (e.g., 1000 = $10.00)
 * @returns Formatted currency string
 */
export function formatCurrencyFromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return '$0.00';
  }
  
  // Convert cents to dollars for display
  const dollars = cents / 100;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}



/**
 * Converts dollars to cents
 * @param dollars - Amount in dollars
 * @returns Amount in cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Converts cents to dollars
 * @param cents - Amount in cents
 * @returns Amount in dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Validates if an amount is a valid monetary value
 * @param amount - Amount to validate
 * @returns True if valid monetary amount
 */
export function isValidAmount(amount: number): boolean {
  return !isNaN(amount) && isFinite(amount) && amount >= 0;
}

/**
 * Rounds an amount to 2 decimal places (for monetary values)
 * @param amount - Amount to round
 * @returns Rounded amount
 */
export function roundToTwoDecimals(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Formats error messages that contain amounts in cents to display as dollars
 * @param errorMessage - Error message that may contain amounts in cents
 * @returns Formatted error message with dollar amounts
 */
export function formatErrorWithCurrency(errorMessage: string): string {
  // Check if this is an "Insufficient cash balance" error
  const insufficientCashBalanceMatch = errorMessage.match(
    /Insufficient cash balance\. Requested: (\d+), Available: (\d+)/
  );
  
  if (insufficientCashBalanceMatch) {
    const requestedCents = parseInt(insufficientCashBalanceMatch[1], 10);
    const availableCents = parseInt(insufficientCashBalanceMatch[2], 10);
    
    return `Insufficient cash balance. Requested: ${formatCurrencyFromCents(requestedCents)}, Available: ${formatCurrencyFromCents(availableCents)}`;
  }
  
  // Return original message if no formatting needed
  return errorMessage;
}

/** Compact axis/count label: 1500 → 1.5K, 35000000 → 35M */
export function formatCompactCount(value: number): string {
  const n = Math.max(0, value);
  if (n >= 1_000_000_000) {
    const billions = n / 1_000_000_000;
    return billions >= 10
      ? `${Math.round(billions)}B`
      : `${billions.toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (n >= 1_000_000) {
    const millions = n / 1_000_000;
    return millions >= 10
      ? `${Math.round(millions)}M`
      : `${millions.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    const thousands = n / 1_000;
    return thousands >= 10
      ? `${Math.round(thousands)}K`
      : `${thousands.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return n.toLocaleString();
}