import { fetchBrandPcSubmissionsAsAnalyticsRows } from "@/lib/brand-analytics-pc-submissions";

type PayoutSubmissionRow = {
  status?: string | null;
  earnings?: number | null;
  bonus_amount?: number | null;
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
 * - Twitter: creator earnings from twitter_campaign_leaderboard for scoped contests
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
    const { data: leaderboard, error } = await supabase
      .from("twitter_campaign_leaderboard")
      .select("earnings")
      .in("contest_id", twitterContestIds);

    if (error) throw new Error(error.message);
    totalCents += sumTwitterLeaderboardPayoutsCents(leaderboard ?? []);
  }

  return totalCents;
}
