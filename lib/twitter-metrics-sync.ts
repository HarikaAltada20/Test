/**
 * Twitter Campaign Metrics Sync Utilities
 * Functions to sync contest configuration to twitter_campaign_metrics table
 */

import { extractTweetId } from "./twitter-utils";

/**
 * Sync contest Twitter campaign data to metrics table
 * Called on contest creation and edit
 */
export async function syncContestToMetrics(
  contestId: string,
  twitterCampaign: any,
  supabaseAdmin: any
): Promise<void> {
  const campaignType = twitterCampaign?.campaign_type || "awareness";
  const raidTarget = twitterCampaign?.raid_target;

  // Prepare base update data
  const metricsUpdate: any = {
    contest_id: contestId,
    campaign_type: campaignType,
    last_updated_at: new Date().toISOString(),
  };

  // If raid campaign, update target fields
  if (campaignType === "raid" && raidTarget) {
    const targetTweetId = raidTarget.link
      ? extractTweetId(raidTarget.link)
      : null;

    metricsUpdate.target_tweet_id = targetTweetId;
    metricsUpdate.target_tweet_url = raidTarget.link || null;

    // Update TARGETS (from contests JSONB → metrics table)
    const targetMetrics = raidTarget.metrics || {};
    metricsUpdate.target_likes =
      typeof targetMetrics.likes === "number"
        ? targetMetrics.likes
        : typeof targetMetrics.likes === "string"
          ? parseInt(targetMetrics.likes, 10)
          : null;
    metricsUpdate.target_comments =
      typeof targetMetrics.comments === "number"
        ? targetMetrics.comments
        : typeof targetMetrics.comments === "string"
          ? parseInt(targetMetrics.comments, 10)
          : null;
    metricsUpdate.target_retweets =
      typeof targetMetrics.retweets === "number"
        ? targetMetrics.retweets
        : typeof targetMetrics.retweets === "string"
          ? parseInt(targetMetrics.retweets, 10)
          : null;
    metricsUpdate.target_quote_reposts =
      typeof targetMetrics.quote_reposts === "number"
        ? targetMetrics.quote_reposts
        : typeof targetMetrics.quote_reposts === "string"
          ? parseInt(targetMetrics.quote_reposts, 10)
          : null;

    // Recalculate targets_reached if we have current metrics
    const { data: existingMetrics } = await supabaseAdmin
      .from("twitter_campaign_metrics")
      .select(
        "target_current_likes, target_current_comments, target_current_retweets, target_current_quote_reposts"
      )
      .eq("contest_id", contestId)
      .maybeSingle();

    if (existingMetrics) {
      const targetsReached =
        (metricsUpdate.target_likes === null ||
          metricsUpdate.target_likes === 0 ||
          (existingMetrics.target_current_likes || 0) >=
            metricsUpdate.target_likes) &&
        (metricsUpdate.target_comments === null ||
          metricsUpdate.target_comments === 0 ||
          (existingMetrics.target_current_comments || 0) >=
            metricsUpdate.target_comments) &&
        (metricsUpdate.target_retweets === null ||
          metricsUpdate.target_retweets === 0 ||
          (existingMetrics.target_current_retweets || 0) >=
            metricsUpdate.target_retweets) &&
        (metricsUpdate.target_quote_reposts === null ||
          metricsUpdate.target_quote_reposts === 0 ||
          (existingMetrics.target_current_quote_reposts || 0) >=
            metricsUpdate.target_quote_reposts);

      metricsUpdate.targets_reached = targetsReached;
    }
  } else {
    // If changed from raid to non-raid, clear raid-specific fields
    metricsUpdate.target_tweet_id = null;
    metricsUpdate.target_tweet_url = null;
    metricsUpdate.target_likes = null;
    metricsUpdate.target_comments = null;
    metricsUpdate.target_retweets = null;
    metricsUpdate.target_quote_reposts = null;
    // Don't clear current metrics - they might be useful for historical data
    // But reset targets_reached
    metricsUpdate.targets_reached = null;
  }

  // Upsert metrics row
  const { error: upsertError } = await supabaseAdmin
    .from("twitter_campaign_metrics")
    .upsert(metricsUpdate, {
      onConflict: "contest_id",
    });

  if (upsertError) {
    console.error(
      "[syncContestToMetrics] Error upserting metrics:",
      upsertError
    );
    throw new Error(`Failed to sync metrics: ${upsertError.message}`);
  }

  console.log(
    `[syncContestToMetrics] Successfully synced metrics for contest ${contestId}`
  );
}

