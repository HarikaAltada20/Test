import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFlatFeeBonusExpectedCentsBySubmissionId,
  getFlatFeeBonusCentsFromContest,
} from "./twitter-cpm-bonus-expected";

const youtubeLadder = {
  contest_type: "leaderboard" as const,
  leaderboard_contest: {
    prizes: [{ position: 1, amount: 10000 }],
    total_prize: 10000,
    winner_count: 1,
    flat_fee_bonus: 200,
    total_budget: 1000,
  },
};

const instagramLadder = {
  contest_type: "leaderboard" as const,
  leaderboard_contest: {
    prizes: [{ position: 1, amount: 10000 }],
    total_prize: 10000,
    winner_count: 1,
    flat_fee_bonus: 500,
    total_budget: 1500,
  },
};

describe("flat-fee bonus expected per platform", () => {
  it("uses each platform's own budget even when bonus values match", () => {
    const contest = {
      contest_type: "leaderboard",
      platform: "youtube,instagram",
      contest_based_details: {
        youtube: youtubeLadder,
        instagram: {
          ...youtubeLadder,
        },
      },
    };
    const map = buildFlatFeeBonusExpectedCentsBySubmissionId(contest, [
      {
        id: "yt-1",
        created_at: "2026-01-01T00:00:00.000Z",
        status: "verified",
        platform: "youtube",
      },
      {
        id: "ig-1",
        created_at: "2026-01-02T00:00:00.000Z",
        status: "verified",
        platform: "instagram",
      },
    ]);
    assert.equal(map.get("yt-1"), 200);
    assert.equal(map.get("ig-1"), 200);
    assert.equal(getFlatFeeBonusCentsFromContest(contest), 200);
  });

  it("caps matching leaderboard bonuses independently per platform", () => {
    const tightLadder = {
      ...youtubeLadder,
      leaderboard_contest: {
        ...youtubeLadder.leaderboard_contest,
        total_budget: 200,
      },
    };
    const contest = {
      contest_type: "leaderboard",
      platform: "youtube,instagram",
      contest_based_details: {
        youtube: tightLadder,
        instagram: tightLadder,
      },
    };
    const map = buildFlatFeeBonusExpectedCentsBySubmissionId(contest, [
      {
        id: "yt-1",
        created_at: "2026-01-01T00:00:00.000Z",
        status: "verified",
        platform: "youtube",
      },
      {
        id: "yt-2",
        created_at: "2026-01-02T00:00:00.000Z",
        status: "verified",
        platform: "youtube",
      },
      {
        id: "ig-1",
        created_at: "2026-01-03T00:00:00.000Z",
        status: "verified",
        platform: "instagram",
      },
    ]);
    assert.equal(map.get("yt-1"), 200);
    assert.equal(map.get("yt-2"), 0);
    assert.equal(map.get("ig-1"), 200);
  });

  it("uses each platform's bonus and budget when they differ", () => {
    const contest = {
      contest_type: "leaderboard",
      platform: "youtube,instagram",
      contest_based_details: {
        youtube: youtubeLadder,
        instagram: instagramLadder,
      },
    };
    const map = buildFlatFeeBonusExpectedCentsBySubmissionId(contest, [
      {
        id: "yt-1",
        created_at: "2026-01-01T00:00:00.000Z",
        status: "verified",
        platform: "youtube",
      },
      {
        id: "ig-1",
        created_at: "2026-01-01T00:00:00.000Z",
        status: "verified",
        platform: "instagram",
      },
    ]);
    assert.equal(map.get("yt-1"), 200);
    assert.equal(map.get("ig-1"), 500);
    assert.equal(getFlatFeeBonusCentsFromContest(contest), 500);
  });

  it("caps each platform against its own bonus budget", () => {
    const contest = {
      contest_type: "leaderboard",
      platform: "youtube,instagram",
      contest_based_details: {
        youtube: {
          ...youtubeLadder,
          leaderboard_contest: {
            ...youtubeLadder.leaderboard_contest,
            total_budget: 200,
          },
        },
        instagram: instagramLadder,
      },
    };
    const map = buildFlatFeeBonusExpectedCentsBySubmissionId(contest, [
      {
        id: "yt-1",
        created_at: "2026-01-01T00:00:00.000Z",
        status: "verified",
        platform: "youtube",
      },
      {
        id: "yt-2",
        created_at: "2026-01-02T00:00:00.000Z",
        status: "verified",
        platform: "youtube",
      },
      {
        id: "ig-1",
        created_at: "2026-01-03T00:00:00.000Z",
        status: "verified",
        platform: "instagram",
      },
    ]);
    assert.equal(map.get("yt-1"), 200);
    assert.equal(map.get("yt-2"), 0);
    assert.equal(map.get("ig-1"), 500);
  });

  it("counts Twitter tweets as verified from moderation_status", () => {
    const contest = {
      contest_type: "cpm",
      platform: "twitter",
      contest_based_details: {
        cpm_contest: { flat_fee_bonus: 200, flat_fee_bonus_cap: 1000 },
      },
    };
    const map = buildFlatFeeBonusExpectedCentsBySubmissionId(contest, [
      {
        id: "tw-1",
        created_at: "2026-01-01T00:00:00.000Z",
        moderation_status: "verified",
        is_twitter_tweet: true,
        platform: "twitter",
      },
    ]);
    assert.equal(map.get("tw-1"), 200);
  });

  it("counts approved video submissions as verified", () => {
    const contest = {
      contest_type: "leaderboard",
      platform: "youtube",
      contest_based_details: {
        leaderboard_contest: {
          flat_fee_bonus: 200,
          total_budget: 1000,
        },
      },
    };
    const map = buildFlatFeeBonusExpectedCentsBySubmissionId(contest, [
      {
        id: "yt-1",
        created_at: "2026-01-01T00:00:00.000Z",
        status: "approved",
        platform: "youtube",
      },
    ]);
    assert.equal(map.get("yt-1"), 200);
  });

  it("uses root flat_fee_bonus when platform campaigns only have a budget", () => {
    const contest = {
      contest_type: "leaderboard",
      platform: "youtube,instagram",
      contest_based_details: {
        youtube: {
          contest_type: "leaderboard",
          leaderboard_contest: { total_budget: 5000 },
        },
        instagram: {
          contest_type: "leaderboard",
          leaderboard_contest: { total_budget: 5000 },
        },
        leaderboard_contest: {
          flat_fee_bonus: 200,
          total_budget: 10000,
        },
      },
    };
    assert.equal(getFlatFeeBonusCentsFromContest(contest), 200);
    const map = buildFlatFeeBonusExpectedCentsBySubmissionId(contest, [
      {
        id: "yt-1",
        created_at: "2026-01-01T00:00:00.000Z",
        status: "verified",
        platform: "youtube",
      },
    ]);
    assert.equal(map.get("yt-1"), 200);
  });
});
