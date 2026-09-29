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

/** Mutually exclusive moderation bucket for counts, filters, and badges. */
export type SubmissionModerationBucket =
  | "rejected"
  | "paid"
  | "verified"
  | "pending";

export type SubmissionModerationStatusCounts = {
  all: number;
  pending: number;
  rejected: number;
  verified: number;
  paid: number;
  verified_or_paid: number;
  /** Legacy creator-wise metric: verified status with paid flag still set. */
  verified_paid: number;
};

/**
 * Payment fields still set while moderation status has moved on (incomplete reversal).
 */
export function submissionHasUnclearedPayment(submission: {
  paid?: boolean | null;
  bonus_paid?: boolean | null;
  earnings?: number | null;
  paid_at?: string | null;
  bonus_paid_at?: string | null;
}): boolean {
  if (submission.paid === true || submission.bonus_paid === true) return true;
  if (submission.paid_at) return true;
  if (submission.bonus_paid_at) return true;
  return Number(submission.earnings) > 0;
}

/**
 * One bucket per submission. Uncleared payment fields keep a row in `paid`
 * until wallet finalize clears them (avoids pending+paid double-count drift).
 */
export function getSubmissionModerationBucket(submission: {
  status?: string | null;
  moderation_status?: string | null;
  is_twitter_tweet?: boolean;
  paid?: boolean | null;
  bonus_paid?: boolean | null;
  earnings?: number | null;
  paid_at?: string | null;
  bonus_paid_at?: string | null;
}): SubmissionModerationBucket {
  const status = getContestDetailRowStatus(submission);
  const uncleared = submissionHasUnclearedPayment(submission);

  if (status === "rejected") return "rejected";
  if (status === "paid") return "paid";
  if (status === "verified" || status === "approved") {
    return uncleared ? "paid" : "verified";
  }
  if (status === "pending") {
    return uncleared ? "paid" : "pending";
  }
  if (uncleared) return "paid";
  return "pending";
}

export function computeSubmissionModerationStatusCounts(
  submissions: Array<{
    status?: string | null;
    moderation_status?: string | null;
    is_twitter_tweet?: boolean;
    paid?: boolean | null;
  }>,
): SubmissionModerationStatusCounts {
  let pending = 0;
  let rejected = 0;
  let verified = 0;
  let paid = 0;
  let verified_paid = 0;
  for (const submission of submissions) {
    const bucket = getSubmissionModerationBucket(submission);
    if (bucket === "rejected") rejected += 1;
    else if (bucket === "paid") paid += 1;
    else if (bucket === "verified") verified += 1;
    else pending += 1;

    const status = getContestDetailRowStatus(submission);
    if (
      (status === "verified" || status === "approved") &&
      submission.paid === true
    ) {
      verified_paid += 1;
    }
  }
  return {
    all: submissions.length,
    pending,
    rejected,
    verified,
    paid,
    verified_or_paid: verified + paid,
    verified_paid,
  };
}

export function computeContestDetailSubmissionStatusCounts(
  submissions: Array<{
    status?: string | null;
    moderation_status?: string | null;
    is_twitter_tweet?: boolean;
    paid?: boolean | null;
  }>,
): ContestDetailSubmissionStatusCounts {
  const counts = computeSubmissionModerationStatusCounts(submissions);
  return {
    total: counts.all,
    pending: counts.pending,
    rejected: counts.rejected,
    verified: counts.verified,
    paid: counts.paid,
    verified_or_paid: counts.verified_or_paid,
    not_rejected: Math.max(0, counts.all - counts.rejected),
  };
}
