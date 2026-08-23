export type ContestDetailSubmissionStatusCounts = {
  total: number;
  pending: number;
  rejected: number;
  /** verified only (excludes paid). */
  verified: number;
  paid: number;
  /** verified + paid */
  verified_or_paid: number;
  not_rejected: number;
};

export function getContestDetailRowStatus(submission: {
  status?: string | null;
  moderation_status?: string | null;
  is_twitter_tweet?: boolean;
}): string {
  const isTwitterTweet = submission.is_twitter_tweet === true;
  const raw = isTwitterTweet
    ? submission.moderation_status || "pending"
    : submission.status || "pending";
  return String(raw).toLowerCase();
}

export function computeContestDetailSubmissionStatusCounts(
  submissions: Array<{
    status?: string | null;
    moderation_status?: string | null;
    is_twitter_tweet?: boolean;
  }>,
): ContestDetailSubmissionStatusCounts {
  let pending = 0;
  let rejected = 0;
  let verified = 0;
  let paid = 0;
  for (const submission of submissions) {
    const status = getContestDetailRowStatus(submission);
    if (status === "rejected") rejected += 1;
    else if (status === "paid") paid += 1;
    else if (status === "verified") verified += 1;
    else pending += 1;
  }
  const total = submissions.length;
  return {
    total,
    pending,
    rejected,
    verified,
    paid,
    verified_or_paid: verified + paid,
    not_rejected: Math.max(0, total - rejected),
  };
}
