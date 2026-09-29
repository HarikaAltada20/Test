import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSupportedVideoUrl,
  zipPartFilename,
  resolveBulkDownloadItems,
} from "./bulk-download-resolve-items";
import type { DownloadAccessUser } from "./video-download-auth";

describe("isSupportedVideoUrl", () => {
  it("accepts Instagram and YouTube URLs", () => {
    assert.deepEqual(isSupportedVideoUrl("https://www.instagram.com/reel/abc"), {
      ok: true,
      isInstagram: true,
    });
    assert.deepEqual(
      isSupportedVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      { ok: true, isInstagram: false },
    );
    assert.deepEqual(isSupportedVideoUrl("https://youtu.be/dQw4w9WgXcQ"), {
      ok: true,
      isInstagram: false,
    });
  });

  it("rejects unsupported hosts", () => {
    assert.deepEqual(isSupportedVideoUrl("https://vimeo.com/123"), { ok: false });
  });
});

describe("zipPartFilename", () => {
  it("omits part suffix for a single archive", () => {
    assert.equal(zipPartFilename("My Contest", 1, 1), "My_Contest.zip");
  });

  it("adds part indexes for multi-ZIP", () => {
    assert.match(zipPartFilename("contest", 2, 3), /_part_2_of_3\.zip$/i);
  });
});

describe("resolveBulkDownloadItems", () => {
  const admin: DownloadAccessUser = {
    id: "admin-1",
    email: "a@example.com",
    user_type: "admin",
  };
  const brand: DownloadAccessUser = {
    id: "brand-1",
    email: "b@example.com",
    user_type: "advertiser",
  };

  function mockSupabase(rows: Array<Record<string, unknown>>) {
    return {
      from() {
        return {
          select() {
            return {
              in(_col: string, ids: string[]) {
                const idSet = new Set(ids);
                const data = rows.filter((row) => idSet.has(String(row.id)));
                return Promise.resolve({ data, error: null });
              },
            };
          },
        };
      },
    } as never;
  }

  it("preserves selection order and rejects not_owned / missing", async () => {
    const rows = [
      {
        id: "s2",
        content_link: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
        platform: "youtube",
        views: 50,
        status: "verified",
        quality_score: 3,
        contests: { id: "c1", title: "Demo", advertiser_id: "brand-1" },
        users: { username: "alice" },
      },
      {
        id: "s1",
        content_link: "https://www.youtube.com/watch?v=bbbbbbbbbbb",
        platform: "youtube",
        views: 100,
        status: "verified",
        quality_score: 4,
        contests: { id: "c1", title: "Demo", advertiser_id: "other-brand" },
        users: { username: "bob" },
      },
    ];

    const resolved = await resolveBulkDownloadItems({
      supabase: mockSupabase(rows),
      user: brand,
      submissionIds: ["s1", "s2", "missing"],
      urls: [],
      namingPattern: "views",
      format: "mp4",
    });

    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.result.contestTitle, "Demo");
    assert.equal(resolved.result.items.length, 1);
    assert.equal(resolved.result.items[0].submissionId, "s2");
    assert.equal(resolved.result.accepted.length, 1);
    assert.equal(resolved.result.rejected.length, 2);
    assert.equal(
      resolved.result.rejected.find((r) => r.submissionId === "s1")?.reason,
      "not_owned",
    );
    assert.equal(
      resolved.result.rejected.find((r) => r.submissionId === "missing")?.reason,
      "not_found",
    );
  });

  it("accepts admin custom URLs and rejects unsupported", async () => {
    const resolved = await resolveBulkDownloadItems({
      supabase: mockSupabase([]),
      user: admin,
      submissionIds: [],
      urls: [
        "https://www.youtube.com/watch?v=ccccccccccc",
        "https://example.com/video",
        "https://www.instagram.com/reel/xyz",
      ],
      namingPattern: "views",
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.result.items.length, 2);
    assert.equal(resolved.result.items[0].isInstagram, false);
    assert.equal(resolved.result.items[1].isInstagram, true);
    assert.equal(resolved.result.rejected.length, 1);
    assert.equal(resolved.result.rejected[0].reason, "unsupported_url");
  });

  it("rejects missing content links", async () => {
    const rows = [
      {
        id: "s1",
        content_link: null,
        platform: "youtube",
        views: 1,
        status: "pending",
        quality_score: null,
        contests: { id: "c1", title: "T", advertiser_id: "brand-1" },
        users: { username: "x" },
      },
    ];
    const resolved = await resolveBulkDownloadItems({
      supabase: mockSupabase(rows),
      user: admin,
      submissionIds: ["s1"],
      urls: [],
      namingPattern: "views",
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.result.items.length, 0);
    assert.equal(resolved.result.rejected[0]?.reason, "missing_url");
  });
});
