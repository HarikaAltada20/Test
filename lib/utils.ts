import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a Date object or ISO string to local date and time strings
 * @param dateValue Date object or ISO string
 * @returns Object with formatted local date (YYYY-MM-DD) and time (HH:MM) strings
 */
export function toLocalDateTimeStrings(dateValue: Date | string | null): {
  dateString: string;
  timeString: string;
} {
  if (!dateValue) {
    return { dateString: "", timeString: "" };
  }

  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;

  // Format date in local timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return {
    dateString: `${year}-${month}-${day}`,
    timeString: `${hours}:${minutes}`,
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
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }
): string {
  if (!dateValue) return "";

  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

/**
 * Converts local date and time strings to UTC ISO string
 * @param dateString Local date string (YYYY-MM-DD)
 * @param timeString Local time string (HH:MM)
 * @returns ISO string in UTC timezone or null if invalid input
 */
export function toUTCISOString(
  dateString: string,
  timeString: string
): string | null {
  if (!dateString || !timeString) return null;

  try {
    // Step 1: Create a Date object in local time
    const [year, month, day] = dateString.split("-").map(Number);
    const [hours, minutes] = timeString.split(":").map(Number);

    // Step 2: Create a new Date with local timezone parts
    const localDate = new Date(year, month - 1, day, hours, minutes, 0);

    // Step 3: Return the ISO String (which is always in UTC)
    console.log("localDate", localDate);
    console.log("localDate.toISOString()", localDate.toISOString());
    return localDate.toISOString();
  } catch (error) {
    console.error("Error converting to UTC:", error);
    return null;
  }
}

/**
 * Formats a timestamp to a human-readable "time ago" string
 * @param timestamp ISO string or null
 * @returns Formatted string like "2m ago", "3h ago", or date string
 */
export function formatTimeAgo(timestamp: string | null): string {
  if (!timestamp) return "never";
  const now = new Date();
  const past = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);

  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return past.toLocaleDateString();
}

/**
 * Validates if a file is a valid image
 * @param file - The file to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateImageFile(file: File): {
  isValid: boolean;
  error?: string;
} {
  // Check if file exists
  if (!file) {
    return { isValid: false, error: "No file selected" };
  }

  // Check MIME type
  const validMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/jfif",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/tiff",
    "image/svg+xml",
  ];

  if (!validMimeTypes.includes(file.type)) {
    return {
      isValid: false,
      error:
        "Invalid file type. Please upload an image file (JPEG, JFIF, PNG, GIF, WebP, BMP, TIFF, or SVG)",
    };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  const validExtensions = [
    ".jpg",
    ".jpeg",
    ".jfif",
    ".png",
    ".gif",
    ".webp",
    ".avif",
    ".bmp",
    ".tiff",
    ".svg",
  ];
  const hasValidExtension = validExtensions.some((ext) =>
    fileName.endsWith(ext)
  );

  if (!hasValidExtension) {
    return {
      isValid: false,
      error:
        "Invalid file extension. Please upload an image file with a valid extension",
    };
  }

  return { isValid: true };
}

/**
 * Determines if a contest is in a final state where refreshes should be disabled
 */
export function isContestEnded(status?: string | null): boolean {
  const normalized = status?.toLowerCase();
  return normalized === "ended" || normalized === "completed";
}
