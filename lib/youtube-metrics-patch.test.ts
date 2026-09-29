import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { patchYouTubeMetrics } from "./youtube-metrics-patch";
import { buildYoutubeMetricsFromBasic, updateYouTubeSubmissionForScope } from "./youtube-submission-refresh-by-scope";

const now = "2026-09-23T07:50:00.000Z";
const rowPatch = { insights_status: "ok", last_insights_update: now, updated_at: now };

describe("YouTube refresh writes", () => {
  it("basic refresh sends only newly fetched basic fields, including zero", () => {
    assert.deepEqual(buildYoutubeMetricsFromBasic(20, 0, 0, now, null), {
      views: 20, likes: 0, comments: 0, last_basic_update: now,
    });
  });

  it("does not fall back to replacing JSON when the RPC is unavailable", async () => {
    const db = { rpc: async () => ({ data: null, error: { message: "RPC missing" } }) };
    assert.equal((await patchYouTubeMetrics(db as unknown as SupabaseClient, "id", {}, rowPatch)).error?.message, "RPC missing");
  });

  it("reports locked or missing rows as failures", async () => {
    const db = { rpc: async () => ({ data: false, error: null }) };
    assert.ok((await patchYouTubeMetrics(db as unknown as SupabaseClient, "id", {}, rowPatch)).error);
  });

  it("does not send stale analytics, bot scores, or reauth flags from a basic refresh", async () => {
    let args: any;
    const db = { rpc: async (_name: string, params: unknown) => {
      args = params;
      return { data: true, error: null };
    } };
    const result = await updateYouTubeSubmissionForScope(
      db as unknown as SupabaseClient,
      { id: "submission", creator_id: "creator", content_link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", views: 10,
        other_stats: { youtube: { traffic_sources: { SHORTS: 10 }, demographics: { gender: { male: 60 } }, bot_score: 75, analytics_needs_reauth: true } } },
      "unused-token", "basic", now,
      { prefetchedBasic: { viewCount: 30, likeCount: 2, commentCount: 1 } },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(args.p_youtube_patch, { views: 30, likes: 2, comments: 1, last_basic_update: now });
    assert.equal(args.p_row_patch.views, 30);
    assert.equal(args.p_post_campaign, false);
  });

  it("private-video failures patch error metadata without copying old metrics", async () => {
    let args: any;
    const db = { rpc: async (_name: string, params: unknown) => {
      args = params;
      return { data: true, error: null };
    } };
    const result = await updateYouTubeSubmissionForScope(
      db as unknown as SupabaseClient,
      { id: "submission", creator_id: "creator", content_link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", views: 10,
        other_stats: { youtube: { views: 10, traffic_sources: { SHORTS: 10 } } } },
      "unused-token", "basic", now,
      { prefetchedBasic: { viewCount: 0, likeCount: 0, commentCount: 0, isPrivate: true }, metricsTarget: "post_campaign_submission_metrics" },
    );
    assert.equal(result.ok, false);
    assert.deepEqual(Object.keys(args.p_youtube_patch), ["insights_error"]);
    assert.equal(args.p_row_patch.views, undefined);
    assert.equal(args.p_post_campaign, true);
  });
});
