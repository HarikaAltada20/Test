import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve creator region countries for opportunities list filtering. */
export async function getCreatorUserCountries(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const [{ data: creatorRow }, { data: userRow }] = await Promise.all([
    supabase
      .from("creator_profiles")
      .select("country")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("users").select("geo_data").eq("id", userId).maybeSingle(),
  ]);

  if (creatorRow?.country) {
    return [creatorRow.country];
  }

  if (userRow?.geo_data) {
    const geoDataColumn = userRow.geo_data as {
      geo_data?: { country?: string };
      country?: string;
    } | null;
    const country =
      geoDataColumn?.geo_data?.country || geoDataColumn?.country || null;
    if (country) return [country];
  }

  return [];
}
