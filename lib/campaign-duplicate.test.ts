import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DUPLICATE_SECTION_GROUPS,
  DUPLICATE_SECTION_KEYS,
  DUPLICATE_SECTION_LABELS,
  DUPLICATE_UNTITLED,
  blockedSections,
  defaultDuplicateTitle,
  duplicateStatusLabel,
  duplicateWizardHref,
  resolveSectionSelection,
  shiftDuplicateDates,
} from "./campaign-duplicate";
import {
  availableSections,
  buildDuplicateRow,
  contestAssetPath,
  planAssetCopies,
  planWarnings,
  rewriteAssetUrls,
  sanitizeSearchTerm,
  sanitizeSetupDetails,
  stripRuntimeKeys,
} from "./campaign-duplicate-server";

const SUPABASE = "https://abc.supabase.co";
const asset = (path: string) => `${SUPABASE}/storage/v1/object/public/contest-assets/${path}`;
const ALL = [...DUPLICATE_SECTION_KEYS];

/** A live, paid, multi-run campaign full of data that must never be copied. */
function paidLiveSource(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    advertiser_id: "22222222-2222-4222-8222-222222222222",
    title: "Summer launch",
    platform: "youtube",
    contest_format: "video",
    contest_type: "cpm",
    content_type: "ugc",
    category: "technology",
    categories: ["tech"],
    subcategories: { tech: ["apps"] },
    interests: ["gaming"],
    region: { asia: ["IN"] },
    thumbnail_url: asset("contest_thumbnails/1111_1700000000.png"),
    brief_html: "<p>Make a video</p>",
    brief_json: { type: "doc" },
    rules_html: "<p>No swearing</p>",
    rules_json: { type: "doc" },
    resources: [
      { url: asset("contest_resources/1111/guide.pdf"), description: "Guide", type: "internal" },
      { url: "https://example.com/brand", description: "Site", type: "external" },
    ],
    inspiration_links: [{ url: "https://youtu.be/x", description: "Like this" }],
    tracking_links: [{ url: "https://track.me", description: "UTM" }],
    contest_based_details: {
      cpm_contest: {
        cpm_rate_usd: 2,
        total_budget: 50000,
        budget_spent: 31234,
        min_views: 1000,
        terms_conditions: "T&C",
        flat_fee_bonus: 500,
      },
      some_live_counter: { paid_count: 4 },
    },
    bonus_details: { description_html: "<p>Bonus</p>" },
    max_earnings_per_creator: 20000,
    multiple_submissions_enabled: true,
    max_submissions_per_creator: 3,
    trust_score: 40,
    trust_number: null,
    min_avg_quality_score: 3,
    min_best_quality_score: null,
    min_quality_score: null,
    min_platform_earnings: null,
    min_platform_views: 10000,
    start_date: "2026-01-01T10:00:00.000Z",
    end_date: "2026-01-15T10:00:00.000Z",
    access_mode: "restricted",
    access_list_skips_requirements: true,
    preview_description: "Apply to join",
    applications_open: false,
    list_only_to_eligible: false,
    applicant_visibility: { followers: false },
    // Everything below happened at or after submission.
    moderation_status: "published",
    submitted_for_approval_at: "2025-12-20T00:00:00.000Z",
    approved_at: "2025-12-21T00:00:00.000Z",
    approved_by: "33333333-3333-4333-8333-333333333333",
    published_at: "2025-12-22T00:00:00.000Z",
    rejection_reason: "old reason",
    payment_details: { payment_intent_id: "pi_123", total_amount_paid: 55000 },
    subscription_plan_of_user: "CHAMPION",
    subscription_info_of_user: { product_id: "prod_x" },
    live_submission_count: 88,
    last_metrics_updated: "2026-01-10T00:00:00.000Z",
    post_contest_status: "payouts_processed",
    post_campaign_last_metrics_updated: "2026-01-16T00:00:00.000Z",
    post_campaign_last_synced_at: "2026-01-16T00:00:00.000Z",
    payout_adjustment_percentage: 10,
    payout_adjustment_mode: "increase",
    views_locked_at: "2026-01-15T10:00:00.000Z",
    created_at: "2025-12-01T00:00:00.000Z",
    updated_at: "2026-01-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("section definitions", () => {
  it("puts every section in exactly one group and labels it", () => {
    const grouped = DUPLICATE_SECTION_GROUPS.flatMap((g) => g.sections);
    assert.deepEqual([...grouped].sort(), [...DUPLICATE_SECTION_KEYS].sort());
    assert.equal(new Set(grouped).size, grouped.length);
    for (const k of DUPLICATE_SECTION_KEYS) assert.ok(DUPLICATE_SECTION_LABELS[k]);
  });

  it("drops sections whose dependencies are unticked", () => {
    assert.deepEqual(
      resolveSectionSelection(["rewards", "requirements", "brief"], { isMultiPlatform: false }),
      ["brief"],
    );
    assert.deepEqual(
      resolveSectionSelection(["questions", "invites"], { isMultiPlatform: false }),
      [],
    );
    // Multi-platform content is stored per platform, so it needs the platforms.
    assert.deepEqual(resolveSectionSelection(["brief", "title"], { isMultiPlatform: true }), [
      "title",
    ]);
    assert.deepEqual(
      resolveSectionSelection(["setup", "brief"], { isMultiPlatform: true }),
      ["setup", "brief"],
    );
  });

  it("reports what a blocked section is waiting for", () => {
    const blocked = blockedSections(["brief"], { isMultiPlatform: false });
    assert.deepEqual(blocked.rewards, ["setup"]);
    assert.equal(blocked.brief, undefined);
  });
});

describe("title", () => {
  it("adds (copy) and stays within 100 characters", () => {
    assert.equal(defaultDuplicateTitle("Summer launch"), "Summer launch (copy)");
    assert.equal(defaultDuplicateTitle("   "), DUPLICATE_UNTITLED);
    const long = defaultDuplicateTitle("x".repeat(100));
    assert.equal(long.length, 100);
    assert.ok(long.endsWith(" (copy)"));
  });
});

describe("dates", () => {
  const now = new Date("2026-10-16T15:00:00.000Z");

  it("keeps future dates as they are", () => {
    const r = shiftDuplicateDates("2026-11-01T09:00:00.000Z", "2026-11-10T09:00:00.000Z", now);
    assert.equal(r.shifted, false);
    assert.equal(r.start_date, "2026-11-01T09:00:00.000Z");
    assert.equal(r.end_date, "2026-11-10T09:00:00.000Z");
  });

  it("moves past dates to start at least a day ahead with the same length", () => {
    const r = shiftDuplicateDates("2026-01-01T10:00:00.000Z", "2026-01-15T10:00:00.000Z", now);
    assert.equal(r.shifted, true);
    const start = new Date(r.start_date!);
    const end = new Date(r.end_date!);
    assert.ok(start.getTime() - now.getTime() >= 24 * 60 * 60 * 1000);
    assert.equal(start.getUTCHours(), 10);
    assert.equal(end.getTime() - start.getTime(), 14 * 24 * 60 * 60 * 1000);
  });

  it("handles missing or broken dates", () => {
    assert.deepEqual(shiftDuplicateDates(null, null, now), {
      start_date: null,
      end_date: null,
      shifted: false,
    });
    assert.equal(shiftDuplicateDates("nope", null, now).start_date, null);
  });
});

describe("buildDuplicateRow", () => {
  const target = "44444444-4444-4444-8444-444444444444";
  const now = new Date("2026-10-16T15:00:00.000Z");

  it("never copies payment, review or live data, even with every section ticked", () => {
    const { row } = buildDuplicateRow({
      source: paidLiveSource(),
      sections: ALL,
      targetAdvertiserId: target,
      title: null,
      now,
    });
    assert.equal(row.advertiser_id, target);
    assert.equal(row.moderation_status, "draft");
    for (const key of [
      "payment_details",
      "submitted_for_approval_at",
      "approved_at",
      "approved_by",
      "published_at",
      "rejection_reason",
      "post_contest_status",
      "last_metrics_updated",
      "subscription_info_of_user",
    ]) {
      assert.equal(row[key], null, key);
    }
    assert.equal(row.live_submission_count, 0);
    for (const key of [
      "id",
      "created_at",
      "updated_at",
      "subscription_plan_of_user",
      "post_campaign_last_metrics_updated",
      "post_campaign_last_synced_at",
      "payout_adjustment_percentage",
      "payout_adjustment_mode",
      "views_locked_at",
    ]) {
      assert.equal(key in row, false, key);
    }
    const json = JSON.stringify(row);
    assert.equal(json.includes("budget_spent"), false);
    assert.equal(json.includes("pi_123"), false);
    assert.equal(json.includes("paid_count"), false);
  });

  it("copies everything a draft can hold when every section is ticked", () => {
    const { row } = buildDuplicateRow({
      source: paidLiveSource(),
      sections: ALL,
      targetAdvertiserId: target,
      title: "My copy",
      now,
    });
    assert.equal(row.title, "My copy");
    assert.equal(row.contest_type, "cpm");
    assert.equal(row.platform, "youtube");
    assert.equal(row.content_type, "ugc");
    assert.deepEqual(row.categories, ["tech"]);
    assert.deepEqual(row.region, { asia: ["IN"] });
    assert.equal(row.trust_score, 40);
    assert.equal(row.min_platform_views, 10000);
    assert.equal(row.access_mode, "restricted");
    assert.equal(row.access_list_skips_requirements, true);
    assert.equal(row.preview_description, "Apply to join");
    assert.equal(row.applications_open, false);
    assert.deepEqual(row.applicant_visibility, { followers: false });
    assert.equal(row.brief_html, "<p>Make a video</p>");
    assert.equal(row.rules_html, "<p>No swearing</p>");
    assert.deepEqual(row.contest_based_details, {
      cpm_contest: {
        cpm_rate_usd: 2,
        total_budget: 50000,
        min_views: 1000,
        terms_conditions: "T&C",
        flat_fee_bonus: 500,
      },
    });
    assert.equal(row.max_earnings_per_creator, 20000);
    assert.equal(row.multiple_submissions_enabled, true);
    assert.equal(row.max_submissions_per_creator, 3);
    assert.ok(row.start_date && new Date(row.start_date as string) > now);
  });

  it("starts from new-draft defaults when nothing is ticked", () => {
    const { row } = buildDuplicateRow({
      source: paidLiveSource(),
      sections: [],
      targetAdvertiserId: target,
      title: "ignored",
      now,
    });
    assert.equal(row.title, DUPLICATE_UNTITLED);
    assert.equal(row.contest_type, "leaderboard");
    assert.equal(row.platform, null);
    assert.equal(row.thumbnail_url, null);
    assert.equal(row.brief_html, "");
    assert.deepEqual(row.resources, []);
    assert.equal(row.contest_based_details, null);
    assert.equal(row.access_mode, "public");
    assert.equal(row.access_list_skips_requirements, false);
    assert.equal("applicant_visibility" in row, false);
    assert.equal(row.start_date, null);
    assert.equal(row.trust_score, null);
  });

  it("keeps rewards out unless they're ticked", () => {
    const { row } = buildDuplicateRow({
      source: paidLiveSource(),
      sections: ["setup", "title"],
      targetAdvertiserId: target,
      title: null,
      now,
    });
    assert.equal(row.contest_type, "cpm");
    assert.equal(row.contest_based_details, null);
    assert.equal(row.title, "Summer launch (copy)");
  });

  it("drops creator requirements on text/image campaigns", () => {
    const { row } = buildDuplicateRow({
      source: paidLiveSource({ contest_format: "text_image", platform: "twitter" }),
      sections: ALL,
      targetAdvertiserId: target,
      title: null,
      now,
    });
    assert.equal(row.trust_score, null);
    assert.equal(row.min_platform_views, null);
  });

  it("only keeps restricted-only fields on restricted copies", () => {
    const { row } = buildDuplicateRow({
      source: paidLiveSource({ access_mode: "private" }),
      sections: ALL,
      targetAdvertiserId: target,
      title: null,
      now,
    });
    assert.equal(row.access_mode, "private");
    assert.equal("preview_description" in row, false);
    assert.equal("applications_open" in row, false);
  });

  it("copies Review before posting and its limits when ticked", () => {
    const source = paidLiveSource({
      review_before_posting: true,
      draft_max_open: 8,
      draft_max_revisions: 2,
      draft_max_rejections: null,
    });
    const { row } = buildDuplicateRow({ source, sections: ALL, targetAdvertiserId: target, title: null, now });
    assert.equal(row.review_before_posting, true);
    assert.equal(row.draft_max_open, 8);
    assert.equal(row.draft_max_revisions, 2);
    assert.equal(row.draft_max_rejections, null);

    // Unticked, or without the setup it depends on: the columns are left to their defaults.
    for (const sections of [["setup"], ["review_before_posting"]] as const) {
      const { row: plain } = buildDuplicateRow({ source, sections, targetAdvertiserId: target, title: null, now });
      assert.equal("review_before_posting" in plain, false);
      assert.equal("draft_max_open" in plain, false);
    }

    const { row: text } = buildDuplicateRow({
      source: { ...source, contest_format: "text_image", platform: "twitter" },
      sections: ALL,
      targetAdvertiserId: target,
      title: null,
      now,
    });
    assert.equal("review_before_posting" in text, false);
  });

  it("says when dates were moved", () => {
    const { warnings } = buildDuplicateRow({
      source: paidLiveSource(),
      sections: ["dates"],
      targetAdvertiserId: target,
      title: null,
      now,
    });
    assert.deepEqual(
      warnings.map((w) => w.code),
      ["dates_shifted"],
    );
  });
});

describe("sanitizeSetupDetails", () => {
  it("keeps per-platform payout objects only for platforms the copy has", () => {
    const details = {
      youtube: {
        contest_type: "leaderboard",
        content_type: "ugc",
        leaderboard_contest: { prizes: [{ position: 1, amount: 1000 }], total_prize: 1000, winner_count: 1, budget_spent: 5 },
      },
      tiktok: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 1, budget_spent: 9 } },
      platform_campaigns: { legacy: true },
    };
    const out = sanitizeSetupDetails(details, {
      setup: true,
      rewards: true,
      contentType: false,
      postRequirements: false,
      platforms: ["youtube"],
    });
    assert.deepEqual(out, {
      youtube: {
        contest_type: "leaderboard",
        leaderboard_contest: { prizes: [{ position: 1, amount: 1000 }], total_prize: 1000, winner_count: 1 },
      },
    });
  });

  it("copies the highest-earning platform switch only with rewards and 2+ platforms", () => {
    const details = {
      highest_platform_payout_only: true,
      youtube: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 1 } },
      tiktok: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 2 } },
    };
    const opts = {
      setup: true,
      rewards: true,
      contentType: false,
      postRequirements: false,
      platforms: ["youtube", "tiktok"],
    };
    assert.equal(sanitizeSetupDetails(details, opts)?.highest_platform_payout_only, true);
    assert.equal(
      sanitizeSetupDetails(details, { ...opts, rewards: false })?.highest_platform_payout_only,
      undefined,
    );
    assert.equal(
      sanitizeSetupDetails(details, { ...opts, platforms: ["youtube"] })?.highest_platform_payout_only,
      undefined,
    );
    assert.equal(
      sanitizeSetupDetails({ ...details, highest_platform_payout_only: "true" }, opts)
        ?.highest_platform_payout_only,
      undefined,
    );
  });

  it("keeps the switch through buildDuplicateRow for a multi-platform copy", () => {
    const { row } = buildDuplicateRow({
      source: paidLiveSource({
        platform: "youtube,instagram",
        contest_format: "video",
        contest_type: "cpm",
        contest_based_details: {
          highest_platform_payout_only: true,
          youtube: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 1 } },
          instagram: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 1 } },
        },
      }),
      sections: ["setup", "rewards"],
      targetAdvertiserId: "44444444-4444-4444-8444-444444444444",
      title: null,
      now: new Date("2026-10-16T15:00:00.000Z"),
    });
    assert.equal(
      (row.contest_based_details as Record<string, unknown>).highest_platform_payout_only,
      true,
    );
  });

  it("keeps the platform's type without rewards", () => {
    const out = sanitizeSetupDetails(
      { youtube: { contest_type: "cpm", cpm_contest: { cpm_rate_usd: 1 } } },
      { setup: true, rewards: false, contentType: true, postRequirements: false, platforms: ["youtube"] },
    );
    assert.deepEqual(out, { youtube: { contest_type: "cpm" } });
  });

  it("copies X post requirements only when ticked", () => {
    const details = {
      twitter_campaign: {
        campaign_type: "raid",
        keywords: ["#launch"],
        raid_target: { link: "https://x.com/a/status/1", metrics: { likes: 10 } },
        last_synced_at: "2026-01-01",
      },
    };
    assert.deepEqual(
      sanitizeSetupDetails(details, {
        setup: true,
        rewards: false,
        contentType: true,
        postRequirements: false,
        platforms: [],
      }),
      { twitter_campaign: { campaign_type: "raid" } },
    );
    assert.deepEqual(
      sanitizeSetupDetails(details, {
        setup: true,
        rewards: false,
        contentType: false,
        postRequirements: true,
        platforms: [],
      }),
      {
        twitter_campaign: {
          campaign_type: "raid",
          keywords: ["#launch"],
          raid_target: { link: "https://x.com/a/status/1", metrics: { likes: 10 } },
        },
      },
    );
  });

  it("strips runtime keys at any depth but keeps winner_count", () => {
    assert.deepEqual(
      stripRuntimeKeys({ a: { budget_spent: 1, winner_count: 3, bonus_paid: true, list: [{ paid_at: 1, x: 2 }] } }),
      { a: { winner_count: 3, list: [{ x: 2 }] } },
    );
  });
});

describe("availableSections", () => {
  it("lists only parts that have something to copy", () => {
    const available = availableSections(
      paidLiveSource({ bonus_details: null, tracking_links: [], start_date: null, end_date: null }),
      { questions: 2, invites: 0 },
    );
    assert.ok(available.includes("questions"));
    assert.equal(available.includes("invites"), false);
    assert.equal(available.includes("bonus"), false);
    assert.equal(available.includes("tracking_links"), false);
    assert.equal(available.includes("dates"), false);
    assert.equal(available.includes("post_requirements"), false);
  });

  it("offers Review before posting only when it is on for a video campaign", () => {
    const counts = { questions: 0, invites: 0 };
    assert.equal(availableSections(paidLiveSource(), counts).includes("review_before_posting"), false);
    assert.ok(
      availableSections(paidLiveSource({ review_before_posting: true }), counts).includes("review_before_posting"),
    );
    assert.equal(
      availableSections(
        paidLiveSource({ review_before_posting: true, contest_format: "text_image", platform: "twitter" }),
        counts,
      ).includes("review_before_posting"),
      false,
    );
  });

  it("never offers questions on a public campaign", () => {
    const available = availableSections(paidLiveSource({ access_mode: "public" }), {
      questions: 3,
      invites: 5,
    });
    assert.equal(available.includes("questions"), false);
    assert.equal(available.includes("invites"), false);
  });
});

describe("files", () => {
  it("only copies files from our own bucket folders", () => {
    assert.equal(
      contestAssetPath(asset("contest_thumbnails/a_1.png"), SUPABASE),
      "contest_thumbnails/a_1.png",
    );
    assert.equal(contestAssetPath("https://evil.com/storage/v1/object/public/contest-assets/contest_thumbnails/a.png", SUPABASE), null);
    assert.equal(contestAssetPath(asset("avatars/a.png"), SUPABASE), null);
    assert.equal(contestAssetPath(asset("contest_resources/../secrets/a.png"), SUPABASE), null);
    assert.equal(contestAssetPath(asset("contest_resources/%2e%2e/x.png"), SUPABASE), null);
    assert.equal(contestAssetPath("not a url", SUPABASE), null);
    assert.equal(contestAssetPath(asset("contest_thumbnails/a.png"), null), null);
  });

  it("gives the copy its own files and drops ones that couldn't be copied", () => {
    const row = {
      thumbnail_url: asset("contest_thumbnails/old_1.png"),
      resources: {
        youtube: [
          { url: asset("contest_resources/old/guide.pdf"), type: "internal" },
          { url: asset("contest_resources/old/gone.pdf"), type: "internal" },
          { url: "https://example.com", type: "external" },
        ],
        tiktok: [{ url: asset("contest_resources/old/guide.pdf"), type: "internal" }],
      },
    };
    const plan = planAssetCopies(row, "new", SUPABASE, 42);
    assert.equal(plan.copies.get("contest_thumbnails/old_1.png"), "contest_thumbnails/new_42.png");
    assert.equal(plan.copies.get("contest_resources/old/guide.pdf"), "contest_resources/new/guide.pdf");
    assert.equal(plan.copies.size, 3);

    const copied = new Map(plan.copies);
    copied.delete("contest_resources/old/gone.pdf");
    const out = rewriteAssetUrls(row, SUPABASE, copied, (p) => asset(p));
    assert.equal(out.thumbnail_url, asset("contest_thumbnails/new_42.png"));
    assert.equal(out.missingThumbnail, false);
    assert.equal(out.missingResources, 1);
    const resources = out.resources as Record<string, Array<{ url: string }>>;
    assert.deepEqual(
      resources.youtube.map((r) => r.url),
      [asset("contest_resources/new/guide.pdf"), "https://example.com"],
    );
    assert.deepEqual(resources.tiktok.map((r) => r.url), [asset("contest_resources/new/guide.pdf")]);
  });

  it("clears the thumbnail if it couldn't be copied", () => {
    const row = { thumbnail_url: asset("contest_thumbnails/x.png"), resources: [] };
    const out = rewriteAssetUrls(row, SUPABASE, new Map(), (p) => asset(p));
    assert.equal(out.thumbnail_url, null);
    assert.equal(out.missingThumbnail, true);
  });
});

describe("plan warnings", () => {
  const explorer = { contestTypes: ["leaderboard"], maxWinnersPerContest: 3, minContestBudget: 10000 };

  it("flags a type the plan doesn't include", () => {
    const codes = planWarnings(paidLiveSource(), explorer, "Explorer Plan").map((w) => w.code);
    assert.ok(codes.includes("type_not_in_plan"));
  });

  it("flags too many winners and a small prize pool", () => {
    const source = paidLiveSource({
      contest_type: "leaderboard",
      contest_based_details: { leaderboard_contest: { winner_count: 5, total_prize: 5000 } },
    });
    const codes = planWarnings(source, explorer, null).map((w) => w.code);
    assert.deepEqual(codes.sort(), ["budget_under_plan", "winners_over_plan"]);
  });
});

describe("misc", () => {
  it("keeps search text from changing the filter", () => {
    assert.equal(sanitizeSearchTerm("a,b(c)\"d\\e*f%g:h"), "a b c d e f g h");
    assert.equal(sanitizeSearchTerm("Bob's  launch "), "Bob's launch");
    assert.equal(sanitizeSearchTerm(42), "");
    assert.equal(sanitizeSearchTerm("x".repeat(500)).length, 100);
  });

  it("opens the right wizard", () => {
    assert.equal(
      duplicateWizardHref({ id: "c1", advertiserId: "b1" }, false),
      "/dashboard/contests/create?draft=c1&copied=1",
    );
    assert.equal(
      duplicateWizardHref({ id: "c1", advertiserId: "b1" }, true),
      "/dashboard/admin/contests/create/wizard?advertiserId=b1&draft=c1&copied=1",
    );
  });

  it("labels campaign status like the lists do", () => {
    assert.equal(duplicateStatusLabel("published", "ended"), "Ended");
    assert.equal(duplicateStatusLabel("published", "active"), "Live");
    assert.equal(duplicateStatusLabel("pending_approval", null), "In review");
    assert.equal(duplicateStatusLabel("draft", null), "Draft");
  });
});
