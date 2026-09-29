import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLastOkScopesPatch,
  getYoutubeSkipRecentOkMs,
  shouldSkipRecentOkYouTubeRefresh,
  YT_SKIP_RECENT_OK_DEFAULT_MS,
} from "./youtube-skip-recent-ok";

describe("youtube-skip-recent-ok", () => {
  it("defaults skip window to 10 minutes", () => {
    const prev = process.env.YT_SKIP_RECENT_OK_MS;
    delete process.env.YT_SKIP_RECENT_OK_MS;
    try {
      assert.equal(getYoutubeSkipRecentOkMs(), YT_SKIP_RECENT_OK_DEFAULT_MS);
    } finally {
      if (prev === undefined) delete process.env.YT_SKIP_RECENT_OK_MS;
      else process.env.YT_SKIP_RECENT_OK_MS = prev;
    }
  });

  it("skips ok + fresh stamp for the same scope", () => {
    const nowMs = Date.parse("2026-09-26T10:00:00.000Z");
    assert.equal(
      shouldSkipRecentOkYouTubeRefresh({
        scope: "core",
        insightsStatus: "ok",
        otherStats: {
          youtube: {
            last_ok_scopes: { core: "2026-09-26T09:55:00.000Z" },
          },
        },
        nowMs,
        maxAgeMs: 10 * 60 * 1000,
      }),
      true,
    );
  });

  it("does not skip temporary_failure even with a fresh stamp", () => {
    const nowMs = Date.parse("2026-09-26T10:00:00.000Z");
    assert.equal(
      shouldSkipRecentOkYouTubeRefresh({
        scope: "core",
        insightsStatus: "temporary_failure",
        otherStats: {
          youtube: {
            last_ok_scopes: { core: "2026-09-26T09:55:00.000Z" },
          },
        },
        nowMs,
      }),
      false,
    );
  });

  it("does not skip ok basic when running core", () => {
    const nowMs = Date.parse("2026-09-26T10:00:00.000Z");
    assert.equal(
      shouldSkipRecentOkYouTubeRefresh({
        scope: "core",
        insightsStatus: "ok",
        otherStats: {
          youtube: {
            last_ok_scopes: { basic: "2026-09-26T09:55:00.000Z" },
          },
        },
        nowMs,
      }),
      false,
    );
  });

  it("does not skip when stamp for scope is missing", () => {
    assert.equal(
      shouldSkipRecentOkYouTubeRefresh({
        scope: "traffic",
        insightsStatus: "ok",
        otherStats: { youtube: { views: 1 } },
        nowMs: Date.now(),
      }),
      false,
    );
  });

  it("does not skip when stamp is older than the window", () => {
    const nowMs = Date.parse("2026-09-26T10:00:00.000Z");
    assert.equal(
      shouldSkipRecentOkYouTubeRefresh({
        scope: "all",
        insightsStatus: "ok",
        otherStats: {
          youtube: {
            last_ok_scopes: { all: "2026-09-26T09:00:00.000Z" },
          },
        },
        nowMs,
        maxAgeMs: 10 * 60 * 1000,
      }),
      false,
    );
  });

  it("buildLastOkScopesPatch merges only the current scope key", () => {
    const patch = buildLastOkScopesPatch(
      "demographics",
      "2026-09-26T10:00:00.000Z",
      {
        last_ok_scopes: { basic: "2026-09-26T09:00:00.000Z" },
      },
    );
    assert.deepEqual(patch, {
      basic: "2026-09-26T09:00:00.000Z",
      demographics: "2026-09-26T10:00:00.000Z",
    });
  });
});
