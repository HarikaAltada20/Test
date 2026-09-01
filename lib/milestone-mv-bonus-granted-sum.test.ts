import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sumMilestoneMostVerifiedBonusGrantedForCreators } from "./milestone-contest-expected-spend";

describe("sumMilestoneMostVerifiedBonusGrantedForCreators", () => {
  it("sums views and reels paid bonus per creator once", () => {
    const map = new Map([
      [
        "creator-1",
        {
          expectedCents: 1000,
          paidCents: 1000,
          viewsExpectedCents: 0,
          viewsPaidCents: 0,
          verifiedReels: 5,
          minRequired: 3,
        },
      ],
      [
        "creator-2",
        {
          expectedCents: 0,
          paidCents: 0,
          viewsExpectedCents: 1000,
          viewsPaidCents: 1000,
          verifiedReels: 0,
          minRequired: 0,
        },
      ],
    ]);

    assert.equal(
      sumMilestoneMostVerifiedBonusGrantedForCreators(map, [
        "creator-1",
        "creator-1",
      ]),
      1000,
    );
    assert.equal(
      sumMilestoneMostVerifiedBonusGrantedForCreators(map, [
        "creator-1",
        "creator-2",
      ]),
      2000,
    );
  });
});
