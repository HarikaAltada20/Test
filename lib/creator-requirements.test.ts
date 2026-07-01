import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCreatorRequirements,
  isCreatorEligibleForContest,
  parseContestCreatorRequirements,
} from "./creator-requirements";

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
