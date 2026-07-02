import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCreatorRequirements,
  isCreatorEligibleForContest,
  parseContestCreatorRequirements,
  buildCreatorRequirementsSnapshotFromProfile,
} from "./creator-requirements";
import { getCreatorStatsFromProfile } from "./creator-profile-stats";

const baseSnapshot = {
  trustScorePct: 100,
  trustNumber: 5,
  avgQualityScore: 1,
  bestQualityScore: 1,
  totalPlatformEarningsCents: 10_000,
  totalViews: 50_000,
  verifiedReels: 5,
  rejectedReels: 0,
  pendingReels: 0,
};

describe("parseContestCreatorRequirements", () => {
  it("ignores requirements for text_image campaigns", () => {
    const req = parseContestCreatorRequirements({
      contest_format: "text_image",
      trust_score: 80,
      min_best_quality_score: 2,
      min_platform_earnings: 5000,
    });
    assert.equal(req.minTrustScorePct, null);
    assert.equal(req.minBestQuality, null);
    assert.equal(req.minPlatformEarningsCents, null);
  });

  it("parses video campaign minimums", () => {
    const req = parseContestCreatorRequirements({
      contest_format: "video",
      trust_score: 80,
      trust_number: 3,
      min_best_quality_score: 2,
      min_avg_quality_score: 1.5,
      min_platform_earnings: 5000,
      min_platform_views: 1000,
    });
    assert.equal(req.minTrustScorePct, 80);
    assert.equal(req.minTrustNumber, 3);
    assert.equal(req.minBestQuality, 2);
    assert.equal(req.minAvgQuality, 1.5);
    assert.equal(req.minPlatformEarningsCents, 5000);
    assert.equal(req.minPlatformViews, 1000);
  });
});

describe("evaluateCreatorRequirements", () => {
  it("passes when snapshot meets all requirements", () => {
    const requirements = parseContestCreatorRequirements({
      contest_format: "video",
      min_best_quality_score: 1,
      min_platform_earnings: 5000,
    });
    assert.deepEqual(
      evaluateCreatorRequirements({ requirements, snapshot: baseSnapshot }),
      [],
    );
    assert.equal(
      isCreatorEligibleForContest({ requirements, snapshot: baseSnapshot }),
      true,
    );
  });

  it("fails when best quality is below minimum", () => {
    const requirements = parseContestCreatorRequirements({
      contest_format: "video",
      min_best_quality_score: 3,
    });
    const failures = evaluateCreatorRequirements({
      requirements,
      snapshot: { ...baseSnapshot, bestQualityScore: 2 },
    });
    assert.equal(failures.length, 1);
    assert.equal(failures[0].code, "best_quality_too_low");
  });

  it("fails when new creator default quality is below a higher minimum", () => {
    const requirements = parseContestCreatorRequirements({
      contest_format: "video",
      min_best_quality_score: 2,
    });
    const failures = evaluateCreatorRequirements({
      requirements,
      snapshot: {
        ...baseSnapshot,
        avgQualityScore: 1,
        bestQualityScore: 1,
        verifiedReels: 0,
        rejectedReels: 0,
      },
    });
    assert.equal(failures.length, 1);
    assert.equal(failures[0].code, "best_quality_too_low");
  });
});

describe("buildCreatorRequirementsSnapshotFromProfile", () => {
  it("builds snapshot from cached creator_profiles fields", () => {
    const snapshot = buildCreatorRequirementsSnapshotFromProfile({
      trust_score_metrics: {
        trust_score: 80,
        trust_number: 4,
        total_reels: 6,
        verified_reels: 5,
        rejected_reels: 1,
        pending_reels: 0,
      },
      avg_quality_score: 2,
      best_quality_score: 3,
      total_money_won: 12_500,
      total_views: 80_000,
    });

    assert.equal(snapshot.trustScorePct, 80);
    assert.equal(snapshot.trustNumber, 4);
    assert.equal(snapshot.avgQualityScore, 2);
    assert.equal(snapshot.bestQualityScore, 3);
    assert.equal(snapshot.totalPlatformEarningsCents, 12_500);
    assert.equal(snapshot.totalViews, 80_000);
    assert.equal(snapshot.verifiedReels, 5);
    assert.equal(snapshot.rejectedReels, 1);
    assert.equal(snapshot.pendingReels, 0);
  });

  it("matches getCreatorStatsFromProfile-derived values", () => {
    const profile = {
      trust_score_metrics: {
        trust_score: 100,
        trust_number: 2,
        total_reels: 3,
        verified_reels: 2,
        rejected_reels: 0,
        pending_reels: 1,
      },
      avg_quality_score: 1,
      best_quality_score: 1,
      total_money_won: 0,
      total_views: 0,
    };
    const snapshot = buildCreatorRequirementsSnapshotFromProfile(profile);
    const stats = getCreatorStatsFromProfile(profile);
    assert.equal(snapshot.trustScorePct, stats.trustMetrics.trust_score);
    assert.equal(snapshot.trustNumber, stats.trustMetrics.trust_number);
    assert.equal(snapshot.avgQualityScore, stats.qualityMetrics.avg_quality_score);
    assert.equal(snapshot.bestQualityScore, stats.qualityMetrics.best_quality_score);
  });
});
