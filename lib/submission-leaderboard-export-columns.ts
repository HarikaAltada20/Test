/** Column ids for submissions leaderboard export (Normal view). */

export const SUBMISSION_EXPORT_BASE_COLUMN_IDS = [
  "rank",
  "creator_name",
  "creator_username",
  "content_link",
  "video_title",
] as const;

export const SUBMISSION_EXPORT_TWITTER_COLUMN_IDS = [
  "tweet_excerpt",
  "total_points",
  "base_points",
  "manual_points",
  "manual_points_reason",
  "likes",
  "replies",
  "retweets",
  "quote_reposts",
  "impressions",
] as const;

export const SUBMISSION_EXPORT_YOUTUBE_COLUMN_IDS = [
  "views",
  "likes",
  "comments",
  "dislikes",
  "shares",
  "avg_view_pct",
  "watch_time",
  "avg_duration",
  "engaged_views",
  "subs_gained",
  "bot_score",
  "top_traffic_source",
  "insights_status",
] as const;

/** Popover summary when table column "Analytics" is visible (YouTube). */
export const SUBMISSION_EXPORT_YOUTUBE_ANALYTICS_COLUMN_ID =
  "youtube_analytics" as const;

export const SUBMISSION_EXPORT_INSTAGRAM_ANALYTICS_COLUMN_ID =
  "instagram_insights" as const;

export const SUBMISSION_EXPORT_INSTAGRAM_COLUMN_IDS = [
  "views",
  "likes",
  "comments",
  "shares",
  "saves",
  "reach",
  "interactions",
  "avg_watch_time",
  "total_watch_time",
  "insights_status",
] as const;

export const SUBMISSION_EXPORT_TIKTOK_COLUMN_IDS = [
  "views",
  "likes",
  "comments",
  "shares",
  "total_interactions",
  "engagement_rate",
  "insights_status",
] as const;

export const SUBMISSION_EXPORT_SIMPLE_REWARD_COLUMN_IDS = [
  "expected_reward",
  "adjusted_reward",
  "reward_granted",
] as const;

export const SUBMISSION_EXPORT_DUAL_REWARD_COLUMN_IDS = [
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

export const SUBMISSION_EXPORT_OTHER_REWARD_COLUMN_IDS = [
  "bonus_expected",
  "bonus_granted",
  "status",
  "submitted",
  "rejection_reason",
] as const;

export type SubmissionExportBaseColumnId =
  (typeof SUBMISSION_EXPORT_BASE_COLUMN_IDS)[number];
export type SubmissionExportYoutubeColumnId =
  (typeof SUBMISSION_EXPORT_YOUTUBE_COLUMN_IDS)[number];
export type SubmissionExportColumnId =
  | SubmissionExportBaseColumnId
  | (typeof SUBMISSION_EXPORT_TWITTER_COLUMN_IDS)[number]
  | (typeof SUBMISSION_EXPORT_YOUTUBE_COLUMN_IDS)[number]
  | typeof SUBMISSION_EXPORT_YOUTUBE_ANALYTICS_COLUMN_ID
  | (typeof SUBMISSION_EXPORT_INSTAGRAM_COLUMN_IDS)[number]
  | typeof SUBMISSION_EXPORT_INSTAGRAM_ANALYTICS_COLUMN_ID
  | (typeof SUBMISSION_EXPORT_TIKTOK_COLUMN_IDS)[number]
  | (typeof SUBMISSION_EXPORT_SIMPLE_REWARD_COLUMN_IDS)[number]
  | (typeof SUBMISSION_EXPORT_DUAL_REWARD_COLUMN_IDS)[number]
  | (typeof SUBMISSION_EXPORT_OTHER_REWARD_COLUMN_IDS)[number];

export const SUBMISSION_EXPORT_COLUMN_LABELS: Record<
  SubmissionExportColumnId,
  string
> = {
  rank: "Rank",
  creator_name: "Creator",
  creator_username: "Username",
  content_link: "Content URL",
  video_title: "Video / Post Title",
  tweet_excerpt: "Tweet",
  total_points: "Total Points",
  base_points: "Base Points",
  manual_points: "Manual Points",
  manual_points_reason: "Manual Points Reason",
  likes: "Likes",
  replies: "Replies",
  retweets: "Retweets",
  quote_reposts: "Quote Reposts",
  impressions: "Impressions",
  views: "Views",
  comments: "Comments",
  dislikes: "Dislikes",
  shares: "Shares",
  avg_view_pct: "Avg View %",
  watch_time: "Watch Time",
  avg_duration: "Avg Duration (s)",
  engaged_views: "Engaged Views",
  subs_gained: "Subs Gained",
  bot_score: "Bot Score",
  top_traffic_source: "Top Traffic Source",
  youtube_analytics: "Analytics",
  insights_status: "Insights Status",
  instagram_insights: "Instagram Insights",
  saves: "Saves",
  reach: "Reach",
  interactions: "Interactions",
  avg_watch_time: "Avg Watch Time",
  total_watch_time: "Total Watch Time",
  total_interactions: "Total Engagement",
  engagement_rate: "Engagement Rate",
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
  status: "Status",
  submitted: "Submitted",
  rejection_reason: "Rejection Reason",
};

const YT_CORE_IDS = new Set([
  "dislikes",
  "shares",
  "avg_view_pct",
  "watch_time",
  "avg_duration",
  "engaged_views",
  "subs_gained",
  "bot_score",
]);

const YT_TRAFFIC_IDS = new Set(["top_traffic_source"]);

export type SubmissionExportColumnOption = {
  id: SubmissionExportColumnId;
  label: string;
};

export type GetSubmissionExportColumnsOptions = {
  platform: string;
  contestFormat?: string | null;
  contestType?: string | null;
  isTwitterTextImage: boolean;
  canSeeCore: boolean;
  canSeeTraffic: boolean;
  canSeeDemographics: boolean;
  isAdminView: boolean;
  showAdjustedReward: boolean;
  showDualPayoutAdjustedColumns: boolean;
  dualAdjustCpm: boolean;
  dualAdjustMilestone: boolean;
  showBonusColumns: boolean;
  showRewardColumns: boolean;
  isDualRewards: boolean;
  isMilestoneContest: boolean;
  ytVisibleColumnIds?: string[];
};

export function getSubmissionExportColumns(
  opts: GetSubmissionExportColumnsOptions,
): SubmissionExportColumnOption[] {
  const platform = opts.platform.toLowerCase();
  const baseColumnIds = opts.isTwitterTextImage
    ? SUBMISSION_EXPORT_BASE_COLUMN_IDS.filter((id) => id !== "video_title")
    : SUBMISSION_EXPORT_BASE_COLUMN_IDS;
  const cols: SubmissionExportColumnOption[] = baseColumnIds.map((id) => ({
    id,
    label: SUBMISSION_EXPORT_COLUMN_LABELS[id],
  }));

  if (opts.isTwitterTextImage) {
    for (const id of SUBMISSION_EXPORT_TWITTER_COLUMN_IDS) {
      cols.push({ id, label: SUBMISSION_EXPORT_COLUMN_LABELS[id] });
    }
  } else if (platform.includes("instagram")) {
    for (const id of SUBMISSION_EXPORT_INSTAGRAM_COLUMN_IDS) {
      if (id === "insights_status" && !opts.isAdminView) continue;
      cols.push({ id, label: SUBMISSION_EXPORT_COLUMN_LABELS[id] });
    }
  } else if (platform.includes("tiktok")) {
    for (const id of SUBMISSION_EXPORT_TIKTOK_COLUMN_IDS) {
      if (id === "insights_status" && !opts.isAdminView) continue;
      cols.push({ id, label: SUBMISSION_EXPORT_COLUMN_LABELS[id] });
    }
  } else if (platform.includes("youtube")) {
    const ytIds = opts.ytVisibleColumnIds ?? [];
    const ytCol = (tableColId: string) =>
      ytIds.length === 0 || ytIds.includes(tableColId);

    const ytTableToExportId: Record<string, SubmissionExportColumnId> = {
      views: "views",
      likes: "likes",
      comments: "comments",
      dislikes: "dislikes",
      shares: "shares",
      avg_view_pct: "avg_view_pct",
      watch_time: "watch_time",
      avg_duration: "avg_duration",
      engaged_views: "engaged_views",
      subs_gained: "subs_gained",
      bot_score: "bot_score",
      top_traffic_source: "top_traffic_source",
      insights_status: "insights_status",
    };

    for (const [tableColId, exportId] of Object.entries(ytTableToExportId)) {
      if (!ytCol(tableColId)) continue;
      if (YT_CORE_IDS.has(exportId) && !opts.canSeeCore) continue;
      if (YT_TRAFFIC_IDS.has(exportId) && !opts.canSeeTraffic) continue;
      if (exportId === "insights_status" && !opts.isAdminView) continue;
      cols.push({ id: exportId, label: SUBMISSION_EXPORT_COLUMN_LABELS[exportId] });
    }

    if (ytCol("analytics")) {
      cols.push({
        id: SUBMISSION_EXPORT_YOUTUBE_ANALYTICS_COLUMN_ID,
        label: SUBMISSION_EXPORT_COLUMN_LABELS.youtube_analytics,
      });
    }
  } else {
    cols.push(
      { id: "views", label: SUBMISSION_EXPORT_COLUMN_LABELS.views },
      { id: "likes", label: SUBMISSION_EXPORT_COLUMN_LABELS.likes },
      { id: "comments", label: SUBMISSION_EXPORT_COLUMN_LABELS.comments },
    );
  }

  if (opts.showRewardColumns) {
    const ytIds = opts.ytVisibleColumnIds ?? [];
    const ytCol = (id: string) =>
      !platform.includes("youtube") || ytIds.includes(id);

    if (opts.isDualRewards) {
      if (ytCol("expected_reward")) {
        for (const id of [
          "total_expected_reward",
          "expected_reward_cpm",
          "expected_reward_milestone",
        ] as const) {
          cols.push({ id, label: SUBMISSION_EXPORT_COLUMN_LABELS[id] });
        }
      }
      if (
        opts.showDualPayoutAdjustedColumns &&
        ytCol("adjusted_reward")
      ) {
        cols.push({
          id: "total_adjusted_reward",
          label: SUBMISSION_EXPORT_COLUMN_LABELS.total_adjusted_reward,
        });
        if (opts.dualAdjustCpm) {
          cols.push({
            id: "adjusted_reward_cpm",
            label: SUBMISSION_EXPORT_COLUMN_LABELS.adjusted_reward_cpm,
          });
        }
        if (opts.dualAdjustMilestone) {
          cols.push({
            id: "adjusted_reward_milestone",
            label:
              SUBMISSION_EXPORT_COLUMN_LABELS.adjusted_reward_milestone,
          });
        }
      }
      if (opts.isDualRewards || opts.isMilestoneContest) {
        cols.push({
          id: "milestone",
          label: SUBMISSION_EXPORT_COLUMN_LABELS.milestone,
        });
      }
      if (ytCol("reward_granted")) {
        for (const id of [
          "total_reward_granted",
          "reward_granted_cpm",
          "reward_granted_milestone",
        ] as const) {
          cols.push({ id, label: SUBMISSION_EXPORT_COLUMN_LABELS[id] });
        }
      }
    } else {
      if (ytCol("expected_reward")) {
        cols.push({
          id: "expected_reward",
          label: SUBMISSION_EXPORT_COLUMN_LABELS.expected_reward,
        });
        if (opts.showAdjustedReward && ytCol("adjusted_reward")) {
          cols.push({
            id: "adjusted_reward",
            label: SUBMISSION_EXPORT_COLUMN_LABELS.adjusted_reward,
          });
        }
        if (opts.isMilestoneContest) {
          cols.push({
            id: "milestone",
            label: SUBMISSION_EXPORT_COLUMN_LABELS.milestone,
          });
        }
      }
      if (ytCol("reward_granted")) {
        cols.push({
          id: "reward_granted",
          label: SUBMISSION_EXPORT_COLUMN_LABELS.reward_granted,
        });
      }
    }

    if (opts.showBonusColumns) {
      for (const id of ["bonus_expected", "bonus_granted"] as const) {
        cols.push({ id, label: SUBMISSION_EXPORT_COLUMN_LABELS[id] });
      }
    }
    for (const id of ["status", "submitted", "rejection_reason"] as const) {
      if (id === "submitted" && platform.includes("youtube") && !ytCol("submitted"))
        continue;
      cols.push({ id, label: SUBMISSION_EXPORT_COLUMN_LABELS[id] });
    }
  }

  return cols;
}

export function getSubmissionExportDefaultColumnIds(
  opts: GetSubmissionExportColumnsOptions,
): string[] {
  return getSubmissionExportColumns(opts).map((c) => c.id);
}
