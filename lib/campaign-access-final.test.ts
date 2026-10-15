import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  APPLICATION_REQUIREMENT_FILTERS,
  APPLICATION_SORTS,
  CAMPAIGN_ACCESS_NOTIFICATION_TYPES,
  OPPORTUNITY_ACCESS_FILTERS,
  OPPORTUNITY_ACCESS_FILTER_LABELS,
  WAITLIST_RESULT_MESSAGES,
  isCampaignAccessNotificationType,
  isOneOfValues,
  isRequirementState,
  isWaitlistResult,
  parseOpportunityAccessFilter,
} from "./campaign-access";
import { buildOpportunitiesListQueryKey } from "./opportunities-list-query";

describe("opportunity access filter", () => {
  it("accepts the known filters and falls back to all", () => {
    for (const f of OPPORTUNITY_ACCESS_FILTERS) assert.equal(parseOpportunityAccessFilter(f), f);
    assert.equal(parseOpportunityAccessFilter("everything"), "all");
    assert.equal(parseOpportunityAccessFilter(null), "all");
    assert.equal(parseOpportunityAccessFilter(undefined), "all");
  });

  it("has a label for every filter", () => {
    for (const f of OPPORTUNITY_ACCESS_FILTERS) assert.ok(OPPORTUNITY_ACCESS_FILTER_LABELS[f]);
  });

  it("only adds access to the list query key when filtering", () => {
    const base = {
      tab: "all",
      sort: "relevance_desc",
      page: 1,
      limit: 9,
      platform: "all",
      contestType: "all",
      mediaType: "all",
      search: "",
    };
    // Unchanged for "all" so the server-rendered first page still matches.
    assert.equal(buildOpportunitiesListQueryKey({ ...base, access: "all" }), buildOpportunitiesListQueryKey(base));
    assert.match(buildOpportunitiesListQueryKey({ ...base, access: "apply" }), /(^|&)access=apply(&|$)/);
  });
});

describe("applications sort and requirement filter", () => {
  it("validates sort and filter values", () => {
    assert.ok(isOneOfValues(APPLICATION_SORTS, "followers"));
    assert.equal(isOneOfValues(APPLICATION_SORTS, "random"), false);
    assert.ok(isOneOfValues(APPLICATION_REQUIREMENT_FILTERS, "meets"));
    assert.equal(isOneOfValues(APPLICATION_REQUIREMENT_FILTERS, 1), false);
  });

  it("recognises requirement states from the database", () => {
    for (const s of ["skipped", "none", "meets", "below"]) assert.ok(isRequirementState(s));
    assert.equal(isRequirementState("unknown"), false);
    assert.equal(isRequirementState(null), false);
  });
});

describe("applications reopened waitlist", () => {
  it("has a message for every result the database returns", () => {
    for (const r of [
      "joined",
      "already_joined",
      "left",
      "not_signed_in",
      "not_found",
      "applications_open",
      "ended",
      "has_access",
      "already_applied",
    ]) {
      assert.ok(isWaitlistResult(r), r);
      assert.ok(WAITLIST_RESULT_MESSAGES[r as keyof typeof WAITLIST_RESULT_MESSAGES]);
    }
    assert.equal(isWaitlistResult("toString"), false);
    assert.equal(isWaitlistResult("nope"), false);
  });

  it("treats the reopened notification as a campaign notification", () => {
    assert.ok(CAMPAIGN_ACCESS_NOTIFICATION_TYPES.includes("campaign_applications_reopened"));
    assert.ok(isCampaignAccessNotificationType("campaign_applications_reopened"));
  });
});
