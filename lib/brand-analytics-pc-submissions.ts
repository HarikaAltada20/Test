import {
  POST_CAMPAIGN_LIST_SELECT,
} from "@/lib/post-campaign-metrics";
import {
  postCampaignSnapshotToSubmission,
  type PostCampaignSubmissionSnapshot,
} from "@/lib/post-campaign-submission-shape";

export type BrandPcSubmissionFetchOptions = {
  dateFrom: Date;
  dateTo: Date;
  notRejected?: boolean;
  submissionStatus?: string | null;
};

function applyPcStatusFilter<T extends { neq: Function; in: Function; eq: Function }>(
  query: T,
  options: BrandPcSubmissionFetchOptions,
): T {
  const status = options.submissionStatus?.trim().toLowerCase() ?? null;
  if (options.notRejected) {
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

/** Load post-campaign overlay rows as submission-shaped objects for brand analytics. */
export async function fetchBrandPcSubmissionsAsAnalyticsRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestIds: string[],
  options: BrandPcSubmissionFetchOptions,
): Promise<Record<string, unknown>[]> {
  if (contestIds.length === 0) return [];

  const PAGE_SIZE = 1000;
  const CONTEST_ID_CHUNK = 200;
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    for (let page = 0; ; page++) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("post_campaign_submission_metrics")
        .select(POST_CAMPAIGN_LIST_SELECT)
        .in("contest_id", idChunk)
        .gte("created_at", options.dateFrom.toISOString())
        .lte("created_at", options.dateTo.toISOString())
        .order("created_at", { ascending: false })
        .range(from, to);

      query = applyPcStatusFilter(query, options);

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }

      for (const row of (data ?? []) as PostCampaignSubmissionSnapshot[]) {
        rows.push(
          postCampaignSnapshotToSubmission(row) as Record<string, unknown>,
        );
      }

      if (!data || data.length < PAGE_SIZE) break;
    }
  }

  return rows;
}

/** Contest IDs that have post-campaign overlay rows in the given date range. */
export async function fetchBrandPcCampaignIdsInRange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestIds: string[],
  dateFrom: Date,
  dateTo: Date,
): Promise<Set<string>> {
  if (contestIds.length === 0) return new Set();

  const ids = new Set<string>();
  const CONTEST_ID_CHUNK = 200;

  for (let i = 0; i < contestIds.length; i += CONTEST_ID_CHUNK) {
    const idChunk = contestIds.slice(i, i + CONTEST_ID_CHUNK);
    const { data, error } = await supabase
      .from("post_campaign_submission_metrics")
      .select("contest_id")
      .in("contest_id", idChunk)
      .gte("created_at", dateFrom.toISOString())
      .lte("created_at", dateTo.toISOString());

    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const cid = row.contest_id as string | undefined;
      if (cid) ids.add(cid);
    }
  }

  return ids;
}

/** Attach creator profiles to flat submission rows (for creators leaderboard). */
export async function attachCreatorsToSubmissionRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  submissions: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const creatorIds = [
    ...new Set(
      submissions
        .map((s) => s.creator_id as string | undefined)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (creatorIds.length === 0) return submissions;

  const creatorsById = new Map<string, unknown>();
  const CHUNK = 150;
  for (let i = 0; i < creatorIds.length; i += CHUNK) {
    const chunk = creatorIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("users")
      .select(
        `
        id,
        username,
        creator_profiles (
          bio,
          total_views,
          total_contests_participated,
          total_contests_won,
          youtube_account,
          instagram_account
        )
      `,
      )
      .in("id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      creatorsById.set(row.id, row);
    }
  }

  return submissions.map((sub) => ({
    ...sub,
    creator: creatorsById.get(sub.creator_id as string) ?? null,
  }));
}
