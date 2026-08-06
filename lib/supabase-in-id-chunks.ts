/**
 * PostgREST `.in("id", …)` is sent in the request URL/filter.
 * Large UUID lists fail in production (HTTP 500 / statement timeouts).
 * Keep chunks under this size across payment + moderation paths.
 */
export const SUPABASE_IN_ID_CHUNK_SIZE = 100;

export function chunkIds<T>(
  ids: readonly T[],
  size: number = SUPABASE_IN_ID_CHUNK_SIZE,
): T[][] {
  if (ids.length === 0) return [];
  const chunkSize = Math.max(1, size);
  const chunks: T[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize) as T[]);
  }
  return chunks;
}

type ChunkQueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/**
 * Run the same `.in("id", chunk)` query for every chunk and concatenate rows.
 */
export async function fetchByIdsInChunks<T>(params: {
  ids: readonly string[];
  chunkSize?: number;
  fetchChunk: (chunkIds: string[]) => PromiseLike<ChunkQueryResult<T>>;
}): Promise<{ data: T[]; error: { message: string } | null }> {
  const uniqueIds = Array.from(
    new Set(params.ids.map((id) => String(id || "").trim()).filter(Boolean)),
  );
  if (uniqueIds.length === 0) {
    return { data: [], error: null };
  }

  const allRows: T[] = [];
  for (const chunk of chunkIds(
    uniqueIds,
    params.chunkSize ?? SUPABASE_IN_ID_CHUNK_SIZE,
  )) {
    const { data, error } = await params.fetchChunk(chunk);
    if (error) {
      return { data: [], error };
    }
    if (data?.length) {
      allRows.push(...data);
    }
  }

  return { data: allRows, error: null };
}
