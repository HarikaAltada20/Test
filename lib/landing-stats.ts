import type { SupabaseClient } from "@supabase/supabase-js";

/** DB aggregate when migration is applied; falls back to row scan for older DBs. */
export async function getTotalSubmissionViews(
  supabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await supabase.rpc("sum_submission_views");
  if (!error && data != null) return Number(data);
  const { data: submissions } = await supabase.from("submissions").select("views");
  return (
    submissions?.reduce(
      (sum, sub: { views: number | null }) => sum + (sub.views || 0),
      0,
    ) ?? 0
  );
}

export async function getTotalCreatorMoneyWonCents(
  supabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await supabase.rpc("sum_creator_total_money_won");
  if (!error && data != null) return Number(data);
  const { data: creatorProfiles } = await supabase
    .from("creator_profiles")
    .select("total_money_won");
  return (
    creatorProfiles?.reduce(
      (sum, p: { total_money_won: number | null }) =>
        sum + (p.total_money_won || 0),
      0,
    ) ?? 0
  );
}
