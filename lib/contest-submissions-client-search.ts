/**
 * Client-side search over an already-loaded contest submissions dataset.
 * No network — filters in memory for creator / URL / platform / id fields.
 */

export type ContestSubmissionSearchable = {
  id?: string | null;
  content_link?: string | null;
  platform?: string | null;
  creator_id?: string | null;
  creator_display_name?: string | null;
  creator_username?: string | null;
  user_username?: string | null;
  video_title?: string | null;
  tweet_id?: string | null;
  creator?: {
    id?: string | null;
    username?: string | null;
    full_name?: string | null;
  } | null;
  other_stats?: {
    tweet_text?: string | null;
  } | null;
};

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function haystackForSubmission(row: ContestSubmissionSearchable): string {
  return [
    row.id,
    row.creator_id,
    row.creator?.id,
    row.creator_display_name,
    row.creator_username,
    row.user_username,
    row.creator?.username,
    row.creator?.full_name,
    row.content_link,
    row.platform,
    row.video_title,
    row.tweet_id,
    row.other_stats?.tweet_text,
  ]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join("\n")
    .toLowerCase();
}

/** True when `query` is empty or matches any searchable field on the row. */
export function submissionMatchesClientSearch(
  row: ContestSubmissionSearchable,
  query: string,
): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  return haystackForSubmission(row).includes(q);
}

export function filterSubmissionsByClientSearch<
  T extends ContestSubmissionSearchable,
>(rows: T[], query: string): T[] {
  const q = normalizeQuery(query);
  if (!q) return rows;
  return rows.filter((row) => haystackForSubmission(row).includes(q));
}
