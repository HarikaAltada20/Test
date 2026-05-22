import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fetchContestSubmissionsAllPages,
  formatSubmissionFetchError,
} from "./fetch-contest-submissions";

type MockPage = { data?: Record<string, unknown>[]; error?: { message: string } | null };

function createMockSupabase(pages: MockPage[]) {
  let pageIndex = 0;
  const orderColumns: string[] = [];

  const terminal = {
    range: async (_from: number, _to: number) => {
      const page = pages[pageIndex++] ?? { data: [], error: null };
      return page;
    },
  };

  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const method of ["from", "select", "eq", "in", "neq"]) {
    chain[method] = self;
  }
  chain.order = (column: string) => {
    orderColumns.push(column);
    return chain;
  };
  Object.assign(chain, terminal);

  return {
    supabase: chain,
    orderColumns,
    pagesConsumed: () => pageIndex,
  };
}

describe("formatSubmissionFetchError", () => {
  it("reads message from PostgREST-style errors", () => {
    assert.equal(
      formatSubmissionFetchError({ message: "timeout" }),
      "timeout",
    );
  });

  it("falls back to a generic message", () => {
    assert.equal(formatSubmissionFetchError(null), "Failed to load submissions");
  });
});

describe("fetchContestSubmissionsAllPages", () => {
  it("returns empty data for zero rows", async () => {
    const { supabase } = createMockSupabase([{ data: [] }]);
    const result = await fetchContestSubmissionsAllPages(
      supabase,
      "contest-1",
      "id",
    );
    assert.deepEqual(result, { data: [], error: null, truncated: false });
  });

  it("paginates past 1000 rows", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `a-${i}` }));
    const page2 = [{ id: "a-1000" }];
    const { supabase, pagesConsumed } = createMockSupabase([
      { data: page1 },
      { data: page2 },
    ]);

    const result = await fetchContestSubmissionsAllPages(supabase, "contest-1", "id", {
      chunkSize: 1000,
    });

    assert.equal(result.error, null);
    assert.equal(result.data.length, 1001);
    assert.equal(pagesConsumed(), 2);
    assert.equal(result.truncated, false);
  });

  it("fail-fast on chunk error (no partial rows)", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `b-${i}` }));
    const { supabase } = createMockSupabase([
      { data: page1 },
      { data: [], error: { message: "page 2 failed" } },
    ]);

    const result = await fetchContestSubmissionsAllPages(supabase, "contest-1", "id", {
      chunkSize: 1000,
    });

    assert.equal(result.data.length, 0);
    assert.equal(
      formatSubmissionFetchError(result.error),
      "page 2 failed",
    );
    assert.equal(result.truncated, false);
  });

  it("sets truncated when maxRows cap is hit with a full last page", async () => {
    const fullPage = Array.from({ length: 10 }, (_, i) => ({ id: `c-${i}` }));
    const { supabase } = createMockSupabase([{ data: fullPage }]);

    const result = await fetchContestSubmissionsAllPages(supabase, "contest-1", "id", {
      chunkSize: 10,
      maxRows: 10,
    });

    assert.equal(result.data.length, 10);
    assert.equal(result.truncated, true);
  });

  it("appends id tie-break sort when caller omits it", async () => {
    const { supabase, orderColumns } = createMockSupabase([{ data: [{ id: "1" }] }]);
    await fetchContestSubmissionsAllPages(supabase, "contest-1", "id", {
      order: { column: "created_at", ascending: false },
    });
    assert.deepEqual(orderColumns, ["created_at", "id"]);
  });
});
