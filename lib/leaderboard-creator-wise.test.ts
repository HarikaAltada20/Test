import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aggregateCreatorsFromSubmissions } from "./leaderboard-creator-wise";

describe("aggregateCreatorsFromSubmissions", () => {
  const rows = [
    {
      creator_id: "darkvyn",
      views: 12_000_000,
      earnings: 0,
      status: "verified",
      platform: "youtube",
      created_at: "2026-08-15T00:00:00.000Z",
    },
    {
      creator_id: "darkvyn",
      views: 8_000_000,
      earnings: 0,
      status: "verified",
      platform: "instagram",
      created_at: "2026-08-16T00:00:00.000Z",
    },
    {
      creator_id: "darkvyn",
      views: 6_000_000,
      earnings: 0,
      status: "verified",
      platform: "tiktok",
      created_at: "2026-08-17T00:00:00.000Z",
    },
    {
      creator_id: "darkvyn",
      views: 505_447,
      earnings: 0,
      status: "verified",
      platform: "instagram",
      created_at: "2026-08-18T00:00:00.000Z",
    },
    {
      creator_id: "rrbaba07",
      views: 8_609_077,
      earnings: 0,
      status: "verified",
      platform: "instagram",
      created_at: "2026-08-15T00:00:00.000Z",
    },
    {
      creator_id: "professor",
      views: 9_000,
      earnings: 0,
      status: "verified",
      platform: "youtube",
      created_at: "2026-08-15T00:00:00.000Z",
    },
    {
      creator_id: "professor",
      views: 1_034,
      earnings: 0,
      status: "verified",
      platform: "tiktok",
      created_at: "2026-08-16T00:00:00.000Z",
    },
  ];

  it("on All tab keeps combined submission counts and views", () => {
    const result = aggregateCreatorsFromSubmissions(rows, 1, 25);
    const darkvyn = result.rows.find((row) => row.creator_id === "darkvyn");
    const professor = result.rows.find((row) => row.creator_id === "professor");
    assert.equal(result.totalEntries, 3);
    assert.equal(darkvyn?.submission_count, 4);
    assert.equal(darkvyn?.total_views, 26_505_447);
    assert.equal(professor?.submission_count, 2);
  });

  it("on Instagram tab only counts Instagram submissions and creators", () => {
    const result = aggregateCreatorsFromSubmissions(rows, 1, 25, "instagram");
    assert.equal(result.totalEntries, 2);
    assert.deepEqual(
      result.rows.map((row) => row.creator_id),
      ["rrbaba07", "darkvyn"],
    );
    assert.equal(result.rows[0].submission_count, 1);
    assert.equal(result.rows[0].total_views, 8_609_077);
    assert.equal(result.rows[0].platform, "instagram");
    assert.equal(result.rows[1].submission_count, 2);
    assert.equal(result.rows[1].total_views, 8_505_447);
    assert.equal(result.rows[1].platform, "instagram");
  });
});
