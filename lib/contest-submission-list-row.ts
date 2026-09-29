/**
 * Lightweight submission row for contest-detail table hydrate.
 * Only fields the table / filters / sort / bulk actions need.
 */

export type ContestSubmissionListRow = {
  id: string;
  created_at: string;
  content_link: string | null;
  status: string;
  views: number | null;
  earnings: number | null;
  other_stats: Record<string, unknown> | null;
  platform: string | null;
  video_id: string | null;
  video_thumbnail_url: string | null;
  video_title: string | null;
  creator_id: string | null;
  creator_display_name: string | null;
  creator_username: string | null;
  user_username: string | null;
  creator_avatar_url: string | null;
  paid?: boolean | null;
  paid_at?: string | null;
  bonus_paid?: boolean | null;
  bonus_paid_at?: string | null;
  bonus_amount?: number | null;
  milestone_bonus_paid?: unknown;
  dual_rewards_payout?: unknown;
  /** Rejection-only metadata for status column / modal (bulky payment JSON stripped). */
  metadata?: unknown;
  insights_status?: string | null;
  last_insights_update?: string | null;
  quality_score?: number | null;
  creator?: {
    id: string | null;
    username: string | null;
    profile_picture_url: string | null;
    full_name: string | null;
  };
  // Twitter list extras
  is_twitter_tweet?: boolean;
  tweet_id?: string;
  moderation_status?: string;
  manual_points_adjustment?: number;
  manual_points_reason?: string | null;
  is_eligible?: boolean;
  deleted_at?: string | null;
  excluded_by_submission_cap?: boolean;
};

/** Keep rejection metadata for the table; drop payment / other bulky blobs. */
export function slimListMetadata(metadata: unknown): unknown {
  if (metadata == null) return null;
  try {
    const parsed =
      typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    if (!parsed || typeof parsed !== "object") return null;
    const type = (parsed as { type?: unknown }).type;
    if (type !== "rejection") return null;
    const row = parsed as Record<string, unknown>;
    return {
      type: "rejection",
      reason: row.reason,
      additionalNotes: row.additionalNotes,
      timestamp: row.timestamp,
      updatedBy: row.updatedBy,
      legacy: row.legacy,
    };
  } catch {
    return null;
  }
}
