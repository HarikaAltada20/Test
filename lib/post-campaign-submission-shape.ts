/** Shared types/helpers for post-campaign submission snapshots (client + server safe). */

export type PostCampaignSubmissionSnapshot = {
  submission_id: string;
  contest_id: string;
  creator_id: string;
  content_link: string | null;
  views: number | null;
  metadata: Record<string, any> | null;
  other_stats: Record<string, any> | null;
  created_at: string | null;
  video_id: string | null;
  video_title: string | null;
  video_thumbnail_url: string | null;
  platform: string | null;
  last_insights_update: string | null;
  insights_status: string | null;
  status: string | null;
  earnings: number | null;
  views_locked: number | null;
  affiliate_paid: boolean | null;
  affiliate_metadata: Record<string, any> | null;
  paid: boolean | null;
  paid_at: string | null;
  bonus_paid: boolean | null;
  bonus_paid_at: string | null;
  bonus_amount: number | null;
  milestone_bonus_paid: Record<string, any> | null;
  dual_rewards_payout: Record<string, any> | null;
  quality_score: number | null;
  quality_score_backfilled: boolean | null;
  submission_updated_at: string | null;
  synced_at?: string;
  updated_at?: string;
};

/** Map snapshot row onto a submission-shaped object for leaderboard UI. */
export function postCampaignSnapshotToSubmission<
  T extends object = Record<string, any>,
>(row: PostCampaignSubmissionSnapshot, base?: T): T {
  const snapshot = {
    id: row.submission_id,
    contest_id: row.contest_id,
    creator_id: row.creator_id,
    content_link: row.content_link,
    views: row.views ?? 0,
    metadata: row.metadata ?? null,
    other_stats: row.other_stats ?? null,
    created_at: row.created_at,
    video_id: row.video_id,
    video_title: row.video_title,
    video_thumbnail_url: row.video_thumbnail_url,
    platform: row.platform,
    last_insights_update: row.last_insights_update,
    insights_status: row.insights_status,
    status: row.status,
    earnings: row.earnings,
    views_locked: row.views_locked,
    affiliate_paid: row.affiliate_paid,
    affiliate_metadata: row.affiliate_metadata,
    paid: row.paid,
    paid_at: row.paid_at,
    bonus_paid: row.bonus_paid,
    bonus_paid_at: row.bonus_paid_at,
    bonus_amount: row.bonus_amount,
    milestone_bonus_paid: row.milestone_bonus_paid,
    dual_rewards_payout: row.dual_rewards_payout,
    quality_score: row.quality_score,
    quality_score_backfilled: row.quality_score_backfilled,
    updated_at: row.submission_updated_at,
  };
  return { ...(base ?? ({} as T)), ...snapshot } as T;
}
