import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateSubmissionQualityRows,
  computePersistableQualityProfileValues,
  requireVerifyQualityScore,
  resolveVerifyQualityScore,
  resolveVerifyQualityScoreWithMeta,
  resolveCreatorQualityMetrics,
} from "./quality-score";

describe("requireVerifyQualityScore", () => {
  it("returns null when score is missing or invalid", () => {
    assert.equal(requireVerifyQualityScore(undefined), null);
    assert.equal(requireVerifyQualityScore(null), null);
    assert.equal(requireVerifyQualityScore(0), null);
    assert.equal(requireVerifyQualityScore(4), null);
  });

  it("accepts scores 1 through 3", () => {
    assert.equal(requireVerifyQualityScore(1), 1);
    assert.equal(requireVerifyQualityScore("2"), 2);
    assert.equal(requireVerifyQualityScore(3), 3);
  });
});

describe("resolveVerifyQualityScore", () => {
  it("defaults missing values to 1 for backward-compatible verify calls", () => {
    assert.equal(resolveVerifyQualityScore(undefined), 1);
    assert.equal(resolveVerifyQualityScore(null), 1);
    assert.equal(resolveVerifyQualityScore(""), 1);
  });

  it("accepts scores 1 through 3", () => {
    assert.equal(resolveVerifyQualityScore(2), 2);
    assert.equal(resolveVerifyQualityScore("3"), 3);
  });

  it("returns null for invalid explicit values", () => {
    assert.equal(resolveVerifyQualityScore(0), null);
    assert.equal(resolveVerifyQualityScore(4), null);
    assert.equal(resolveVerifyQualityScore("high"), null);
  });
});

describe("resolveVerifyQualityScoreWithMeta", () => {
  it("marks omitted values as defaulted", () => {
    assert.deepEqual(resolveVerifyQualityScoreWithMeta(undefined), {
      score: 1,
      defaulted: true,
    });
  });

  it("does not mark explicit scores as defaulted", () => {
    assert.deepEqual(resolveVerifyQualityScoreWithMeta(2), {
      score: 2,
      defaulted: false,
    });
  });
});

describe("computePersistableQualityProfileValues", () => {
  it("defaults to 1/1 for new creators with no verified or rejected reels", () => {
    assert.deepEqual(
      computePersistableQualityProfileValues({
        verifiedReels: 0,
        rejectedReels: 0,
        scoredQualityScores: [],
      }),
      { avg_quality_score: 1, best_quality_score: 1 },
    );
  });

  it("returns null when rejected but none verified", () => {
    assert.deepEqual(
      computePersistableQualityProfileValues({
        verifiedReels: 0,
        rejectedReels: 2,
        scoredQualityScores: [],
      }),
      { avg_quality_score: null, best_quality_score: null },
    );
  });

  it("computes avg and best from verified scored submissions", () => {
    assert.deepEqual(
      computePersistableQualityProfileValues({
        verifiedReels: 3,
        rejectedReels: 1,
        scoredQualityScores: [1, 2, 3],
      }),
      { avg_quality_score: 2, best_quality_score: 3 },
    );
  });

  it("returns null when verified reels exist but none are scored yet", () => {
    assert.deepEqual(
      computePersistableQualityProfileValues({
        verifiedReels: 2,
        rejectedReels: 0,
        scoredQualityScores: [],
      }),
      { avg_quality_score: null, best_quality_score: null },
    );
  });
});

describe("resolveCreatorQualityMetrics", () => {
  it("matches persistable defaults for new creators", () => {
    const resolved = resolveCreatorQualityMetrics({
      verifiedReels: 0,
      rejectedReels: 0,
      avgQualityScore: 1,
      bestQualityScore: 1,
    });
    assert.equal(resolved.avg_quality_score, 1);
    assert.equal(resolved.best_quality_score, 1);
  });
});

describe("aggregateSubmissionQualityRows", () => {
  it("counts verified, rejected, and scored quality values", () => {
    assert.deepEqual(
      aggregateSubmissionQualityRows([
        { status: "verified", quality_score: 2 },
        { status: "paid", quality_score: 3 },
        { status: "rejected", quality_score: null },
        { status: "pending", quality_score: null },
      ]),
      {
        verifiedReels: 2,
        rejectedReels: 1,
        scoredQualityScores: [2, 3],
      },
    );
  });

  it("excludes migration-backfilled scores from aggregates", () => {
    assert.deepEqual(
      aggregateSubmissionQualityRows([
        { status: "verified", quality_score: 1, quality_score_backfilled: true },
        { status: "verified", quality_score: 1, quality_score_backfilled: true },
        { status: "verified", quality_score: 3, quality_score_backfilled: false },
      ]),
      {
        verifiedReels: 3,
        rejectedReels: 0,
        scoredQualityScores: [3],
      },
    );
  });
});
