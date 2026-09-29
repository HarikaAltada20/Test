/**
 * Classify a Twitter campaign submission row for analytics aggregation.
 * Used so "reply / retweet / quote" campaign metrics count *posts* of that type,
 * not Twitter public-metrics fields (replies-to-tweet, etc.).
 */
export type TwitterSubmissionActionKind =
  | "reply"
  | "quote"
  | "retweet"
  | "post";

export function getTwitterSubmissionActionKind(sub: {
  other_stats?: Record<string, unknown> | null;
  tweet_type?: string | null;
}): TwitterSubmissionActionKind | null {
  const raw = String(
    sub.other_stats?.tweet_type ?? sub.tweet_type ?? "",
  )
    .toLowerCase()
    .trim();

  if (raw === "reply" || raw === "comment") return "reply";
  if (raw === "quote" || raw === "quote_repost") return "quote";
  if (raw === "retweet" || raw === "repost") return "retweet";
  if (raw === "tweet") return "post";
  if (raw === "") return null;
  return null;
}
