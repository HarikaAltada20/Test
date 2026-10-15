import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyApplicantVisibility,
  buildApplicantProfile,
  parseApplicantVisibility,
  validateApplicantVisibility,
  formatFollowers,
  publicSocialAccount,
  topFollowerCount,
} from "./campaign-applicant-profile";

describe("publicSocialAccount", () => {
  it("builds a YouTube link from the custom URL and keeps no tokens", () => {
    const account = publicSocialAccount("youtube", {
      channel_title: "Vish Vlogs",
      channel_custom_url: "vishvlogs",
      subscriber_count: "12000",
      access_token: "secret",
      refresh_token: "secret",
    });
    assert.deepEqual(account, {
      platform: "youtube",
      label: "Vish Vlogs",
      url: "https://www.youtube.com/@vishvlogs",
      followers: 12000,
    });
    assert.equal(JSON.stringify(account).includes("secret"), false);
  });

  it("falls back to the channel id link", () => {
    assert.equal(
      publicSocialAccount("youtube", { channel_id: "UC123" })?.url,
      "https://www.youtube.com/channel/UC123",
    );
  });

  it("reads Instagram, TikTok and X handles", () => {
    assert.equal(publicSocialAccount("instagram", { username: "@vish", followers_count: 50 })?.url, "https://www.instagram.com/vish");
    assert.equal(publicSocialAccount("tiktok", { username: "vish", follower_count: 7 })?.label, "@vish");
    assert.equal(
      publicSocialAccount("twitter", { username: "vish", public_metrics: { followers_count: 9 } })?.followers,
      9,
    );
  });

  it("parses JSON strings and ignores empty accounts", () => {
    assert.equal(publicSocialAccount("instagram", JSON.stringify({ username: "a" }))?.label, "@a");
    assert.equal(publicSocialAccount("tiktok", {}), null);
    assert.equal(publicSocialAccount("twitter", null), null);
    assert.equal(publicSocialAccount("youtube", "{not json"), null);
  });
});

describe("buildApplicantProfile", () => {
  it("collects accounts, scores and basics", () => {
    const profile = buildApplicantProfile({
      youtube_account: { channel_title: "Vish", channel_id: "UC1", subscriber_count: 100 },
      instagram_account: { username: "vish", followers_count: 2500 },
      tiktok_account: null,
      twitter_account: null,
      trust_score_metrics: { total_reels: 10, verified_reels: 8, rejected_reels: 1, pending_reels: 1 },
      avg_quality_score: 4.2,
      best_quality_score: 5,
      quality_score_sum: 34,
      total_views: 9000,
      total_contests_participated: 3,
      country: "India",
      languages: ["English", "Hindi"],
      categories: "Tech, Gaming",
    });
    assert.equal(profile?.accounts.length, 2);
    assert.equal(profile?.verifiedSubmissions, 8);
    assert.equal(profile?.avgQualityScore, 4.2);
    assert.equal(profile?.campaignsJoined, 3);
    assert.deepEqual(profile?.categories, ["Tech", "Gaming"]);
    assert.equal(topFollowerCount(profile), 2500);
  });

  it("has no trust score before any submissions", () => {
    assert.equal(buildApplicantProfile({})?.trustScore, null);
    assert.equal(buildApplicantProfile(null), null);
  });
});

describe("formatFollowers", () => {
  it("abbreviates large counts", () => {
    assert.equal(formatFollowers(950), "950");
    assert.equal(formatFollowers(1250), "1.3K");
    assert.equal(formatFollowers(25000), "25K");
    assert.equal(formatFollowers(1500000), "1.5M");
  });
});

describe("applicant visibility", () => {
  const full = buildApplicantProfile({
    youtube_account: { channel_title: "Vish", channel_id: "UC1", subscriber_count: 100 },
    trust_score_metrics: { total_reels: 4, verified_reels: 3, rejected_reels: 1, pending_reels: 0 },
    avg_quality_score: 4,
    total_views: 500,
    total_contests_participated: 2,
    country: "India",
  });

  it("defaults every field to visible", () => {
    assert.deepEqual(parseApplicantVisibility(null), {
      accounts: true,
      followers: true,
      trust: true,
      quality: true,
      activity: true,
      basics: true,
    });
    assert.equal(parseApplicantVisibility({ trust: false }).trust, false);
  });

  it("rejects unknown fields and non-boolean values", () => {
    assert.ok("error" in validateApplicantVisibility({ email: false }));
    assert.ok("error" in validateApplicantVisibility({ trust: "no" }));
    assert.ok("error" in validateApplicantVisibility(null));
    assert.ok("visibility" in validateApplicantVisibility({ trust: false }));
  });

  it("leaves the profile alone when nothing is hidden", () => {
    assert.equal(applyApplicantVisibility(full, parseApplicantVisibility({})), full);
  });

  it("removes hidden details from the brand's copy", () => {
    const p = applyApplicantVisibility(full, parseApplicantVisibility({ followers: false, trust: false, activity: false, basics: false }));
    assert.equal(p?.redacted, true);
    assert.deepEqual(p?.hiddenFields, ["followers", "trust", "activity", "basics"]);
    assert.equal(p?.accounts[0].followers, null);
    assert.equal(p?.accounts[0].label, "Vish");
    assert.equal(p?.trustScore, null);
    assert.equal(p?.totalViews, 0);
    assert.equal(p?.campaignsJoined, null);
    assert.equal(p?.country, null);
    assert.equal(p?.avgQualityScore, 4);
  });

  it("drops accounts entirely when accounts are hidden", () => {
    assert.deepEqual(applyApplicantVisibility(full, parseApplicantVisibility({ accounts: false }))?.accounts, []);
  });
});
