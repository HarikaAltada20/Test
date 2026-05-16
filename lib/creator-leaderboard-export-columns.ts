/** Column ids for creator-wise leaderboard export (labels match contest-detail table headers). */

export const CREATOR_EXPORT_BASE_COLUMN_IDS = [
  "rank",
  "creator_name",
  "creator_username",
  "total_submissions",
  "status_summary",
] as const;

export const CREATOR_EXPORT_TWITTER_COLUMN_IDS = [
  "total_points",
  "base_points",
  "manual_points",
  "likes",
  "replies",
  "retweets",
  "quote_reposts",
  "impressions",
  "creator_manual_points",
  "manual_points_reason",
] as const;

export const CREATOR_EXPORT_INSTAGRAM_ANALYTICS_COLUMN_ID =
  "instagram_insights" as const;

export const CREATOR_EXPORT_METRIC_COLUMN_IDS = [
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "reach",
  "interactions",
  "avg_watch_time",
  "total_watch_time",
  "total_engagement",
  "engagement_rate",
  "insights_status",
] as const;

/** Single reward columns (non–dual-rewards contests) */
export const CREATOR_EXPORT_SIMPLE_REWARD_COLUMN_IDS = [
  "expected_reward",
  "adjusted_reward",
  "reward_granted",
] as const;

/** Dual rewards — matches creator-wise table headers */
export const CREATOR_EXPORT_DUAL_REWARD_COLUMN_IDS = [
  "total_expected_reward",
  "expected_reward_cpm",
  "expected_reward_milestone",
  "total_adjusted_reward",
  "adjusted_reward_cpm",
  "adjusted_reward_milestone",
  "milestone",
  "total_reward_granted",
  "reward_granted_cpm",
  "reward_granted_milestone",
] as const;

export const CREATOR_EXPORT_OTHER_REWARD_COLUMN_IDS = [
  "bonus_expected",
  "bonus_granted",
  "first_submitted",
  "rejection_reason",
] as const;

/** Milestone / dual_rewards "most verified" creator bonus tracks */
export const CREATOR_EXPORT_MOST_VERIFIED_COLUMN_IDS = [
  "mv_views_bonus_expected",
  "mv_views_bonus_adjusted",
  "mv_views_bonus_granted",
  "mv_reels_bonus_expected",
  "mv_reels_bonus_adjusted",
  "mv_reels_bonus_granted",
] as const;

export type CreatorExportColumnId =
  | (typeof CREATOR_EXPORT_BASE_COLUMN_IDS)[number]
  | (typeof CREATOR_EXPORT_TWITTER_COLUMN_IDS)[number]
  | (typeof CREATOR_EXPORT_METRIC_COLUMN_IDS)[number]
  | (typeof CREATOR_EXPORT_SIMPLE_REWARD_COLUMN_IDS)[number]
  | (typeof CREATOR_EXPORT_DUAL_REWARD_COLUMN_IDS)[number]
  | (typeof CREATOR_EXPORT_OTHER_REWARD_COLUMN_IDS)[number]
  | (typeof CREATOR_EXPORT_MOST_VERIFIED_COLUMN_IDS)[number]
  | typeof CREATOR_EXPORT_INSTAGRAM_ANALYTICS_COLUMN_ID;

export const CREATOR_EXPORT_COLUMN_LABELS: Record<
  CreatorExportColumnId,
  string
> = {
  rank: "Rank",
  creator_name: "Creator",
  creator_username: "Username",
  total_submissions: "Total Submissions",
  status_summary: "Status",
  total_points: "Total Points",
  base_points: "Base Points",
  manual_points: "Manual Points",
  likes: "Likes",
  replies: "Replies",
  retweets: "Retweets",
  quote_reposts: "Quote Reposts",
  impressions: "Impressions",
  creator_manual_points: "Creator Manual Points Adjustment",
  manual_points_reason: "Manual Points Reason",
  views: "Views",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  reach: "Reach",
  interactions: "Interactions",
  avg_watch_time: "Avg Watch Time",
  total_watch_time: "Total Watch Time",
  total_engagement: "Total engagement",
  engagement_rate: "Engagement rate",
  insights_status: "Insights status",
  instagram_insights: "Instagram Insights",
  expected_reward: "Expected Reward",
  adjusted_reward: "Adjusted Reward",
  reward_granted: "Reward Granted",
  total_expected_reward: "Total Expected Reward",
  expected_reward_cpm: "Expected Reward (CPM)",
  expected_reward_milestone: "Expected Reward (Milestone)",
  total_adjusted_reward: "Total Adjusted Reward",
  adjusted_reward_cpm: "Adjusted Reward (CPM)",
  adjusted_reward_milestone: "Adjusted Reward (Milestone)",
  milestone: "Milestone",
  total_reward_granted: "Total Reward Granted",
  reward_granted_cpm: "Reward Granted (CPM)",
  reward_granted_milestone: "Reward Granted (Milestone)",
  bonus_expected: "Bonus Expected",
  bonus_granted: "Bonus Granted",
  mv_views_bonus_expected: "Most Verified Views (Bonus Expected)",
  mv_views_bonus_adjusted: "Most Verified Views (Adjusted Reward)",
  mv_views_bonus_granted: "Most Verified Views (Bonus Granted)",
  mv_reels_bonus_expected: "Most Verified Reels (Bonus Expected)",
  mv_reels_bonus_adjusted: "Most Verified Reels (Adjusted Reward)",
  mv_reels_bonus_granted: "Most Verified Reels (Bonus Granted)",
  first_submitted: "First Submitted",
  rejection_reason: "Rejection Reason",
};

export type CreatorExportColumnOption = {
  id: CreatorExportColumnId;
  label: string;
};

export type GetCreatorExportColumnsOptions = {
  platform: string;
  contestFormat?: string | null;
  contestType?: string | null;
  isTwitterTextImage: boolean;
  canSeeCore: boolean;
  isAdminView: boolean;
  showAdjustedReward: boolean;
  showDualPayoutAdjustedColumns: boolean;
  dualAdjustCpm: boolean;
  dualAdjustMilestone: boolean;
  showBonusColumns: boolean;
  showRewardColumns: boolean;
  isDualRewards: boolean;
  isMilestoneContest: boolean;
  showTwitterManualColumns: boolean;
  ytVisibleColumnIds: string[];
  showMostVerifiedViewsBonusColumns: boolean;
  showMostVerifiedReelsBonusColumns: boolean;
  showMvBonusAdjustedExpectedColumns: boolean;
  /** Matches creator-wise table: hidden for Instagram/YouTube unless rejected creators exist on other platforms. */
  showRejectionReasonColumn: boolean;
};

function ytCol(
  id: string,
  ytVisibleColumnIds: string[],
  platform: string,
): boolean {
  if (!platform.toLowerCase().includes("youtube")) return true;
  return ytVisibleColumnIds.includes(id);
}

function pushRewardCols(
  cols: CreatorExportColumnOption[],
  ids: CreatorExportColumnId[],
) {
  for (const id of ids) {
    cols.push({ id, label: CREATOR_EXPORT_COLUMN_LABELS[id] });
  }
}

export function getCreatorExportColumns(
  opts: GetCreatorExportColumnsOptions,
): CreatorExportColumnOption[] {
  const platform = opts.platform.toLowerCase();
  const cols: CreatorExportColumnOption[] =
    CREATOR_EXPORT_BASE_COLUMN_IDS.filter((id) => {
      if (
        id === "status_summary" &&
        platform.includes("youtube") &&
        !opts.ytVisibleColumnIds.includes("status")
      ) {
        return false;
      }
      return true;
    }).map((id) => ({
      id,
      label: CREATOR_EXPORT_COLUMN_LABELS[id],
    }));

  if (opts.isTwitterTextImage) {
    for (const id of CREATOR_EXPORT_TWITTER_COLUMN_IDS) {
      if (
        (id === "creator_manual_points" || id === "manual_points_reason") &&
        !opts.showTwitterManualColumns
      ) {
        continue;
      }
      cols.push({ id, label: CREATOR_EXPORT_COLUMN_LABELS[id] });
    }
  } else {
    const metricIds: CreatorExportColumnId[] = [
      "views",
      "likes",
      "comments",
    ];
    if (
      platform.includes("instagram") ||
      platform.includes("tiktok") ||
      (platform.includes("youtube") && opts.canSeeCore)
    ) {
      metricIds.push("shares");
    }
    if (platform.includes("instagram")) {
      metricIds.push(
        "saves",
        "reach",
        "interactions",
        "avg_watch_time",
        "total_watch_time",
      );
    }
    if (platform.includes("tiktok")) {
      metricIds.push("total_engagement", "engagement_rate");
    }
    if (
      opts.isAdminView &&
      (platform.includes("instagram") ||
        platform.includes("tiktok") ||
        platform.includes("youtube"))
    ) {
      metricIds.push("insights_status");
    }
    if (opts.isAdminView && platform.includes("instagram")) {
      metricIds.push(CREATOR_EXPORT_INSTAGRAM_ANALYTICS_COLUMN_ID);
    }

    for (const id of metricIds) {
      if (id === "views" && !ytCol("views", opts.ytVisibleColumnIds, platform))
        continue;
      if (id === "likes" && !ytCol("likes", opts.ytVisibleColumnIds, platform))
        continue;
      if (
        id === "comments" &&
        !ytCol("comments", opts.ytVisibleColumnIds, platform)
      )
        continue;
      if (id === "shares" && !ytCol("shares", opts.ytVisibleColumnIds, platform))
        continue;
      cols.push({ id, label: CREATOR_EXPORT_COLUMN_LABELS[id] });
    }
  }

  if (opts.showRewardColumns) {
    const showExpected = ytCol(
      "expected_reward",
      opts.ytVisibleColumnIds,
      platform,
    );
    const showGranted = ytCol(
      "reward_granted",
      opts.ytVisibleColumnIds,
      platform,
    );
    const showAdjusted = ytCol(
      "adjusted_reward",
      opts.ytVisibleColumnIds,
      platform,
    );

    if (opts.isDualRewards) {
      if (showExpected) {
        pushRewardCols(cols, [
          "total_expected_reward",
          "expected_reward_cpm",
          "expected_reward_milestone",
        ]);
      }
      if (opts.showDualPayoutAdjustedColumns && showAdjusted) {
        pushRewardCols(cols, ["total_adjusted_reward"]);
        if (opts.dualAdjustCpm) {
          pushRewardCols(cols, ["adjusted_reward_cpm"]);
        }
        if (opts.dualAdjustMilestone) {
          pushRewardCols(cols, ["adjusted_reward_milestone"]);
        }
      }
      if (opts.isDualRewards || opts.isMilestoneContest) {
        cols.push({ id: "milestone", label: CREATOR_EXPORT_COLUMN_LABELS.milestone });
      }
      if (showGranted) {
        pushRewardCols(cols, [
          "total_reward_granted",
          "reward_granted_cpm",
          "reward_granted_milestone",
        ]);
      }
    } else {
      if (showExpected) {
        pushRewardCols(cols, ["expected_reward"]);
        if (opts.showAdjustedReward && showAdjusted) {
          pushRewardCols(cols, ["adjusted_reward"]);
        }
        if (opts.isMilestoneContest) {
          cols.push({
            id: "milestone",
            label: CREATOR_EXPORT_COLUMN_LABELS.milestone,
          });
        }
      }
      if (showGranted) {
        pushRewardCols(cols, ["reward_granted"]);
      }
    }

    if (opts.showBonusColumns) {
      pushRewardCols(cols, ["bonus_expected", "bonus_granted"]);
    }
    if (opts.showMostVerifiedViewsBonusColumns) {
      pushRewardCols(cols, ["mv_views_bonus_expected"]);
      if (opts.showMvBonusAdjustedExpectedColumns) {
        pushRewardCols(cols, ["mv_views_bonus_adjusted"]);
      }
      pushRewardCols(cols, ["mv_views_bonus_granted"]);
    }
    if (opts.showMostVerifiedReelsBonusColumns) {
      pushRewardCols(cols, ["mv_reels_bonus_expected"]);
      if (opts.showMvBonusAdjustedExpectedColumns) {
        pushRewardCols(cols, ["mv_reels_bonus_adjusted"]);
      }
      pushRewardCols(cols, ["mv_reels_bonus_granted"]);
    }
    if (ytCol("submitted", opts.ytVisibleColumnIds, platform)) {
      pushRewardCols(cols, ["first_submitted"]);
    }
    if (opts.showRejectionReasonColumn) {
      pushRewardCols(cols, ["rejection_reason"]);
    }
  }

  return cols;
}

/** Default export selection = every column currently available for this view. */
export function getCreatorExportDefaultColumnIds(
  opts: GetCreatorExportColumnsOptions,
): string[] {
  return getCreatorExportColumns(opts).map((c) => c.id);
}
