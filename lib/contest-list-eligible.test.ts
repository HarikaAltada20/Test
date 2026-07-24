import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCreatorEligibleForContest,
  parseContestCreatorRequirements,
  type CreatorRequirementsSnapshot,
} from "@/lib/creator-requirements";

/**
 * Parity checks for SQL contest_matches_creator_eligibility
 * (db/migrations/20260731_campaign_list_page_ids.sql).
 * Keep these cases aligned when changing gate semantics.
 */

const baseSnapshot: CreatorRequirementsSnapshot = {
  trustScorePct: 80,
  trustNumber: 5,
  avgQualityScore: 2,
  bestQualityScore: 3,
  qualityScoreSum: 6,
  totalPlatformEarningsCents: 10_000,
  totalViews: 50_000,
  verifiedReels: 4,
  rejectedReels: 0,
  pendingReels: 0,
  hasExplicitQualityScores: true,
};

function eligible(
  contest: Parameters<typeof parseContestCreatorRequirements>[0],
  snapshot: CreatorRequirementsSnapshot = baseSnapshot,
): boolean {
  return isCreatorEligibleForContest({
    requirements: parseContestCreatorRequirements(contest),
    snapshot,
  });
}

describe("eligibleOnly SQL parity (contest_matches_creator_eligibility)", () => {
  it("always passes text_image contests", () => {
    assert.equal(
      eligible({
        contest_format: "text_image",
        trust_score: 99,
        min_platform_views: 1_000_000,
      }),
      true,
    );
  });

  it("passes unrestricted video contests", () => {
    assert.equal(eligible({ contest_format: "video" }), true);
  });

  it("filters on trust / quality / earnings / views gates", () => {
    assert.equal(
      eligible({ contest_format: "video", trust_score: 90 }, baseSnapshot),
      false,
    );
    assert.equal(
      eligible({ contest_format: "video", trust_score: 70 }, baseSnapshot),
      true,
    );
    assert.equal(
      eligible(
        { contest_format: "video", min_best_quality_score: 3 },
        { ...baseSnapshot, bestQualityScore: 2 },
      ),
      false,
    );
    assert.equal(
      eligible(
        { contest_format: "video", min_platform_views: 60_000 },
        baseSnapshot,
      ),
      false,
    );
    assert.equal(
      eligible(
        { contest_format: "video", min_platform_earnings: 5_000 },
        baseSnapshot,
      ),
      true,
    );
  });

  it("skips quality gates for legacy creators without explicit scores", () => {
    const legacy: CreatorRequirementsSnapshot = {
      ...baseSnapshot,
      hasExplicitQualityScores: false,
      verifiedReels: 3,
      avgQualityScore: null,
      bestQualityScore: null,
      qualityScoreSum: null,
    };
    assert.equal(
      eligible({ contest_format: "video", min_avg_quality_score: 3 }, legacy),
      true,
    );
  });
});
