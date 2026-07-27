export type ContestListMetricsContest = {
  status?: string | null;
  live_submission_count?: number | null;
  verified_submission_count?: number | null;
  pending_submission_count?: number | null;
  rejected_submission_count?: number | null;
  not_rejected_views?: number | null;
  last_metrics_updated?: string | null;
};

export function formatCompactCount(n: number): string {
  if (n >= 1_000_000) {
    const millions = n / 1_000_000;
    return millions >= 10
      ? `${Math.round(millions)}M`
      : `${millions.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    const thousands = n / 1_000;
    return thousands >= 10
      ? `${Math.round(thousands)}K`
      : `${thousands.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return n.toLocaleString();
}

export function getAdminSubmissionTotal(
  contest: ContestListMetricsContest,
): number {
  const verified = contest.verified_submission_count ?? 0;
  const pending = contest.pending_submission_count ?? 0;
  const rejected = contest.rejected_submission_count ?? 0;
  const fromStatusCounts = verified + pending + rejected;

  if (
    contest.live_submission_count !== null &&
    contest.live_submission_count !== undefined
  ) {
    return Math.max(contest.live_submission_count, fromStatusCounts);
  }

  return fromStatusCounts;
}

/** Live: verified / total. Ended: (verified + pending) / total. Returns 0% when no submissions. */
export function getAdminApprovalPercent(
  contest: ContestListMetricsContest,
): number {
  const total = getAdminSubmissionTotal(contest);
  if (total <= 0) return 0;

  const verified = contest.verified_submission_count ?? 0;
  const pending = contest.pending_submission_count ?? 0;
  const isEnded = contest.status === "ended";
  const numerator = isEnded ? verified + pending : verified;

  return Math.min(100, Math.round((numerator / total) * 100));
}
