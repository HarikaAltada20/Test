import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a Date object or ISO string to local date and time strings
 * @param dateValue Date object or ISO string
 * @returns Object with formatted local date (YYYY-MM-DD) and time (HH:MM) strings
 */
export function toLocalDateTimeStrings(dateValue: Date | string | null): { dateString: string, timeString: string } {
  if (!dateValue) {
    return { dateString: '', timeString: '' };
  }
  
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  
  // Format date in local timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return {
    dateString: `${year}-${month}-${day}`,
    timeString: `${hours}:${minutes}`
  };
}

/**
 * Formats a UTC date to a human-readable string in the local timezone
 * @param dateValue Date object or ISO string
 * @param options Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date string in local timezone
 */
export function formatLocalDateTime(
  dateValue: Date | string | null,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }
): string {
  if (!dateValue) return '';
  
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

/**
 * Converts local date and time strings to UTC ISO string
 * @param dateString Local date string (YYYY-MM-DD)
 * @param timeString Local time string (HH:MM)
 * @returns ISO string in UTC timezone or null if invalid input
 */
export function toUTCISOString(dateString: string, timeString: string): string | null {
  if (!dateString || !timeString) return null;

  try {
    // Step 1: Create a Date object in local time
    const [year, month, day] = dateString.split('-').map(Number);
    const [hours, minutes] = timeString.split(':').map(Number);

    // Step 2: Create a new Date with local timezone parts
    const localDate = new Date(year, month - 1, day, hours, minutes, 0); 

    // Step 3: Return the ISO String (which is always in UTC)
    console.log("localDate", localDate);
    console.log("localDate.toISOString()", localDate.toISOString());
    return localDate.toISOString();
    
  } catch (error) {
    console.error('Error converting to UTC:', error);
    return null;
  }
}

export function formatMoney(cents: number, currencyCode: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(cents / 100);
}
