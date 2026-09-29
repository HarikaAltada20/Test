/**
 * Default rolling window (in days) for YouTube Analytics queries.
 * Used by cron, refresh-detailed-analytics API, and admin UI.
 * Change this value to adjust how far back analytics are pulled (e.g. 60 = last 2 months).
 */
export const YT_ANALYTICS_DEFAULT_WINDOW_DAYS = 60;

/** Top countries (by view %) to fetch city breakdown for. */
export const YT_GEO_TOP_COUNTRIES_FOR_CITIES = 3;

/** Max cities per country query. */
export const YT_GEO_MAX_CITIES_PER_COUNTRY = 20;

/** Audience tab: compact geography rows (countries, cities, states). */
export const YT_AUDIENCE_GEO_PREVIEW_LIMIT = 5;

/** Audience tab: expanded geography rows. */
export const YT_AUDIENCE_GEO_DETAIL_LIMIT = 20;

/** Max traffic-source detail rows per source type. */
export const YT_TRAFFIC_DETAIL_MAX_RESULTS = 10;

/** Traffic source types to fetch detail for. */
export const YT_TRAFFIC_DETAIL_SOURCES = ["YT_SEARCH", "EXT_URL"] as const;
