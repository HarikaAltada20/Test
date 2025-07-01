
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
