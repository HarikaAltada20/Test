import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchAllPostCampaignSubmissionIds } from "./post-campaign-metrics";

type MockPage = {
  data?: Array<{ submission_id: string }>;
  error?: { message: string } | null;
};

function createMockSupabase(pages: MockPage[]) {
  let pageIndex = 0;

  const terminal = {
    range: async (_from: number, _to: number) => {
      const page = pages[pageIndex++] ?? { data: [], error: null };
      return page;
    },
  };

  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const method of ["from", "select", "eq", "order"]) {
    chain[method] = self;
  }
  Object.assign(chain, terminal);

  return {
    supabase: chain,
    pagesConsumed: () => pageIndex,
  };
}

describe("fetchAllPostCampaignSubmissionIds", () => {
  it("returns empty set when overlay has no rows", async () => {
    const { supabase } = createMockSupabase([{ data: [] }]);
    const ids = await fetchAllPostCampaignSubmissionIds(supabase, "contest-1");
    assert.equal(ids.size, 0);
  });

  it("paginates past 1000 existing ids so row 1001 is not treated as missing", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      submission_id: `id-${i}`,
    }));
    const page2 = [{ submission_id: "id-1000" }];
    const { supabase, pagesConsumed } = createMockSupabase([
      { data: page1 },
      { data: page2 },
    ]);

    const ids = await fetchAllPostCampaignSubmissionIds(supabase, "contest-1");

    assert.equal(ids.size, 1001);
    assert.equal(ids.has("id-1000"), true);
    assert.equal(ids.has("id-0"), true);
    assert.equal(pagesConsumed(), 2);
  });

  it("throws when a page returns an error", async () => {
    const { supabase } = createMockSupabase([
      { data: null as unknown as undefined, error: { message: "boom" } },
    ]);
    await assert.rejects(
      () => fetchAllPostCampaignSubmissionIds(supabase, "contest-1"),
      /boom/,
    );
  });
});
