/**
 * Recompute current_rank for every row in twitter_campaign_leaderboard for a contest.
 * Use after a creator-only stats update so ranks reflect global ordering by total_points.
 */
export async function rerankTwitterContestLeaderboard(
  contestId: string,
  supabaseAdmin: {
    from: (t: string) => any;
  }
): Promise<void> {
  const { data: allEntries } = await supabaseAdmin
    .from("twitter_campaign_leaderboard")
    .select("creator_id, total_points")
    .eq("contest_id", contestId)
    .order("total_points", { ascending: false });

  if (!allEntries?.length) return;

  await Promise.all(
    allEntries.map((entry, index) =>
      supabaseAdmin
        .from("twitter_campaign_leaderboard")
        .update({ current_rank: index + 1 })
        .eq("contest_id", contestId)
        .eq("creator_id", entry.creator_id)
    )
  );
}
