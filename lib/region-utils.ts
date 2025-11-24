import REGIONS_AND_COUNTRIES_DATA from "@/data/regions-and-countries.json";

type RegionsData = typeof REGIONS_AND_COUNTRIES_DATA;

/**
 * Check if a user's country matches any of the contest's allowed regions
 * @param userCountry - The user's country name (e.g., "United States")
 * @param contestRegion - The contest's region object (e.g., { "North America": ["United States", "Canada"] })
 * @returns true if the user's country is in any of the contest's regions, false otherwise
 */
export function isCountryInContestRegions(
  userCountry: string | null,
  contestRegion: Record<string, string[]> | null
): boolean {
  // If no user country, show all contests (fallback behavior)
  if (!userCountry) {
    return true;
  }

  // If contest has no region restrictions, show it to everyone
  if (!contestRegion || Object.keys(contestRegion).length === 0) {
    return true;
  }

  // Check if user's country is in any of the contest's regions
  for (const [regionName, countries] of Object.entries(contestRegion)) {
    if (Array.isArray(countries) && countries.includes(userCountry)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the region name for a given country
 * @param country - The country name
 * @returns The region name if found, null otherwise
 */
export function getRegionForCountry(country: string | null): string | null {
  if (!country) {
    return null;
  }

  for (const [regionName, countries] of Object.entries(
    REGIONS_AND_COUNTRIES_DATA
  )) {
    if (Array.isArray(countries) && countries.includes(country)) {
      return regionName;
    }
  }

  return null;
}

/**
 * Extract country and region name from user's region JSONB structure
 * @param regionJsonb - The user's region JSONB (e.g., { "North America": ["United States"] })
 * @returns Object with country and region name, or null values if not found
 */
export function extractCountryFromRegionJsonb(
  regionJsonb: Record<string, string[]> | null
): { country: string | null; region: string | null } {
  if (!regionJsonb || typeof regionJsonb !== "object") {
    return { country: null, region: null };
  }

  // Get the first (and should be only) region entry
  const entries = Object.entries(regionJsonb);
  if (entries.length === 0) {
    return { country: null, region: null };
  }

  const [regionName, countries] = entries[0];

  // Get the first country from the array
  const country =
    Array.isArray(countries) && countries.length > 0 ? countries[0] : null;

  return {
    country,
    region: regionName || null,
  };
}
