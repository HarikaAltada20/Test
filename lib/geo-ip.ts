/**
 * Geo-IP utilities: types and server-side lookup.
 * Store result in users.geo_data column as { ip, geo_data: { ... } }.
 */

export interface GeoData {
  country: string;       // Full name: "United States"
  country_code: string;  // 2-letter: "US"
  state: string;
  city: string;
  lat: number;
  lon: number;
  processed_at: string; // ISO
}

/** Shape stored in users.geo_data column in Supabase */
export interface GeoDataColumn {
  ip: string;
  geo_data: GeoData;
}

/** Registration_info or login_history entry shape we persist */
export interface RegistrationInfoGeo {
  ip: string;
  geo_data: GeoData | null;
  /** @deprecated Use geo_data.country. Kept for backward compatibility when reading. */
  country?: string;
  /** @deprecated Use geo_data. Kept for backward compatibility. */
  ip_address?: string;
  [key: string]: unknown;
}

export interface LoginHistoryEntry {
  ip_address: string;
  timestamp: string;
  geo_data?: GeoData | null;
  [key: string]: unknown;
}

const LOCALHOST_IPS = new Set(["::1", "127.0.0.1", "0.0.0.0"]);

function isLocalIp(ip: string | null): boolean {
  return !ip || LOCALHOST_IPS.has(ip);
}

/** Resolve 2-letter country code to full name (ipinfo often returns only code). */
function countryCodeToName(code: string): string {
  if (!code || code.length !== 2) return "";
  try {
    const countries = require("i18n-iso-countries");
    countries.registerLocale(require("i18n-iso-countries/langs/en.json"));
    return countries.getName(code, "en") || "";
  } catch {
    return "";
  }
}

/**
 * Fetch geo data for an IP using ip-api.com (free, 45 req/min).
 * Returns null for local IPs or on failure.
 */
export async function fetchGeoFromIp(ip: string | null): Promise<GeoData | null> {
  if (isLocalIp(ip)) return null;

  // ip-api.com: country = full name, countryCode = 2-letter
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip!)}?fields=status,message,country,countryCode,regionName,city,lat,lon`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "success") return null;
    const processed_at = new Date().toISOString();
    const country_code = String(data.countryCode ?? "").toUpperCase().slice(0, 2);
    const country = (data.country ?? "").trim() || countryCodeToName(country_code) || country_code;
    return {
      country,
      country_code,
      state: data.regionName ?? "",
      city: data.city ?? "",
      lat: typeof data.lat === "number" ? data.lat : 0,
      lon: typeof data.lon === "number" ? data.lon : 0,
      processed_at,
    };
  } catch {
    return null;
  }
}

/**
 * Fallback: ipinfo.io (free tier). Use when ip-api fails or for current-IP detection.
 * When ip is null, calls ipinfo.io/json to get current request's public IP geo.
 * Ensures country_code is 2-letter and country is full name.
 */
export async function fetchGeoFromIpInfo(ip: string | null): Promise<GeoData | null> {
  if (ip !== null && isLocalIp(ip)) return null;
  try {
    const url = ip
      ? `https://ipinfo.io/${encodeURIComponent(ip)}/json`
      : "https://ipinfo.io/json";
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !data.country) return null;
    const [lat, lon] = (data.loc || "0,0").split(",").map(Number);
    const country_code = String(data.country).toUpperCase().slice(0, 2);
    const country = data.country_name?.trim() || countryCodeToName(country_code) || country_code;
    return {
      country,
      country_code,
      state: data.region ?? "",
      city: data.city ?? "",
      lat: Number.isFinite(lat) ? lat : 0,
      lon: Number.isFinite(lon) ? lon : 0,
      processed_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Get geo_data for an IP with one fallback. Use for registration and login enrichment.
 * When IP is local (127.0.0.1, ::1), tries ipinfo.io/json to get current-request geo so login still saves geo_data.
 */
export async function getGeoDataForIp(ip: string | null): Promise<GeoData | null> {
  const geo = await fetchGeoFromIp(ip);
  if (geo) return geo;
  const fallback = await fetchGeoFromIpInfo(ip);
  if (fallback) return fallback;
  // Local IP or API failed: try current-request geo (ipinfo.io/json uses request's public IP)
  if (isLocalIp(ip)) return fetchGeoFromIpInfo(null);
  return null;
}

/**
 * Build the object to store in users.geo_data column: { ip, geo_data: { country, country_code, ... } }.
 */
export function buildGeoDataColumn(
  ip: string | null,
  geo: GeoData | null
): GeoDataColumn | null {
  if (!geo || !ip) return null;
  return { ip, geo_data: geo };
}

/**
 * Normalize legacy registration_info to include geo_data and top-level country for backward compat.
 */
export function normalizeRegistrationInfo(
  raw: Record<string, unknown> | null | undefined
): RegistrationInfoGeo | null {
  if (!raw) return null;
  const ip = (raw.ip ?? raw.ip_address) as string | undefined;
  if (!ip) return { ...raw, ip: "", geo_data: null } as RegistrationInfoGeo;
  const geo = (raw.geo_data as GeoData | undefined) ?? null;
  const country = geo?.country ?? (raw.country as string | undefined);
  return {
    ...raw,
    ip,
    ip_address: ip,
    country: country ?? null,
    geo_data: geo,
  } as RegistrationInfoGeo;
}

/**
 * Extract display country from registration_info (geo_data.country or legacy country).
 */
export function getCountryFromRegistrationInfo(
  registrationInfo: Record<string, unknown> | null | undefined
): string | null {
  if (!registrationInfo) return null;
  const geo = registrationInfo.geo_data as GeoData | undefined;
  if (geo?.country) return geo.country;
  return (registrationInfo.country as string) ?? null;
}

/**
 * Extract display country from a user row (prefer users.geo_data column, then registration_info).
 * users.geo_data column can be { ip, geo_data: { country, ... } } or legacy { country, ... }.
 */
export function getCountryFromUser(row: {
  geo_data?: { ip?: string; geo_data?: { country?: string }; country?: string; [key: string]: unknown } | null;
  registration_info?: Record<string, unknown> | null;
} | null | undefined): string | null {
  const col = row?.geo_data;
  if (!col) return getCountryFromRegistrationInfo(row?.registration_info);
  const country = (col as { geo_data?: { country?: string } }).geo_data?.country ?? (col as { country?: string }).country;
  if (typeof country === "string" && country.trim()) return country;
  return getCountryFromRegistrationInfo(row?.registration_info);
}
