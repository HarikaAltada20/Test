// ============================================================================
// METRICS REFRESH CONSTANTS
// ============================================================================

/**
 * Cooldown periods for metrics refresh functionality
 * Different cooldowns for different user types to balance UX and security
 */
export const METRICS_REFRESH_COOLDOWN_MINUTES_OPPORTUNITIES = 60; // For creators viewing opportunities
export const METRICS_REFRESH_COOLDOWN_MINUTES_OWNER = 3; // For brands/advertisers and admins

/**
 * Cooldown period in milliseconds (derived from minutes)
 * Used by client-side components for timing calculations
 */
export const METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES = METRICS_REFRESH_COOLDOWN_MINUTES_OPPORTUNITIES * 60 * 1000;
export const METRICS_REFRESH_COOLDOWN_MS_OWNER = METRICS_REFRESH_COOLDOWN_MINUTES_OWNER * 60 * 1000;

/**
 * Helper function to get remaining cooldown time for opportunities (creators)
 * @param lastUpdateTimestamp - The last_metrics_updated timestamp
 * @returns Object with canRefresh boolean and remainingMs number
 */
export function getMetricsRefreshCooldownInfoOpportunities(lastUpdateTimestamp: string | null | undefined) {
  if (!lastUpdateTimestamp) {
    return { canRefresh: true, remainingMs: 0, remainingMinutes: 0 };
  }

  const lastUpdate = new Date(lastUpdateTimestamp);
  const now = new Date();
  const timeSinceUpdate = now.getTime() - lastUpdate.getTime();
  
  const canRefresh = timeSinceUpdate >= METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES;
  const remainingMs = Math.max(0, METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES - timeSinceUpdate);
  const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);

  return { canRefresh, remainingMs, remainingMinutes };
}

/**
 * Helper function to get remaining cooldown time for owners (brands/admins)
 * @param lastUpdateTimestamp - The last_metrics_updated timestamp
 * @returns Object with canRefresh boolean and remainingMs number
 */
export function getMetricsRefreshCooldownInfoOwner(lastUpdateTimestamp: string | null | undefined) {
  if (!lastUpdateTimestamp) {
    return { canRefresh: true, remainingMs: 0, remainingMinutes: 0 };
  }

  const lastUpdate = new Date(lastUpdateTimestamp);
  const now = new Date();
  const timeSinceUpdate = now.getTime() - lastUpdate.getTime();
  
  const canRefresh = timeSinceUpdate >= METRICS_REFRESH_COOLDOWN_MS_OWNER;
  const remainingMs = Math.max(0, METRICS_REFRESH_COOLDOWN_MS_OWNER - timeSinceUpdate);
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

/**
 * Backward compatibility function - redirects to opportunities cooldown
 * @deprecated Use getMetricsRefreshCooldownInfoOpportunities or getMetricsRefreshCooldownInfoOwner instead
 */
export function getMetricsRefreshCooldownInfo(lastUpdateTimestamp: string | null | undefined) {
  console.warn('getMetricsRefreshCooldownInfo is deprecated. Use getMetricsRefreshCooldownInfoOpportunities or getMetricsRefreshCooldownInfoOwner instead.');
  return getMetricsRefreshCooldownInfoOpportunities(lastUpdateTimestamp);
}

// Taglines for home page hero section (rotating below main heading)
export const HERO_TAGLINES = [
  "The World's First Platform to Democratize Brand Deals",
  "World's First Viral Creator Marketing Platform"
];

// export const HERO_TAGLINES = [
//   "Where Creative Talent Meets Real Opportunities",
//   "Test Content at Scale, Own What Works", 
//   "Where Creative Contests Create Success Stories"
// ];

// Animation timing for tagline rotation (in milliseconds)
export const TAGLINE_ROTATION_INTERVAL = 6000; // 6 seconds 