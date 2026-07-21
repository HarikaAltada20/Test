import type { BrandAnalyticsQueryContext, BrandContestRow } from "@/lib/brand-analytics-cache";
import { normalizeBrandPlatformKey } from "@/lib/brand-analytics-graph";
import { fetchBrandPcSubmissionsAsAnalyticsRows } from "@/lib/brand-analytics-pc-submissions";
import { sumTwitterLeaderboardPayoutsCents } from "@/lib/brand-analytics-payouts";
import {
  getBudgetTileLabel,
  getBudgetTileMode,
  getCampaignBudgetCents,
  getPoolBudgetSpentCentsForDisplay,
  mapTwitterTweetsToBudgetSubmissions,
  resolveBudgetTileMetrics,
  type BudgetTileMetrics,
  type BudgetTileSubmission,
  type ContestBudgetTileInput,
} from "@/lib/contest-budget-tile-metrics";

function applySubmissionStatusFilter<T extends { neq: Function; in: Function; eq: Function }>(
  query: T,
  ctx: BrandAnalyticsQueryContext,
): T {
  const status = ctx.submissionStatus?.trim().toLowerCase() ?? null;
  if (ctx.notRejected) {
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

function applyVideoSubmissionStatusFilter<
  T extends { neq: Function; in: Function; eq: Function },
>(query: T, ctx: BrandAnalyticsQueryContext): T {
  const status = ctx.submissionStatus?.trim().toLowerCase() ?? null;
  if (ctx.notRejected) {
    return query.neq("status", "rejected") as T;
  }
  if (status && status !== "all") {
    if (status === "verifiedpaid") {
      return query.in("status", ["verified", "paid"]) as T;
    }
    return query.eq("status", status) as T;
  }
  return query;
}

function toContestBudgetInput(contest: BrandContestRow): ContestBudgetTileInput {
  return {
    contest_type: contest.contest_type,
    post_contest_status: contest.post_contest_status,
    max_earnings_per_creator: contest.max_earnings_per_creator ?? null,
    contest_based_details: contest.contest_based_details as
      | Record<string, unknown>
      | null
      | undefined,
  };
}

function mapVideoRowToBudgetSubmission(row: Record<string, unknown>): BudgetTileSubmission {
  return {
    id: String(row.id ?? ""),
    creator_id: String(row.creator_id ?? ""),
    views: Number(row.views ?? 0) || 0,
    created_at: String(row.created_at ?? new Date(0).toISOString()),
    platform: row.platform as string | undefined,
    other_stats: row.other_stats as BudgetTileSubmission["other_stats"],
    status: row.status as string | undefined,
    paid: Boolean(row.paid),
    earnings:
      row.earnings == null ? null : (Number(row.earnings) as number | null),
    bonus_paid: Boolean(row.bonus_paid),
    bonus_amount:
      row.bonus_amount == null
        ? undefined
        : (Number(row.bonus_amount) as number | undefined),
    paid_at: row.paid_at as string | null | undefined,
  };
}

export async function fetchBrandContestBudgetSubmissions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contests: BrandContestRow[],
  ctx: BrandAnalyticsQueryContext,
): Promise<Map<string, BudgetTileSubmission[]>> {
  const result = new Map<string, BudgetTileSubmission[]>();
  if (contests.length === 0) return result;

  const fromIso = ctx.dateFrom.toISOString();
  const toIso = ctx.dateTo.toISOString();
  const isPc = ctx.dataSource === "pc_submissions";

  const videoContests = contests.filter(
    (c) => normalizeBrandPlatformKey(c) !== "twitter",
  );
  const twitterContests = contests.filter(
    (c) => normalizeBrandPlatformKey(c) === "twitter",
  );

  if (videoContests.length > 0) {
    const videoIds = videoContests.map((c) => c.id);

    if (isPc) {
      const rows = await fetchBrandPcSubmissionsAsAnalyticsRows(supabase, videoIds, {
        dateFrom: ctx.dateFrom,
        dateTo: ctx.dateTo,
        notRejected: ctx.notRejected,
        submissionStatus: ctx.submissionStatus,
      });
      for (const row of rows) {
        const contestId = String(row.contest_id ?? "");
        if (!contestId) continue;
        const list = result.get(contestId) ?? [];
        list.push(mapVideoRowToBudgetSubmission(row));
        result.set(contestId, list);
      }
    } else {
      const PAGE_SIZE = 1000;
      const CONTEST_ID_CHUNK = 200;

      for (let i = 0; i < videoIds.length; i += CONTEST_ID_CHUNK) {
        const idChunk = videoIds.slice(i, i + CONTEST_ID_CHUNK);
        for (let page = 0; ; page++) {
          const from = page * PAGE_SIZE;
          const to = from + PAGE_SIZE - 1;
          let query = supabase
            .from("submissions")
            .select(
              "id, contest_id, views, created_at, platform, other_stats, status, creator_id, paid, earnings, bonus_paid, bonus_amount, paid_at",
            )
            .in("contest_id", idChunk)
            .gte("created_at", fromIso)
            .lte("created_at", toIso)
            .range(from, to)
            .order("created_at", { ascending: false });

          query = applyVideoSubmissionStatusFilter(query, ctx);

          const { data, error } = await query;
          if (error) throw new Error(error.message);
          if (!data || data.length === 0) break;

          for (const row of data as Record<string, unknown>[]) {
            const contestId = String(row.contest_id ?? "");
            if (!contestId) continue;
            const list = result.get(contestId) ?? [];
            list.push(mapVideoRowToBudgetSubmission(row));
            result.set(contestId, list);
          }

          if (data.length < PAGE_SIZE) break;
        }
      }
    }
  }

  if (!isPc && twitterContests.length > 0) {
    const twitterIds = twitterContests.map((c) => c.id);
    const PAGE_SIZE = 1000;
    const CONTEST_ID_CHUNK = 200;

    for (let i = 0; i < twitterIds.length; i += CONTEST_ID_CHUNK) {
      const idChunk = twitterIds.slice(i, i + CONTEST_ID_CHUNK);
      for (let page = 0; ; page++) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        let query = supabase
          .from("twitter_campaign_tweets")
          .select(
            "id, contest_id, creator_id, tweet_created_at, moderation_status, points, manual_points_adjustment, earnings, impressions, is_eligible, deleted_at",
          )
          .in("contest_id", idChunk)
          .gte("tweet_created_at", fromIso)
          .lte("tweet_created_at", toIso)
          .range(from, to)
          .order("tweet_created_at", { ascending: false });

        query = applySubmissionStatusFilter(query, ctx);

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;

        for (const row of data) {
          const contestId = String(row.contest_id ?? "");
          if (!contestId) continue;
          const list = result.get(contestId) ?? [];
          list.push(
            ...mapTwitterTweetsToBudgetSubmissions([
              {
                id: String(row.id ?? ""),
                creator_id: row.creator_id,
                tweet_created_at: row.tweet_created_at,
                moderation_status: row.moderation_status,
                points: row.points,
                manual_points_adjustment: row.manual_points_adjustment,
                earnings: row.earnings,
                impressions: row.impressions,
                is_eligible: row.is_eligible,
                deleted_at: row.deleted_at,
              },
            ]),
          );
          result.set(contestId, list);
        }

        if (data.length < PAGE_SIZE) break;
      }
    }
  }

  return result;
}

export async function fetchTwitterLeaderboardPaidByContest(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (contestIds.length === 0) return result;

  const { data, error } = await supabase
    .from("twitter_campaign_leaderboard")
    .select("contest_id, earnings")
    .in("contest_id", contestIds);

  if (error) throw new Error(error.message);

  const grouped = new Map<string, Array<{ earnings?: number | null }>>();
  for (const row of data ?? []) {
    const contestId = String(row.contest_id ?? "");
    if (!contestId) continue;
    const list = grouped.get(contestId) ?? [];
    list.push({ earnings: row.earnings });
    grouped.set(contestId, list);
  }

  for (const [contestId, rows] of grouped) {
    result.set(contestId, sumTwitterLeaderboardPayoutsCents(rows));
  }

  return result;
}

export function resolveContestBudgetTile(
  contest: BrandContestRow,
  budgetSubmissions: BudgetTileSubmission[],
  twitterLeaderboardPaidCents?: number,
): BudgetTileMetrics | null {
  const contestInput = toContestBudgetInput(contest);
  const denominatorCents = getCampaignBudgetCents(contestInput);
  if (denominatorCents <= 0) return null;

  const mode = getBudgetTileMode(contest.post_contest_status);
  const tile =
    budgetSubmissions.length > 0
      ? resolveBudgetTileMetrics(contestInput, budgetSubmissions)
      : null;

  let numeratorCents =
    tile?.numeratorCents ??
    getPoolBudgetSpentCentsForDisplay(contestInput, budgetSubmissions);

  if (
    mode === "paid" &&
    normalizeBrandPlatformKey(contest) === "twitter" &&
    twitterLeaderboardPaidCents != null &&
    twitterLeaderboardPaidCents > 0
  ) {
    numeratorCents = twitterLeaderboardPaidCents;
  }

  numeratorCents = Math.max(0, numeratorCents);

  return {
    mode,
    numeratorCents,
    denominatorCents,
    label: getBudgetTileLabel(mode),
  };
}
