export type LeaderboardSubmissionBannerCounts = {
  total: number;
  rejected: number;
  active: number;
};

export function leaderboardSubmissionBannerCounts(
  totalSubmissions: number,
  rejectedCount: number,
): LeaderboardSubmissionBannerCounts {
  const total = Math.max(0, Number(totalSubmissions) || 0);
  const rejected = Math.min(total, Math.max(0, Number(rejectedCount) || 0));
  return {
    total,
    rejected,
    active: total - rejected,
  };
}

/** Map a leaderboard API payload onto All / platform-tab banner counts. */
export function leaderboardBannerCountsFromPayload(data: {
  totalSubmissions?: unknown;
  rejectedCount?: unknown;
  totalEntries?: unknown;
}): LeaderboardSubmissionBannerCounts {
  const total = Number(data.totalSubmissions) || 0;
  const rejected =
    typeof data.rejectedCount === "number"
      ? data.rejectedCount
      : Math.max(0, total - (Number(data.totalEntries) || 0));
  return leaderboardSubmissionBannerCounts(total, rejected);
}
