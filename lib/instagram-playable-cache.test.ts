import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { ResolveInstagramVideoResult } from "./instagram-download/graphql";
import {
  getPlayableInstagramVideo,
  PLAYABLE_PER_USER_PER_MINUTE,
  resetInstagramPlayableCacheForTests,
  setInstagramPlayableResolverForTests,
} from "./instagram-playable-cache";

function okResult(shortcode: string): ResolveInstagramVideoResult {
  return {
    ok: true,
    shortcode,
    videoUrl: `https://cdn.example/${shortcode}.mp4`,
    data: {
      xdt_shortcode_media: {
        id: "1",
        shortcode,
        is_video: true,
        video_url: `https://cdn.example/${shortcode}.mp4`,
        display_url: `https://cdn.example/${shortcode}.jpg`,
        thumbnail_src: "",
        video_duration: 12,
        video_view_count: 0,
        video_play_count: 0,
        owner: {
          id: "o",
          username: "owner",
          full_name: "Owner",
          is_verified: false,
          profile_pic_url: "",
        },
      },
    },
  };
}

function failResult(
  error: "notFound" | "notVideo" | "tooManyRequests" | "serverError",
): ResolveInstagramVideoResult {
  return { ok: false, error, message: error, status: 500 } as ResolveInstagramVideoResult;
}

describe("instagram-playable-cache", () => {
  beforeEach(() => resetInstagramPlayableCacheForTests());

  it("caches successful lookups", async () => {
    let calls = 0;
    setInstagramPlayableResolverForTests(async (code) => {
      calls += 1;
      return okResult(code);
    });
    const first = await getPlayableInstagramVideo("AAA", "u1");
    const second = await getPlayableInstagramVideo("AAA", "u2");
    assert.equal(calls, 1);
    assert.deepEqual(first, {
      ok: true,
      videoUrl: "https://cdn.example/AAA.mp4",
      thumbnailUrl: "https://cdn.example/AAA.jpg",
    });
    assert.deepEqual(second, first);
  });

  it("caches not-found answers so blocked reels don't re-hit Instagram", async () => {
    let calls = 0;
    setInstagramPlayableResolverForTests(async () => {
      calls += 1;
      return failResult("notFound");
    });
    const first = await getPlayableInstagramVideo("BBB", "u1");
    const second = await getPlayableInstagramVideo("BBB", "u1");
    assert.equal(calls, 1);
    assert.deepEqual(first, { ok: false, reason: "notFound" });
    assert.deepEqual(second, { ok: false, reason: "notFound" });
  });

  it("shares one in-flight lookup for concurrent requests", async () => {
    let calls = 0;
    setInstagramPlayableResolverForTests(async (code) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return okResult(code);
    });
    const results = await Promise.all([
      getPlayableInstagramVideo("CCC", "u1"),
      getPlayableInstagramVideo("CCC", "u2"),
      getPlayableInstagramVideo("CCC", "u3"),
    ]);
    assert.equal(calls, 1);
    for (const r of results) assert.equal(r.ok, true);
  });

  it("limits uncached lookups per user", async () => {
    setInstagramPlayableResolverForTests(async (code) => okResult(code));
    for (let i = 0; i < PLAYABLE_PER_USER_PER_MINUTE; i++) {
      const r = await getPlayableInstagramVideo(`U${i}`, "heavy-user");
      assert.equal(r.ok, true, `expected ok at ${i}`);
    }
    const blocked = await getPlayableInstagramVideo("OVER", "heavy-user");
    assert.deepEqual(blocked, { ok: false, reason: "rateLimited" });
    const otherUser = await getPlayableInstagramVideo("OVER", "light-user");
    assert.equal(otherUser.ok, true);
  });

  it("enters a global cooldown after Instagram returns 429", async () => {
    let calls = 0;
    setInstagramPlayableResolverForTests(async () => {
      calls += 1;
      return failResult("tooManyRequests");
    });
    const first = await getPlayableInstagramVideo("DDD", "u1");
    assert.deepEqual(first, { ok: false, reason: "cooldown" });
    const second = await getPlayableInstagramVideo("EEE", "u2");
    assert.deepEqual(second, { ok: false, reason: "cooldown" });
    assert.equal(calls, 1);
  });
});
