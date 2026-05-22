/** PostgREST/Supabase returns at most 1000 rows per request without `.range()`. */
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_MAX_ROWS = 50_000;

export async function fetchContestSubmissionsAllPages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  contestId: string,
  select: string,
  options?: { chunkSize?: number; maxRows?: number },
): Promise<{ data: Record<string, unknown>[]; error: unknown }> {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
  const rows: Record<string, unknown>[] = [];
  let rangeFrom = 0;

  while (rows.length < maxRows) {
    const rangeTo = Math.min(rangeFrom + chunkSize - 1, maxRows - 1);
    const { data: chunk, error } = await supabase
      .from("submissions")
      .select(select)
      .eq("contest_id", contestId)
      .order("created_at", { ascending: false })
      .range(rangeFrom, rangeTo);

    if (error) {
      return { data: rows, error };
    }

    const page = (chunk || []) as Record<string, unknown>[];
    if (page.length === 0) break;

    rows.push(...page);
    if (page.length < chunkSize) break;
    rangeFrom += chunkSize;
  }

  return { data: rows, error: null };
}
