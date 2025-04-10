/**
 * Server-compatible date formatting utilities
 */

/**
 * Formats a UTC date to a human-readable string
 * @param dateValue Date object or ISO string
 * @param format Format options: 'short', 'medium', 'long'
 * @returns Formatted date string
 */
export function formatDate(dateValue: Date | string | null, format: 'short' | 'medium' | 'long' = 'medium'): string {
  if (!dateValue) return '';
  
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  
  // Format options based on the requested format
  if (format === 'short') {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  } else if (format === 'long') {
    return `${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  // Default medium format
  return `${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
}

/**
 * Formats a date range between start and end dates
 * @param startDate Start date (ISO string or Date object)
 * @param endDate End date (ISO string or Date object)
 * @param format Format style
 * @returns Formatted date range string
 */
export function formatDateRange(
  startDate: Date | string | null,
  endDate: Date | string | null,
  format: 'short' | 'medium' | 'long' = 'medium'
): string {
  if (!startDate && !endDate) return 'Not specified';
  
  const start = startDate ? formatDate(startDate, format) : 'Not set';
  const end = endDate ? formatDate(endDate, format) : 'Not set';
  
  return `${start} - ${end}`;
}

/**
 * Calculate duration between dates in days
 * @param startDate Start date (ISO string or Date object)
 * @param endDate End date (ISO string or Date object)
 * @returns Duration in days
 */
export function calculateDurationDays(startDate: Date | string | null, endDate: Date | string | null): number | null {
  if (!startDate || !endDate) return null;
  
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  const durationMs = end.getTime() - start.getTime();
  return Math.ceil(durationMs / (1000 * 60 * 60 * 24));
} 