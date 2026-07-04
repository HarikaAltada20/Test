import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addCreatorMetricsDeltas,
  applyCreatorMetricsDeltaToCounters,
  buildCreatorProfileMetricsFromCounters,
  computeSubmissionMetricsDelta,
  submissionMetricsContribution,
} from "./creator-metrics-delta";

describe("computeSubmissionMetricsDelta", () => {
  it("increments verified and quality on pending → verified with score", () => {
    const delta = computeSubmissionMetricsDelta(
      { status: "pending", quality_score: null },
      { status: "verified", quality_score: 3 },
    );
    assert.equal(delta.pending_reels, -1);
    assert.equal(delta.verified_reels, 1);
    assert.equal(delta.total_reels, 0);
    assert.equal(delta.quality_score_sum, 3);
    assert.equal(delta.scored_verified_count, 1);
    assert.equal(delta.quality_score_counts.score3, 1);
  });

  it("moves verified scored row to rejected and removes quality", () => {
    const delta = computeSubmissionMetricsDelta(
      { status: "verified", quality_score: 2 },
      { status: "rejected", quality_score: null },
    );
    assert.equal(delta.verified_reels, -1);
    assert.equal(delta.rejected_reels, 1);
    assert.equal(delta.quality_score_sum, -2);
    assert.equal(delta.scored_verified_count, -1);
    assert.equal(delta.quality_score_counts.score2, -1);
  });

  it("swaps quality tier on verified score edit", () => {
    const delta = computeSubmissionMetricsDelta(
      { status: "verified", quality_score: 2 },
      { status: "verified", quality_score: 3 },
    );
    assert.equal(delta.verified_reels, 0);
    assert.equal(delta.quality_score_sum, 1);
    assert.equal(delta.scored_verified_count, 0);
    assert.equal(delta.quality_score_counts.score2, -1);
    assert.equal(delta.quality_score_counts.score3, 1);
  });

  it("treats paid like verified for trust buckets", () => {
    const delta = computeSubmissionMetricsDelta(
      { status: "verified", quality_score: 1 },
      { status: "paid", quality_score: 1 },
    );
    assert.deepEqual(delta, {
      total_reels: 0,
      verified_reels: 0,
      rejected_reels: 0,
      pending_reels: 0,
      quality_score_sum: 0,
      scored_verified_count: 0,
      quality_score_counts: { score1: 0, score2: 0, score3: 0 },
    });
  });

  it("counts new pending submission on insert", () => {
    const delta = computeSubmissionMetricsDelta(null, {
      status: "pending",
      quality_score: null,
    });
    assert.equal(delta.total_reels, 1);
    assert.equal(delta.pending_reels, 1);
  });

  it("ignores legacy unscored and placeholder quality on verified submissions", () => {
    const unscored = submissionMetricsContribution({
      status: "verified",
      quality_score: null,
    });
    assert.equal(unscored.verified_reels, 1);
    assert.equal(unscored.quality_score_sum, 0);

    const placeholder = submissionMetricsContribution({
      status: "verified",
      quality_score: 1,
      quality_score_backfilled: true,
    });
    assert.equal(placeholder.verified_reels, 1);
    assert.equal(placeholder.quality_score_sum, 0);
    assert.equal(placeholder.scored_verified_count, 0);
  });
});

describe("buildCreatorProfileMetricsFromCounters", () => {
  it("computes avg and best from incremental counters", () => {
    const counters = applyCreatorMetricsDeltaToCounters(
      {
        total_reels: 0,
        verified_reels: 0,
        rejected_reels: 0,
        pending_reels: 0,
        quality_score_sum: 0,
        scored_verified_count: 0,
        quality_score_counts: { score1: 0, score2: 0, score3: 0 },
      },
      addCreatorMetricsDeltas(
        submissionMetricsContribution({
          status: "verified",
          quality_score: 1,
        }),
        submissionMetricsContribution({
          status: "verified",
          quality_score: 3,
        }),
      ),
    );

    const profile = buildCreatorProfileMetricsFromCounters(counters);
    assert.equal(profile.avg_quality_score, 2);
    assert.equal(profile.best_quality_score, 3);
    assert.equal(profile.quality_score_sum, 4);
    assert.equal(profile.trust_score_metrics.verified_reels, 2);
    assert.equal(profile.trust_score_metrics.trust_number, 2);
    assert.equal(profile.trust_score_metrics.trust_score, 100);
  });
});
