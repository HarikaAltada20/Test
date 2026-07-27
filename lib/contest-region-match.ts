/**
 * Mirrors public.contest_matches_user_countries after the empty-country fix.
 * Empty/null countries must not unlock geo-restricted contests.
 */
export function contestMatchesUserCountries(
  region: Record<string, string[]> | null | undefined,
  countries: string[] | null | undefined,
): boolean {
  if (region == null) return true;
  const keys = Object.keys(region);
  if (keys.length === 0) return true;
  if (!countries || countries.length === 0) return false;

  const allowed = new Set(countries);
  for (const list of Object.values(region)) {
    if (!Array.isArray(list)) continue;
    for (const country of list) {
      if (allowed.has(country)) return true;
    }
  }
  return false;
}
