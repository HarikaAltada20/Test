/**
 * PostgREST (Supabase) caps every response at `max_rows` (1000 by default) and
 * silently drops the rest, for table selects and set-returning RPCs alike.
 * Use this to read every row of a query that can exceed that cap.
 */
export const SUPABASE_MAX_ROWS = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string; code?: string } | null;
};

/**
 * `buildPage(from, to)` must return a fresh query with `.range(from, to)` and a
 * deterministic `.order(...)` (unique sort key), otherwise rows can be skipped
 * or repeated between pages.
 */
export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = SUPABASE_MAX_ROWS,
): Promise<PageResult<T> & { data: T[] }> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildPage(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return { data: rows, error: null };
}
