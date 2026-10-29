import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  finalRefreshRequiredMessage,
  platformsMissingRefreshAfterEnd,
  requiresFinalRefreshBeforeReview,
} from "./highest-platform-review-gate";

const contest = {
  contest_type: "cpm",
  platform: "youtube,instagram",
  contest_based_details: { highest_platform_payout_only: true },
  views_locked_at: null as string | null,
};

/**
 * Minimal Supabase stand-in: records filters, returns rows per table, and
 * `eligibleCount` for the eligible-submissions count query.
 */
function fakeSupabase(
  rowsByTable: Record<string, unknown[]>,
  eligibleCount = 1,
) {
  const calls: Array<{ table: string; filters: unknown[][] }> = [];
  return {
    calls,
    from(table: string) {
      const call = { table, filters: [] as unknown[][] };
      calls.push(call);
      const record =
        (name: string) =>
        (...args: unknown[]) => (call.filters.push([name, ...args]), query);
      const query = {
        select: () => query,
        eq: record("eq"),
        neq: record("neq"),
        gt: record("gt"),
        in: record("in"),
        or: record("or"),
        not: record("not"),
        ilike: record("ilike"),
        limit: async () => ({ data: rowsByTable[table] ?? [], error: null }),
        then: (resolve: (value: unknown) => void) =>
          resolve({ count: eligibleCount, error: null }),
      };
      return query;
    },
  };
}

describe("highest-platform review gate", () => {
  it("applies only when a switch-on campaign first freezes views", () => {
    assert.equal(requiresFinalRefreshBeforeReview(contest, null, "in_review"), true);
    assert.equal(
      requiresFinalRefreshBeforeReview(contest, "pending_review", "in_review"),
      true,
    );
    assert.equal(
      requiresFinalRefreshBeforeReview(contest, "pending_review", "verification_complete"),
      true,
    );
    // Already frozen: refreshes are no longer possible, nothing to check.
    assert.equal(
      requiresFinalRefreshBeforeReview(contest, "in_review", "verification_complete"),
      false,
    );
    assert.equal(
      requiresFinalRefreshBeforeReview(
        { ...contest, views_locked_at: "2026-10-01T00:00:00Z" },
        "pending_review",
        "in_review",
      ),
      false,
    );
    assert.equal(
      requiresFinalRefreshBeforeReview(contest, null, "pending_review"),
      false,
    );
    assert.equal(
      requiresFinalRefreshBeforeReview(
        { ...contest, contest_based_details: {} },
        null,
        "in_review",
      ),
      false,
    );
  });

  it("names every campaign platform in the message", () => {
    assert.equal(
      finalRefreshRequiredMessage(["youtube", "instagram"]),
      "Refresh every platform (YouTube, Instagram) after the campaign end date before starting review, so each creator's best platform uses final views.",
    );
  });

  it("reports platforms without a completed refresh after the end date", async () => {
    const supabase = fakeSupabase({
      youtube_metrics_refresh_runs: [{ id: "run-yt" }],
      instagram_insights_refresh_runs: [],
    });
    const result = await platformsMissingRefreshAfterEnd(
      supabase,
      "contest-1",
      ["youtube", "instagram"],
      "2026-10-01T00:00:00Z",
    );
    assert.deepEqual(result, { missing: ["instagram"], error: null });

    const yt = supabase.calls.find(
      (c) => c.table === "youtube_metrics_refresh_runs",
    )!;
    assert.deepEqual(yt.filters, [
      ["eq", "contest_id", "contest-1"],
      ["eq", "status", "completed"],
      ["gt", "started_at", "2026-10-01T00:00:00Z"],
      ["or", "metrics_target.is.null,metrics_target.eq.submissions"],
      ["in", "scope", ["basic", "all", "all_standard"]],
    ]);
  });

  it("skips a platform that has no submissions to refresh", async () => {
    const supabase = fakeSupabase(
      {
        youtube_metrics_refresh_runs: [{ id: "run-yt" }],
        tiktok_metrics_refresh_runs: [],
      },
      0,
    );
    const result = await platformsMissingRefreshAfterEnd(
      supabase,
      "contest-1",
      ["youtube", "tiktok"],
      "2026-10-01T00:00:00Z",
    );
    assert.deepEqual(result, { missing: [], error: null });
  });
});
