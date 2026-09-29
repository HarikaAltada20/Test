import { fetchBrandPcSubmissionsAsAnalyticsRows } from "@/lib/brand-analytics-pc-submissions";
import type { BrandAnalyticsQueryContext } from "@/lib/brand-analytics-cache";

type PayoutSubmissionRow = {
  status?: string | null;
  earnings?: number | null;
  bonus_amount?: number | null;
};

type TwitterPayoutStatusFilter = {
  submissionStatus?: string | null;
  notRejected?: boolean;
};

/** Gross payout for one video/PC submission (earnings + bonus when paid). */
export function computeSubmissionPayoutCents(sub: PayoutSubmissionRow): number {
  const stLower = (sub.status ?? "").toString().toLowerCase();
  const earningsCents = Number(sub.earnings ?? 0) || 0;
  const bonusCents = Number(sub.bonus_amount ?? 0) || 0;
  const paid = stLower === "paid" || earningsCents > 0;
  return paid ? earningsCents + bonusCents : 0;
}

export function sumSubmissionPayoutsCents(
  submissions: PayoutSubmissionRow[],
): number {
  return submissions.reduce(
    (sum, sub) => sum + computeSubmissionPayoutCents(sub),
    0,
  );
}

export function sumTwitterLeaderboardPayoutsCents(
  rows: Array<{ earnings?: number | null }>,
): number {
  return rows.reduce(
    (sum, row) => sum + (Number(row.earnings ?? 0) || 0),
    0,
  );
}

function applyTwitterModerationStatusFilter<
  T extends { neq: Function; in: Function; eq: Function },
>(query: T, statusFilter?: TwitterPayoutStatusFilter): T {
  const status = statusFilter?.submissionStatus?.trim().toLowerCase() ?? null;
  if (statusFilter?.notRejected) {
    return query.neq("moderation_status", "rejected") as T;
  }
  if (status && status !== "all") {
    if (status === "verifiedpaid") {
      return query.in("moderation_status", ["verified", "paid"]) as T;
    }
    return query.eq("moderation_status", status) as T;
  }
  return query;
}

/** Sum tweet earnings in a date range, optionally filtered by moderation status. */
export async function fetchTwitterPayoutsCentsFromTweets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestIds: string[],
  dateFrom: Date,
  dateTo: Date,
  statusFilter?: TwitterPayoutStatusFilter,
  creatorId?: string,
): Promise<number> {
  const byCreator = await fetchTwitterEarningsCentsByCreator(
    supabase,
    contestIds,
    dateFrom,
    dateTo,
    statusFilter,
    creatorId,
  );
  let totalCents = 0;
  for (const earnings of byCreator.values()) {
    totalCents += earnings;
  }
  return totalCents;
}

/** Per-creator tweet earnings in a date range (not leaderboard totals). */
export async function fetchTwitterEarningsCentsByCreator(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestIds: string[],
  dateFrom: Date,
  dateTo: Date,
  statusFilter?: TwitterPayoutStatusFilter,
  creatorId?: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (contestIds.length === 0) return result;

  let query = supabase
    .from("twitter_campaign_tweets")
    .select("creator_id, earnings, moderation_status, bonus_amount")
    .in("contest_id", contestIds)
    .gte("tweet_created_at", dateFrom.toISOString())
    .lte("tweet_created_at", dateTo.toISOString());

  if (creatorId) {
    query = query.eq("creator_id", creatorId);
  }

  query = applyTwitterModerationStatusFilter(query, statusFilter);

  const CHUNK = 1000;
  let rangeFrom = 0;

  while (true) {
    const { data, error } = await query.range(rangeFrom, rangeFrom + CHUNK - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const id = String(row.creator_id ?? "");
      if (!id) continue;
      const payout = computeSubmissionPayoutCents({
        status: row.moderation_status,
        earnings: row.earnings,
        bonus_amount: row.bonus_amount,
      });
      if (payout <= 0) continue;
      result.set(id, (result.get(id) ?? 0) + payout);
    }

    if (data.length < CHUNK) break;
    rangeFrom += CHUNK;
  }

  return result;
}

/** Sum tweet earnings in the analytics date range, optionally filtered by moderation status. */
export async function fetchTwitterFilteredPayoutsCents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestIds: string[],
  ctx: BrandAnalyticsQueryContext,
): Promise<number> {
  return fetchTwitterPayoutsCentsFromTweets(
    supabase,
    contestIds,
    ctx.dateFrom,
    ctx.dateTo,
    ctx,
  );
}

/** Twitter gross payouts from tweet rows in the selected date range (not leaderboard totals). */
export async function resolveBrandTwitterPayoutsCents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestIds: string[],
  ctx: BrandAnalyticsQueryContext,
): Promise<number> {
  if (contestIds.length === 0) return 0;
  return fetchTwitterFilteredPayoutsCents(supabase, contestIds, ctx);
}

type FetchBrandTotalPayoutsInput = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  videoContestIds: string[];
  twitterContestIds: string[];
  dateFrom: Date;
  dateTo: Date;
  isPc?: boolean;
};

/**
 * Total Payouts (gross) for brand analytics — matches Overview tile definition:
 * - Video/PC: earnings + bonus on paid submissions in date range (ignores UI status filter)
 * - Twitter: paid tweet earnings in date range (ignores UI status filter)
 */
export async function fetchBrandTotalPayoutsCents(
  input: FetchBrandTotalPayoutsInput,
): Promise<number> {
  const {
    supabase,
    videoContestIds,
    twitterContestIds,
    dateFrom,
    dateTo,
    isPc = false,
  } = input;

  let totalCents = 0;

  if (videoContestIds.length > 0) {
    if (isPc) {
      const pcRows = await fetchBrandPcSubmissionsAsAnalyticsRows(
        supabase,
        videoContestIds,
        { dateFrom, dateTo },
      );
      totalCents += sumSubmissionPayoutsCents(
        pcRows as PayoutSubmissionRow[],
      );
    } else {
      const CHUNK = 1000;
      const CONTEST_ID_CHUNK = 200;
      const rows: PayoutSubmissionRow[] = [];

      for (
        let idFrom = 0;
        idFrom < videoContestIds.length;
        idFrom += CONTEST_ID_CHUNK
      ) {
        const contestIdChunk = videoContestIds.slice(
          idFrom,
          idFrom + CONTEST_ID_CHUNK,
        );
        let rangeFrom = 0;
        while (true) {
          const { data: chunk, error } = await supabase
            .from("submissions")
            .select("status, earnings, bonus_amount")
            .in("contest_id", contestIdChunk)
            .gte("created_at", dateFrom.toISOString())
            .lte("created_at", dateTo.toISOString())
            .range(rangeFrom, rangeFrom + CHUNK - 1);

          if (error) throw new Error(error.message);
          if (!chunk || chunk.length === 0) break;
          rows.push(...chunk);
          if (chunk.length < CHUNK) break;
          rangeFrom += CHUNK;
        }
      }

      totalCents += sumSubmissionPayoutsCents(rows);
    }
  }

  if (twitterContestIds.length > 0) {
    totalCents += await fetchTwitterPayoutsCentsFromTweets(
      supabase,
      twitterContestIds,
      dateFrom,
      dateTo,
    );
  }

  return totalCents;
}
