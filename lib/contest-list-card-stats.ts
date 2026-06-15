import { createAdminClient } from "@/utils/supabase/admin";

export type SubmissionStatusCounts = {
  verified: number;
  pending: number;
  rejected: number;
};

export type ContestListCardStats = {
  verified_submission_count: number;
  pending_submission_count: number;
  rejected_submission_count: number;
  not_rejected_views: number;
  last_metrics_updated: string | null;
};

function applySubmissionStatusCount(
  counts: Map<string, SubmissionStatusCounts>,
  contestId: string | null | undefined,
  rawStatus: string | null | undefined,
) {
  if (!contestId) return;

  const status = (rawStatus || "pending").toLowerCase();
  const entry = counts.get(contestId) || { verified: 0, pending: 0, rejected: 0 };

  if (status === "rejected") {
    entry.rejected += 1;
  } else if (status === "pending") {
    entry.pending += 1;
  } else if (status === "verified" || status === "paid") {
    entry.verified += 1;
  }

  counts.set(contestId, entry);
}

/**
 * Counts verified ('verified' + 'paid') and pending per contest from
 * submissions and Twitter tweets. Optionally scoped to contest IDs.
 */
export async function getSubmissionStatusCountsByContest(
  contestIds?: string[],
): Promise<Map<string, SubmissionStatusCounts>> {
  const counts = new Map<string, SubmissionStatusCounts>();
  const supabaseAdmin = createAdminClient();
  const CHUNK_SIZE = 1000;

  const pageTable = async (
    table: "submissions" | "twitter_campaign_tweets",
    statusColumn: "status" | "moderation_status",
    extraFilter?: (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query: any,
    ) => any,
  ) => {
    let rangeFrom = 0;

    for (;;) {
      let query = supabaseAdmin
        .from(table)
        .select(`contest_id, ${statusColumn}`)
        .order("id", { ascending: true })
        .range(rangeFrom, rangeFrom + CHUNK_SIZE - 1);

      if (contestIds?.length) {
        query = query.in("contest_id", contestIds);
      }

      if (extraFilter) {
        query = extraFilter(query);
      }

      const { data, error } = await query;

      if (error) {
        console.error(
          `Failed to load ${table} status counts:`,
          error.message,
        );
        break;
      }

      for (const row of data || []) {
        const statusValue =
          statusColumn === "status"
            ? (row as { contest_id: string | null; status: string | null }).status
            : (
                row as {
                  contest_id: string | null;
                  moderation_status: string | null;
                }
              ).moderation_status;

        applySubmissionStatusCount(
          counts,
          row.contest_id,
          statusValue,
        );
      }

      if (!data || data.length < CHUNK_SIZE) break;
      rangeFrom += CHUNK_SIZE;
    }
  };

  await Promise.all([
    pageTable("submissions", "status", (query) =>
      query.in("status", ["pending", "verified", "paid"]),
    ),
    pageTable("twitter_campaign_tweets", "moderation_status", (query) =>
      query.is("deleted_at", null),
    ),
  ]);

  return counts;
}

/** Sum submission/tweet views excluding rejected rows, grouped by contest. */
export async function getNotRejectedViewsByContest(
  contestIds?: string[],
): Promise<Map<string, number>> {
  const viewsByContest = new Map<string, number>();
  const supabaseAdmin = createAdminClient();
  const CHUNK_SIZE = 1000;

  const addViews = (
    contestId: string | null | undefined,
    rawViews: number | null | undefined,
  ) => {
    if (!contestId) return;
    const views = Number(rawViews) || 0;
    if (views <= 0) return;
    viewsByContest.set(contestId, (viewsByContest.get(contestId) || 0) + views);
  };

  const pageSubmissions = async () => {
    let rangeFrom = 0;

    for (;;) {
      let query = supabaseAdmin
        .from("submissions")
        .select("contest_id, views, status")
        .in("status", ["pending", "verified", "paid"])
        .order("id", { ascending: true })
        .range(rangeFrom, rangeFrom + CHUNK_SIZE - 1);

      if (contestIds?.length) {
        query = query.in("contest_id", contestIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error(
          "Failed to load submission views for contest cards:",
          error.message,
        );
        break;
      }

      for (const row of data || []) {
        addViews(row.contest_id, row.views);
      }

      if (!data || data.length < CHUNK_SIZE) break;
      rangeFrom += CHUNK_SIZE;
    }
  };

  const pageTwitterTweets = async () => {
    let rangeFrom = 0;

    for (;;) {
      let query = supabaseAdmin
        .from("twitter_campaign_tweets")
        .select("contest_id, impressions, moderation_status")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(rangeFrom, rangeFrom + CHUNK_SIZE - 1);

      if (contestIds?.length) {
        query = query.in("contest_id", contestIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error(
          "Failed to load Twitter tweet views for contest cards:",
          error.message,
        );
        break;
      }

      for (const row of data || []) {
        const status = (row.moderation_status || "pending").toLowerCase();
        if (status === "rejected") continue;
        addViews(row.contest_id, row.impressions);
      }

      if (!data || data.length < CHUNK_SIZE) break;
      rangeFrom += CHUNK_SIZE;
    }
  };

  await Promise.all([pageSubmissions(), pageTwitterTweets()]);

  return viewsByContest;
}

export async function loadContestListCardStatsMaps(contestIds?: string[]) {
  const scopedIds =
    contestIds && contestIds.length > 0 ? contestIds : undefined;

  const [submissionStatusCounts, notRejectedViews] = await Promise.all([
    getSubmissionStatusCountsByContest(scopedIds),
    getNotRejectedViewsByContest(scopedIds),
  ]);

  return { submissionStatusCounts, notRejectedViews };
}

export function enrichContestWithListCardStats<
  T extends { id: string; last_metrics_updated?: string | null },
>(
  contest: T,
  submissionStatusCounts: Map<string, SubmissionStatusCounts>,
  notRejectedViews: Map<string, number>,
): T & ContestListCardStats {
  const statusCounts = submissionStatusCounts.get(contest.id);

  return {
    ...contest,
    verified_submission_count: statusCounts?.verified ?? 0,
    pending_submission_count: statusCounts?.pending ?? 0,
    rejected_submission_count: statusCounts?.rejected ?? 0,
    not_rejected_views: notRejectedViews.get(contest.id) ?? 0,
    last_metrics_updated: contest.last_metrics_updated ?? null,
  };
}

export async function enrichContestsWithListCardStats<
  T extends { id: string; last_metrics_updated?: string | null },
>(contests: T[]): Promise<Array<T & ContestListCardStats>> {
  if (contests.length === 0) return [];

  const contestIds = contests.map((contest) => contest.id);
  const { submissionStatusCounts, notRejectedViews } =
    await loadContestListCardStatsMaps(contestIds);

  return contests.map((contest) =>
    enrichContestWithListCardStats(
      contest,
      submissionStatusCounts,
      notRejectedViews,
    ),
  );
}
