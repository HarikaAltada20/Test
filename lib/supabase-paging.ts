/** PostgREST caps each response (1,000 rows by default), so list reads must page. */
export const READ_PAGE_SIZE = 1000;

type RangeableQuery<T> = {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>;
};

/** Reads every row of a query by paging with range(); `build` must apply a stable order. */
export async function fetchAllRows<T>(
  build: () => RangeableQuery<T>,
  pageSize = READ_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
