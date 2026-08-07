import { describe, expect, it } from "vitest";

/**
 * Mirror of ranking used by computeNonTwitterLeaderboardCreatorPrizeCents /
 * creator-wise UI: sort creators by total views desc, then id asc for ties.
 */
function rankCreatorsByViews(
  viewsByCreator: Map<string, number>,
  creatorId: string,
): number | null {
  if (!viewsByCreator.has(creatorId)) return null;
  const ranked = Array.from(viewsByCreator.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const rank = ranked.findIndex(([id]) => id === creatorId) + 1;
  return rank > 0 ? rank : null;
}

describe("non-twitter leaderboard creator ranking", () => {
  it("ranks by total views descending", () => {
    const views = new Map([
      ["a", 100],
      ["b", 500],
      ["c", 200],
    ]);
    expect(rankCreatorsByViews(views, "b")).toBe(1);
    expect(rankCreatorsByViews(views, "c")).toBe(2);
    expect(rankCreatorsByViews(views, "a")).toBe(3);
  });

  it("returns null when creator has no eligible views", () => {
    const views = new Map([["a", 100]]);
    expect(rankCreatorsByViews(views, "missing")).toBeNull();
  });
});
