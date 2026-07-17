import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchAllPostCampaignSubmissionIds,
  syncPostCampaignFromSubmissions,
} from "./post-campaign-metrics";

type MockPage = {
  data?: Array<{ submission_id: string }>;
  error?: { message: string } | null;
};

function createIdPagerMock(pages: MockPage[]) {
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
    const { supabase } = createIdPagerMock([{ data: [] }]);
    const ids = await fetchAllPostCampaignSubmissionIds(supabase, "contest-1");
    assert.equal(ids.size, 0);
  });

  it("paginates past 1000 existing ids so row 1001 is not treated as missing", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      submission_id: `id-${i}`,
    }));
    const page2 = [{ submission_id: "id-1000" }];
    const { supabase, pagesConsumed } = createIdPagerMock([
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
    const { supabase } = createIdPagerMock([
      { data: null as unknown as undefined, error: { message: "boom" } },
    ]);
    await assert.rejects(
      () => fetchAllPostCampaignSubmissionIds(supabase, "contest-1"),
      /boom/,
    );
  });
});

describe("syncPostCampaignFromSubmissions RPC", () => {
  it("uses sync_post_campaign_from_submissions when available", async () => {
    let rpcCalled = false;
    const supabase = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalled = true;
        assert.equal(name, "sync_post_campaign_from_submissions");
        assert.equal(args.p_contest_id, "contest-1");
        assert.equal(args.p_overwrite_metrics, false);
        return {
          data: [{ synced: 42, inserted: 10, updated: 32 }],
          error: null,
        };
      },
    };

    const result = await syncPostCampaignFromSubmissions(supabase, "contest-1");
    assert.equal(rpcCalled, true);
    assert.deepEqual(result, { synced: 42, inserted: 10, updated: 32 });
  });

  it("passes overwriteMetrics to the RPC", async () => {
    const supabase = {
      rpc: async (_name: string, args: Record<string, unknown>) => {
        assert.equal(args.p_overwrite_metrics, true);
        return {
          data: [{ synced: 1, inserted: 0, updated: 1 }],
          error: null,
        };
      },
    };

    const result = await syncPostCampaignFromSubmissions(supabase, "contest-1", {
      overwriteMetrics: true,
    });
    assert.deepEqual(result, { synced: 1, inserted: 0, updated: 1 });
  });

  it("falls back when RPC is missing (PGRST202) without throwing", async () => {
    const upsertChunks: unknown[][] = [];
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["from", "select", "eq", "order", "in", "neq"]) {
      chain[method] = self;
    }
    chain.order = () => chain;
    chain.range = async () => ({ data: [], error: null });
    chain.upsert = async (chunk: unknown[]) => {
      upsertChunks.push(chunk as unknown[]);
      return { error: null };
    };

    const supabase = {
      rpc: async () => ({
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find the function sync_post_campaign_from_submissions",
        },
      }),
      from: (table: string) => {
        if (table === "submissions") {
          // fetchContestSubmissionsAllPages uses from().select()...range()
          const subChain: Record<string, unknown> = {};
          const subSelf = () => subChain;
          for (const method of ["select", "eq", "order", "in", "neq"]) {
            subChain[method] = subSelf;
          }
          subChain.range = async () => ({
            data: [
              {
                id: "s1",
                creator_id: "c1",
                contest_id: "contest-1",
                content_link: null,
                views: 5,
                metadata: null,
                other_stats: {},
                created_at: "2026-01-01T00:00:00.000Z",
                video_id: "v1",
                video_title: null,
                video_thumbnail_url: null,
                updated_at: "2026-01-01T00:00:00.000Z",
                platform: "instagram",
                last_insights_update: null,
                insights_status: null,
                status: "verified",
                earnings: 0,
                views_locked: null,
                affiliate_paid: false,
                affiliate_metadata: null,
                paid: false,
                paid_at: null,
                bonus_paid: false,
                bonus_paid_at: null,
                bonus_amount: 0,
                milestone_bonus_paid: null,
                dual_rewards_payout: null,
                quality_score: null,
                quality_score_backfilled: false,
              },
            ],
            error: null,
          });
          return subChain;
        }
        return chain;
      },
    };

    const result = await syncPostCampaignFromSubmissions(supabase, "contest-1");
    assert.equal(result.synced, 1);
    assert.equal(result.inserted, 1);
    assert.equal(result.updated, 0);
    assert.equal(upsertChunks.length, 1);
    assert.equal((upsertChunks[0][0] as { submission_id: string }).submission_id, "s1");
  });
});
