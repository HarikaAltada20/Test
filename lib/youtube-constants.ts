/**
 * Default rolling window (in days) for YouTube Analytics queries.
 * Used by cron, refresh-detailed-analytics API, and admin UI.
 * Change this value to adjust how far back analytics are pulled (e.g. 60 = last 2 months).
 */
export const YT_ANALYTICS_DEFAULT_WINDOW_DAYS = 60;
