/** Client-safe message for brand analytics API 500 responses. */
export function brandAnalyticsClientErrorMessage(
  error: unknown,
  fallback = "Internal server error",
): string {
  if (process.env.NODE_ENV === "development" && error instanceof Error) {
    return error.message;
  }
  return fallback;
}
