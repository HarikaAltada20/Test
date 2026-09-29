import { rerankTwitterContestLeaderboard } from "@/lib/twitter/rerank-twitter-leaderboard";

export type SyncTwitterLeaderboardFromTweetsOptions = {
  /** Only aggregate tweets for this creator; upserts that row then reranks entire contest. */
  creatorIdFilter?: string;
  /**
   * Do not change refresh_count, last_refreshed_at, or next_refresh_available_at (DB-only
   * recompute after moderation — no metrics API refresh).
   */
  preserveRefreshMetadata?: boolean;
};

type AdminClient = { from: (t: string) => any };

/**
 * Rebuild twitter_campaign_leaderboard totals from twitter_campaign_tweets (no Twitter/RapidAPI).
 */
export async function syncTwitterLeaderboardFromTweets(
  contestId: string,
  supabaseAdmin: AdminClient,
  options: SyncTwitterLeaderboardFromTweetsOptions = {}
): Promise<void> {
  const { creatorIdFilter, preserveRefreshMetadata } = options;

  let regularTweetsQuery = supabaseAdmin
    .from("twitter_campaign_tweets")
    .select(
      "creator_id, likes, replies, retweets, quote_reposts, impressions, points, target_tweet_id, moderation_status, manual_points_adjustment, is_eligible, deleted_at"
    )
    .eq("contest_id", contestId)
    .neq("moderation_status", "rejected");

  if (creatorIdFilter) {
    regularTweetsQuery = regularTweetsQuery.eq("creator_id", creatorIdFilter);
  }

  const { data: regularTweets, error: regularTweetsError } =
    await regularTweetsQuery;

  if (regularTweetsError) {
    console.error(
      "[syncTwitterLeaderboardFromTweets] Error fetching tweets:",
      regularTweetsError
    );
    return;
  }

  const regularTweetRows =
    regularTweets?.filter((t: any) => !t.target_tweet_id) || [];
  const raidEngagementRows =
    regularTweets?.filter((t: any) => t.target_tweet_id) || [];

  if (regularTweetRows.length === 0 && raidEngagementRows.length === 0) {
    console.log(
      "[syncTwitterLeaderboardFromTweets] No tweets to aggregate for contest",
      contestId
    );
    return;
  }

  type Agg = {
    total_points: number;
    total_eligible_tweets: number;
    total_likes: number;
    total_replies: number;
    total_retweets: number;
    total_quote_reposts: number;
    total_impressions: number;
  };

  const aggByCreator = new Map<string, Agg>();
  const allTweets = [...regularTweetRows, ...raidEngagementRows];

  for (const row of allTweets as any[]) {
    const creatorId = row.creator_id as string;
    if (!creatorId) continue;
    if (row.deleted_at) continue;

    const moderationStatus = row.moderation_status || "pending";
    if (moderationStatus === "rejected") continue;

    const existing = aggByCreator.get(creatorId) || {
      total_points: 0,
      total_eligible_tweets: 0,
      total_likes: 0,
      total_replies: 0,
      total_retweets: 0,
      total_quote_reposts: 0,
      total_impressions: 0,
    };

    const basePoints = row.points || 0;
    const manualAdjustment = row.manual_points_adjustment || 0;
    existing.total_points += basePoints + manualAdjustment;

    if (row.is_eligible) {
      existing.total_eligible_tweets += 1;
    }
    existing.total_likes += row.likes || 0;
    existing.total_replies += row.replies || 0;
    existing.total_retweets += row.retweets || 0;
    existing.total_quote_reposts += row.quote_reposts || 0;
    existing.total_impressions += Number(row.impressions) || 0;

    aggByCreator.set(creatorId, existing);
  }

  let existingLeaderboardQuery = supabaseAdmin
    .from("twitter_campaign_leaderboard")
    .select("creator_id, manual_points_adjustment")
    .eq("contest_id", contestId);

  if (creatorIdFilter) {
    existingLeaderboardQuery = existingLeaderboardQuery.eq(
      "creator_id",
      creatorIdFilter
    );
  }

  const { data: existingLeaderboard } = await existingLeaderboardQuery;

  const leaderboardManualAdjustments = new Map<string, number>();
  if (existingLeaderboard) {
    existingLeaderboard.forEach((entry: any) => {
      leaderboardManualAdjustments.set(
        entry.creator_id,
        entry.manual_points_adjustment || 0
      );
    });
  }

  const leaderboardEntries = Array.from(aggByCreator.entries())
    .map(([creatorId, stats]) => {
      const leaderboardManualAdjustment =
        leaderboardManualAdjustments.get(creatorId) || 0;
      return {
        creatorId,
        ...stats,
        total_points: stats.total_points + leaderboardManualAdjustment,
      };
    })
    .sort((a, b) => b.total_points - a.total_points);

  const nowIso = new Date().toISOString();
  const cooldownMs = creatorIdFilter
    ? 2 * 60 * 60 * 1000
    : 60 * 60 * 1000;
  const nextRefreshIso = new Date(Date.now() + cooldownMs).toISOString();

  let existingLeaderboardForRefreshQuery = supabaseAdmin
    .from("twitter_campaign_leaderboard")
    .select(
      "creator_id, refresh_count, last_refreshed_at, next_refresh_available_at"
    )
    .eq("contest_id", contestId);

  if (creatorIdFilter) {
    existingLeaderboardForRefreshQuery =
      existingLeaderboardForRefreshQuery.eq("creator_id", creatorIdFilter);
  }

  const { data: existingLeaderboardMeta } =
    await existingLeaderboardForRefreshQuery;

  const refreshMetaByCreator = new Map<
    string,
    {
      refresh_count: number;
      last_refreshed_at: string | null;
      next_refresh_available_at: string | null;
    }
  >();
  if (existingLeaderboardMeta) {
    existingLeaderboardMeta.forEach((entry: any) => {
      refreshMetaByCreator.set(entry.creator_id, {
        refresh_count: entry.refresh_count ?? 0,
        last_refreshed_at: entry.last_refreshed_at ?? null,
        next_refresh_available_at: entry.next_refresh_available_at ?? null,
      });
    });
  }

  const refreshCountMap = new Map<string, number>();
  if (!preserveRefreshMetadata && existingLeaderboardMeta) {
    existingLeaderboardMeta.forEach((entry: any) => {
      refreshCountMap.set(entry.creator_id, (entry.refresh_count || 0) + 1);
    });
  }

  const upsertPayload = leaderboardEntries.map((entry, index) => {
    const leaderboardManualAdjustment =
      leaderboardManualAdjustments.get(entry.creatorId) || 0;

    const preserved = refreshMetaByCreator.get(entry.creatorId);

    let refresh_count: number;
    let last_refreshed_at: string | null | undefined;
    let next_refresh_available_at: string | null | undefined;

    if (preserveRefreshMetadata) {
      refresh_count = preserved?.refresh_count ?? 0;
      last_refreshed_at = preserved?.last_refreshed_at ?? null;
      next_refresh_available_at =
        preserved?.next_refresh_available_at ?? null;
    } else {
      refresh_count = refreshCountMap.get(entry.creatorId) ?? 1;
      last_refreshed_at = nowIso;
      next_refresh_available_at = nextRefreshIso;
    }

    return {
      contest_id: contestId,
      creator_id: entry.creatorId,
      total_points: entry.total_points,
      total_eligible_tweets: entry.total_eligible_tweets,
      total_likes: entry.total_likes,
      total_replies: entry.total_replies,
      total_retweets: entry.total_retweets,
      total_quote_reposts: entry.total_quote_reposts,
      total_impressions: entry.total_impressions,
      manual_points_adjustment: leaderboardManualAdjustment,
      current_rank: index + 1,
      last_refreshed_at,
      next_refresh_available_at,
      refresh_count,
    };
  });

  if (upsertPayload.length === 0) return;

  const { error: leaderboardUpsertError } = await supabaseAdmin
    .from("twitter_campaign_leaderboard")
    .upsert(upsertPayload, {
      onConflict: "contest_id,creator_id",
    });

  if (leaderboardUpsertError) {
    console.error(
      "[syncTwitterLeaderboardFromTweets] Error upserting leaderboard:",
      leaderboardUpsertError
    );
    return;
  }

  console.log(
    "[syncTwitterLeaderboardFromTweets] Leaderboard updated for contest",
    contestId,
    "entries:",
    upsertPayload.length
  );

  if (creatorIdFilter) {
    await rerankTwitterContestLeaderboard(contestId, supabaseAdmin);
  }
}
