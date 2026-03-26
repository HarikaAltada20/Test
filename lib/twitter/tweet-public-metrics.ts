/**
 * Normalize RapidAPI/Twitter-like tweet objects so engagement counts reflect the
 * creator's own tweet (the leaf / wrapper), not the embedded retweeted or quoted parent.
 *
 * Many providers duplicate the *parent* post's public metrics onto the outer retweet shell,
 * which makes "retweets" look like the original (e.g. target tweet with 342 RTs).
 */

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function parseImpressions(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") return parseInt(v, 10) || 0;
  return 0;
}

function metricsFromTweetNode(tweet: any): {
  likes: number;
  replies: number;
  retweets: number;
  quotes: number;
  impressions: number;
} {
  if (!tweet || typeof tweet !== "object") {
    return { likes: 0, replies: 0, retweets: 0, quotes: 0, impressions: 0 };
  }
  const leg = tweet.legacy;
  return {
    likes: num(
      tweet.favorites ??
        tweet.favorite_count ??
        tweet.likes ??
        tweet.like_count ??
        leg?.favorite_count ??
        tweet.public_metrics?.like_count
    ),
    replies: num(
      tweet.replies ??
        tweet.reply_count ??
        leg?.reply_count ??
        tweet.public_metrics?.reply_count
    ),
    retweets: num(
      tweet.retweets ??
        tweet.retweet_count ??
        leg?.retweet_count ??
        tweet.public_metrics?.retweet_count
    ),
    quotes: num(
      tweet.quotes ??
        tweet.quote_count ??
        leg?.quote_count ??
        tweet.public_metrics?.quote_count
    ),
    impressions: parseImpressions(
      tweet.views ??
        tweet.view_count ??
        tweet.impression_count ??
        leg?.views?.count ??
        tweet.public_metrics?.impression_count
    ),
  };
}

function metricsFromParentNode(parent: any) {
  return metricsFromTweetNode(parent);
}

/**
 * When outer public metrics exactly match the embedded retweeted tweet's metrics,
 * treat them as duplicated parent stats and zero them for the retweet wrapper.
 */
function stripDuplicateParentMetrics(
  outer: ReturnType<typeof metricsFromTweetNode>,
  parent: ReturnType<typeof metricsFromTweetNode>
): typeof outer {
  const next = { ...outer };
  if (parent.retweets > 0 && outer.retweets === parent.retweets) {
    next.retweets = 0;
  }
  if (parent.likes > 0 && outer.likes === parent.likes) {
    next.likes = 0;
  }
  if (parent.replies > 0 && outer.replies === parent.replies) {
    next.replies = 0;
  }
  if (parent.impressions > 0 && outer.impressions === parent.impressions) {
    next.impressions = 0;
  }
  if (parent.quotes > 0 && outer.quotes === parent.quotes) {
    next.quotes = 0;
  }
  return next;
}

export function getTweetLeafPublicMetrics(tweet: any): {
  likes: number;
  replies: number;
  retweets: number;
  quotes: number;
  impressions: number;
} {
  const retweeted =
    tweet?.retweeted_tweet || tweet?.retweeted_status || tweet?.retweeted;
  const quoted =
    tweet?.quoted || tweet?.quoted_tweet || tweet?.quoted_status;

  const outer = metricsFromTweetNode(tweet);

  if (retweeted) {
    const parent = metricsFromParentNode(retweeted);
    return stripDuplicateParentMetrics(outer, parent);
  }

  if (quoted) {
    const qm = metricsFromParentNode(quoted);
    return stripDuplicateParentMetrics(outer, qm);
  }

  return outer;
}
