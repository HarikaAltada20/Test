/** PostgREST/Supabase returns at most 1000 rows per request without `.range()`. */
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_MAX_ROWS = 50_000;

/** Contest detail SSR / UI page size. */
export const CONTEST_DETAIL_SUBMISSIONS_PAGE_SIZE = 1000;

const ID_TIEBREAK_ORDER = { column: "id", ascending: true } as const;

export type FetchContestSubmissionsOrder = {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
};

export type FetchContestSubmissionsOptions = {
  chunkSize?: number;
  maxRows?: number;
  statusIn?: string[];
  statusNeq?: string;
  creatorId?: string;
  platform?: string;
  bonusPaid?: boolean;
  paid?: boolean;
  order?: FetchContestSubmissionsOrder | FetchContestSubmissionsOrder[];
  /** When true, do not append `id` as a secondary sort (caller supplies full ordering). */
  skipIdTiebreak?: boolean;
};

export type FetchContestSubmissionsResult<T> = {
  data: T[];
  error: unknown | null;
  /** True when row cap was hit and the last page was full (more rows may exist). */
  truncated?: boolean;
};

export function formatSubmissionFetchError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (typeof error === "string" && error.trim()) return error;
  return "Failed to load submissions";
}

function resolveSubmissionOrders(
  options?: FetchContestSubmissionsOptions,
): FetchContestSubmissionsOrder[] {
  const orders: FetchContestSubmissionsOrder[] = options?.order
    ? Array.isArray(options.order)
      ? [...options.order]
      : [options.order]
    : [{ column: "created_at", ascending: false }];

  if (!options?.skipIdTiebreak && !orders.some((o) => o.column === "id")) {
    orders.push({ ...ID_TIEBREAK_ORDER });
  }
  return orders;
}

function buildContestSubmissionsQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  select: string,
  contestId: string,
  options?: FetchContestSubmissionsOptions & { withCount?: boolean },
) {
  let query = options?.withCount
    ? supabase.from("submissions").select(select, { count: "exact" }).eq("contest_id", contestId)
    : supabase.from("submissions").select(select).eq("contest_id", contestId);

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

  for (const order of resolveSubmissionOrders(options)) {
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
): Promise<FetchContestSubmissionsResult<T>> {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
  const rows: T[] = [];
  let rangeFrom = 0;
  let lastPageFull = false;

  while (rows.length < maxRows) {
    const rangeTo = Math.min(rangeFrom + chunkSize - 1, maxRows - 1);
    const { data: chunk, error } = await buildContestSubmissionsQuery(
      supabase,
      select,
      contestId,
      options,
    ).range(rangeFrom, rangeTo);

    if (error) {
      return { data: [], error, truncated: false };
    }

    const page = (chunk || []) as T[];
    if (page.length === 0) break;

    rows.push(...page);
    lastPageFull = page.length === chunkSize;
    if (!lastPageFull) break;
    rangeFrom += chunkSize;
  }

  const truncated = rows.length >= maxRows && lastPageFull;
  if (truncated) {
    console.warn(
      `[fetchContestSubmissionsAllPages] Contest ${contestId} hit maxRows=${maxRows}; results truncated.`,
    );
  }

  return { data: rows, error: null, truncated };
}

export type FetchContestSubmissionsPageResult<T> = {
  data: T[];
  error: unknown | null;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

/**
 * Single-page submissions fetch with exact count (for contest detail SSR/API).
 */
export async function fetchContestSubmissionsPage<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestId: string,
  select: string,
  options?: FetchContestSubmissionsOptions & {
    limit?: number;
    offset?: number;
  },
): Promise<FetchContestSubmissionsPageResult<T>> {
  const limit = Math.max(
    1,
    Math.min(
      options?.limit ?? CONTEST_DETAIL_SUBMISSIONS_PAGE_SIZE,
      DEFAULT_CHUNK_SIZE,
    ),
  );
  const offset = Math.max(0, options?.offset ?? 0);
  const rangeTo = offset + limit - 1;

  const { data, error, count } = await buildContestSubmissionsQuery(
    supabase,
    select,
    contestId,
    { ...options, withCount: true },
  ).range(offset, rangeTo);

  if (error) {
    return {
      data: [],
      error,
      total: 0,
      limit,
      offset,
      hasMore: false,
    };
  }

  const rows = (data || []) as T[];
  const total = typeof count === "number" ? count : offset + rows.length;

  return {
    data: rows,
    error: null,
    total,
    limit,
    offset,
    hasMore: offset + rows.length < total,
  };
}

export type FetchContestTwitterTweetsOptions = {
  chunkSize?: number;
  maxRows?: number;
  isEligible?: boolean;
  deletedAtNull?: boolean;
  moderationStatusIn?: string[];
  orFilter?: string;
  order?: FetchContestSubmissionsOrder | FetchContestSubmissionsOrder[];
  skipIdTiebreak?: boolean;
};

function buildContestTwitterTweetsQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  select: string,
  contestId: string,
  options?: FetchContestTwitterTweetsOptions & { withCount?: boolean },
) {
  let query = options?.withCount
    ? supabase
        .from("twitter_campaign_tweets")
        .select(select, { count: "exact" })
        .eq("contest_id", contestId)
    : supabase
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

  const orders: FetchContestSubmissionsOrder[] = options?.order
    ? Array.isArray(options.order)
      ? [...options.order]
      : [options.order]
    : [{ column: "tweet_created_at", ascending: false }];

  if (!options?.skipIdTiebreak && !orders.some((o) => o.column === "id")) {
    orders.push({ ...ID_TIEBREAK_ORDER });
  }

  for (const order of orders) {
    query = query.order(order.column, {
      ascending: order.ascending,
      ...(order.nullsFirst !== undefined ? { nullsFirst: order.nullsFirst } : {}),
    });
  }

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
): Promise<FetchContestSubmissionsResult<T>> {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
  const rows: T[] = [];
  let rangeFrom = 0;
  let lastPageFull = false;

  while (rows.length < maxRows) {
    const rangeTo = Math.min(rangeFrom + chunkSize - 1, maxRows - 1);
    const { data: chunk, error } = await buildContestTwitterTweetsQuery(
      supabase,
      select,
      contestId,
      options,
    ).range(rangeFrom, rangeTo);

    if (error) {
      return { data: [], error, truncated: false };
    }

    const page = (chunk || []) as T[];
    if (page.length === 0) break;

    rows.push(...page);
    lastPageFull = page.length === chunkSize;
    if (!lastPageFull) break;
    rangeFrom += chunkSize;
  }

  const truncated = rows.length >= maxRows && lastPageFull;
  if (truncated) {
    console.warn(
      `[fetchContestTwitterTweetsAllPages] Contest ${contestId} hit maxRows=${maxRows}; results truncated.`,
    );
  }

  return { data: rows, error: null, truncated };
}

/**
 * Single-page twitter_campaign_tweets fetch with exact count.
 */
export async function fetchContestTwitterTweetsPage<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestId: string,
  select: string,
  options?: FetchContestTwitterTweetsOptions & {
    limit?: number;
    offset?: number;
  },
): Promise<FetchContestSubmissionsPageResult<T>> {
  const limit = Math.max(
    1,
    Math.min(
      options?.limit ?? CONTEST_DETAIL_SUBMISSIONS_PAGE_SIZE,
      DEFAULT_CHUNK_SIZE,
    ),
  );
  const offset = Math.max(0, options?.offset ?? 0);
  const rangeTo = offset + limit - 1;

  const { data, error, count } = await buildContestTwitterTweetsQuery(
    supabase,
    select,
    contestId,
    { ...options, withCount: true },
  ).range(offset, rangeTo);

  if (error) {
    return {
      data: [],
      error,
      total: 0,
      limit,
      offset,
      hasMore: false,
    };
  }

  const rows = (data || []) as T[];
  const total = typeof count === "number" ? count : offset + rows.length;

  return {
    data: rows,
    error: null,
    total,
    limit,
    offset,
    hasMore: offset + rows.length < total,
  };
}
