// ============================================================================
// METRICS REFRESH CONSTANTS
// ============================================================================

/**
 * Cooldown period for metrics refresh functionality
 * This value is used across the entire application for consistent behavior
 */
export const METRICS_REFRESH_COOLDOWN_MINUTES = 60; // Can be easily changed (60, 30, 90, etc.)

/**
 * Cooldown period in milliseconds (derived from minutes)
 * Used by client-side components for timing calculations
 */
export const METRICS_REFRESH_COOLDOWN_MS = METRICS_REFRESH_COOLDOWN_MINUTES * 60 * 1000;

/**
 * Helper function to get remaining cooldown time
 * @param lastUpdateTimestamp - The last_metrics_updated timestamp
 * @returns Object with canRefresh boolean and remainingMs number
 */
export function getMetricsRefreshCooldownInfo(lastUpdateTimestamp: string | null | undefined) {
  if (!lastUpdateTimestamp) {
    return { canRefresh: true, remainingMs: 0, remainingMinutes: 0 };
  }

  const lastUpdate = new Date(lastUpdateTimestamp);
  const now = new Date();
  const timeSinceUpdate = now.getTime() - lastUpdate.getTime();
  
  const canRefresh = timeSinceUpdate >= METRICS_REFRESH_COOLDOWN_MS;
  const remainingMs = Math.max(0, METRICS_REFRESH_COOLDOWN_MS - timeSinceUpdate);
  const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);

  return { canRefresh, remainingMs, remainingMinutes };
}

/**
 * Helper function to format remaining time for display
 * @param remainingMs - Remaining milliseconds
 * @returns Formatted string like "45 minutes" or "2 hours"
 */
export function formatRemainingTime(remainingMs: number): string {
  if (remainingMs <= 0) return "Available now";
  
  const minutes = Math.ceil(remainingMs / (60 * 1000));
  
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      return `${hours}h ${remainingMinutes}m`;
    }
  }
} 