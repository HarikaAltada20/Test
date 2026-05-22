/** PostgREST/Supabase returns at most 1000 rows per request without `.range()`. */
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_MAX_ROWS = 50_000;

export type FetchContestSubmissionsOptions = {
  chunkSize?: number;
  maxRows?: number;
  statusIn?: string[];
  statusNeq?: string;
  creatorId?: string;
  platform?: string;
  bonusPaid?: boolean;
  paid?: boolean;
  order?:
    | {
        column: string;
        ascending: boolean;
        nullsFirst?: boolean;
      }
    | Array<{
        column: string;
        ascending: boolean;
        nullsFirst?: boolean;
      }>;
};

function buildContestSubmissionsQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  select: string,
  contestId: string,
  options?: FetchContestSubmissionsOptions,
) {
  let query = supabase.from("submissions").select(select).eq("contest_id", contestId);

  if (options?.creatorId) {
    query = query.eq("creator_id", options.creatorId);
  }
  if (options?.statusIn?.length) {
    query = query.in("status", options.statusIn);
  }
  if (options?.statusNeq) {
    query = query.neq("status", options.statusNeq);
  }
  if (options?.platform) {
    query = query.eq("platform", options.platform);
  }
  if (options?.bonusPaid !== undefined) {
    query = query.eq("bonus_paid", options.bonusPaid);
  }
  if (options?.paid !== undefined) {
    query = query.eq("paid", options.paid);
  }

  const orders = options?.order
    ? Array.isArray(options.order)
      ? options.order
      : [options.order]
    : [{ column: "created_at", ascending: false }];

  for (const order of orders) {
    query = query.order(order.column, {
      ascending: order.ascending,
      ...(order.nullsFirst !== undefined ? { nullsFirst: order.nullsFirst } : {}),
    });
  }

  return query;
}

export async function fetchContestSubmissionsAllPages<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestId: string,
  select: string,
  options?: FetchContestSubmissionsOptions,
): Promise<{ data: T[]; error: unknown }> {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
  const rows: T[] = [];
  let rangeFrom = 0;

  while (rows.length < maxRows) {
    const rangeTo = Math.min(rangeFrom + chunkSize - 1, maxRows - 1);
    const { data: chunk, error } = await buildContestSubmissionsQuery(
      supabase,
      select,
      contestId,
      options,
    ).range(rangeFrom, rangeTo);

    if (error) {
      return { data: rows, error };
    }

    const page = (chunk || []) as T[];
    if (page.length === 0) break;

    rows.push(...page);
    if (page.length < chunkSize) break;
    rangeFrom += chunkSize;
  }

  return { data: rows, error: null };
}

export type FetchContestTwitterTweetsOptions = {
  chunkSize?: number;
  maxRows?: number;
  isEligible?: boolean;
  deletedAtNull?: boolean;
  moderationStatusIn?: string[];
  orFilter?: string;
  order?: { column: string; ascending: boolean };
};

function buildContestTwitterTweetsQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  select: string,
  contestId: string,
  options?: FetchContestTwitterTweetsOptions,
) {
  let query = supabase
    .from("twitter_campaign_tweets")
    .select(select)
    .eq("contest_id", contestId);

  if (options?.orFilter) {
    query = query.or(options.orFilter);
  }
  if (options?.isEligible === true) {
    query = query.eq("is_eligible", true);
  }
  if (options?.deletedAtNull === true) {
    query = query.is("deleted_at", null);
  }
  if (options?.moderationStatusIn?.length) {
    query = query.in("moderation_status", options.moderationStatusIn);
  }

  const order = options?.order ?? {
    column: "tweet_created_at",
    ascending: false,
  };
  query = query.order(order.column, { ascending: order.ascending });

  return query;
}

export async function fetchContestTwitterTweetsAllPages<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestId: string,
  select: string,
  options?: FetchContestTwitterTweetsOptions,
): Promise<{ data: T[]; error: unknown }> {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
  const rows: T[] = [];
  let rangeFrom = 0;

  while (rows.length < maxRows) {
    const rangeTo = Math.min(rangeFrom + chunkSize - 1, maxRows - 1);
    const { data: chunk, error } = await buildContestTwitterTweetsQuery(
      supabase,
      select,
      contestId,
      options,
    ).range(rangeFrom, rangeTo);

    if (error) {
      return { data: rows, error };
    }

    const page = (chunk || []) as T[];
    if (page.length === 0) break;

    rows.push(...page);
    if (page.length < chunkSize) break;
    rangeFrom += chunkSize;
  }

  return { data: rows, error: null };
}
