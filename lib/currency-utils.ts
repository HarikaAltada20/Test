/**
 * Currency utility functions for consistent money formatting throughout the application
 */

/**
 * Formats an amount in cents to a currency string with dollar sign and decimals
 * @param cents Amount in cents
 * @returns Formatted currency string (e.g. "$10.00")
 */
export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Converts a dollar amount to cents
 * @param dollars Amount in dollars
 * @returns Amount in cents (integer)
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
