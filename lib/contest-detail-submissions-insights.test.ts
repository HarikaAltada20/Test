import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  loadContestDetailSubmissionsPage,
  stripCreatorInsights,
} from "./contest-detail-submissions";

const CREATOR_ID = "creator-1";

const submissionRow = {
  id: "sub-1",
  created_at: "2026-03-17T10:00:00Z",
  content_link: "https://www.instagram.com/reel/ABC123/",
  status: "verified",
  views: 1000,
  earnings: null,
  other_stats: {},
  platform: "instagram",
  video_id: null,
  video_thumbnail_url: null,
  video_title: null,
  creator_id: CREATOR_ID,
  quality_score: 4,
};

const profileRow = {
  id: CREATOR_ID,
  instagram_account: { username: "page_handle", name_of_account: "Page Name" },
  trust_score_metrics: { trust_score: 88 },
  avg_quality_score: 4.5,
  best_quality_score: 5,
  quality_score_sum: 20,
  total_money_won: 19899,
  total_views: 15_500_000,
};

/** Chainable stand-in for the Supabase query builder; records selects per table. */
function fakeSupabase(selects: Record<string, string[]>) {
  const rowsFor = (table: string) =>
    table === "submissions"
      ? [submissionRow]
      : table === "creator_profiles"
        ? [profileRow]
        : table === "users"
          ? [{ id: CREATOR_ID, username: "goc_user", full_name: "GoC User" }]
          : [];
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      for (const method of [
        "eq",
        "neq",
        "in",
        "or",
        "is",
        "not",
        "order",
        "range",
        "limit",
        "gte",
        "lte",
        "filter",
      ]) {
        builder[method] = chain;
      }
      builder.select = (columns: string) => {
        (selects[table] ??= []).push(columns);
        return builder;
      };
      builder.then = (resolve: (value: unknown) => void) =>
        resolve({ data: rowsFor(table), error: null, count: rowsFor(table).length });
      return builder;
    },
  };
}

const counts = {
  total: 1,
  pending: 0,
  verified: 1,
  rejected: 0,
  paid: 0,
} as unknown as NonNullable<
  Parameters<typeof loadContestDetailSubmissionsPage>[3]
>["counts"];

const contest = {
  platform: "instagram",
  contest_format: "video",
  contest_type: "cpm",
  contest_based_details: null,
};

describe("contest-detail submissions creator insights", () => {
  it("stripCreatorInsights blanks admin-only fields and keeps the rest", () => {
    const row = stripCreatorInsights({
      id: "x",
      quality_score: 4,
      trust_score: 90,
      trust_score_metrics: { trust_score: 90 },
      creator: {
        id: CREATOR_ID,
        username: "page_handle",
        trust_score: 90,
        avg_quality_score: 4.2,
        best_quality_score: 5,
        quality_score_sum: 12,
        total_money_won: 100,
        total_views: 5000,
      },
    });
    assert.equal(row.trust_score, null);
    assert.equal(row.trust_score_metrics, null);
    assert.equal(row.quality_score, 4);
    assert.equal(row.creator.username, "page_handle");
    assert.equal(row.creator.trust_score, null);
    assert.equal(row.creator.avg_quality_score, null);
    assert.equal(row.creator.best_quality_score, null);
    assert.equal(row.creator.quality_score_sum, null);
    assert.equal(row.creator.total_money_won, 0);
    assert.equal(row.creator.total_views, 0);
  });

  it("brand payload (default) never selects or returns creator insights", async () => {
    const selects: Record<string, string[]> = {};
    const page = await loadContestDetailSubmissionsPage(
      fakeSupabase(selects),
      "contest-1",
      contest,
      { counts },
    );
    assert.equal(page.errorMessage, undefined);
    assert.equal(page.submissions.length, 1);
    const profileSelect = (selects.creator_profiles ?? []).join(" ");
    for (const column of [
      "trust_score_metrics",
      "avg_quality_score",
      "best_quality_score",
      "quality_score_sum",
      "total_money_won",
      "total_views",
    ]) {
      assert.ok(!profileSelect.includes(column), `brand select includes ${column}`);
    }
    const row = page.submissions[0] as Record<string, any>;
    assert.equal(row.trust_score, null);
    assert.equal(row.creator.avg_quality_score, null);
    assert.equal(row.creator.total_money_won, 0);
    assert.equal(row.creator.total_views, 0);
    assert.equal(row.quality_score, 4);
    assert.equal(row.creator_username, "page_handle");
  });

  it("admin payload keeps creator insights", async () => {
    const selects: Record<string, string[]> = {};
    const page = await loadContestDetailSubmissionsPage(
      fakeSupabase(selects),
      "contest-1",
      contest,
      { counts, includeCreatorInsights: true },
    );
    const row = page.submissions[0] as Record<string, any>;
    assert.ok((selects.creator_profiles ?? []).join(" ").includes("total_money_won"));
    assert.equal(row.creator.total_money_won, 19899);
    assert.equal(row.creator.total_views, 15_500_000);
  });
});
