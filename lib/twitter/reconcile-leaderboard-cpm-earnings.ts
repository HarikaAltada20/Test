/**
 * Set twitter_campaign_leaderboard.earnings to the sum of paid tweet earnings.
 * Prefer this over additive deltas so creator-wise "Reward Granted" cannot drift
 * above the per-tweet totals (e.g. double-count after mixed bulk + per-tweet pays).
 *
 * Uses RPC reconcile_twitter_leaderboard_cpm_earnings when available (works even
 * after payouts_processed). Falls back to a direct UPDATE for older DBs.
 */
type AdminClient = {
  from: (t: string) => any;
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

export async function reconcileTwitterLeaderboardCpmEarnings(
  contestId: string,
  creatorId: string,
  supabaseAdmin: AdminClient,
): Promise<{ ok: boolean; earningsCents: number; error?: string }> {
  const { data, error: rpcError } = await supabaseAdmin.rpc(
    "reconcile_twitter_leaderboard_cpm_earnings",
    {
      p_contest_id: contestId,
      p_creator_id: creatorId,
    },
  );

  if (!rpcError) {
    return {
      ok: true,
      earningsCents: Math.max(0, Number(data) || 0),
    };
  }

  const rpcMissing =
    /could not find the function|schema cache|does not exist/i.test(
      rpcError.message || "",
    );

  if (!rpcMissing) {
    return {
      ok: false,
      earningsCents: 0,
      error: rpcError.message,
    };
  }

  // Fallback for DBs that have not applied 20260724_reconcile_twitter_leaderboard_cpm_earnings.sql
  const { data: tweets, error: fetchError } = await supabaseAdmin
    .from("twitter_campaign_tweets")
    .select("earnings, moderation_status")
    .eq("contest_id", contestId)
    .eq("creator_id", creatorId)
    .eq("moderation_status", "paid");

  if (fetchError) {
    return {
      ok: false,
      earningsCents: 0,
      error: fetchError.message,
    };
  }

  const earningsCents = (tweets || []).reduce(
    (sum: number, row: { earnings?: number | null }) =>
      sum + Math.max(0, Number(row.earnings) || 0),
    0,
  );

  const { error: updateError } = await supabaseAdmin
    .from("twitter_campaign_leaderboard")
    .update({ earnings: earningsCents })
    .eq("contest_id", contestId)
    .eq("creator_id", creatorId);

  if (updateError) {
    return {
      ok: false,
      earningsCents,
      error: updateError.message,
    };
  }

  return { ok: true, earningsCents };
}
