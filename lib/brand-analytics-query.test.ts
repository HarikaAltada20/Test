import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BRAND_ANALYTICS_DEFAULT_MONTHS,
  BRAND_ANALYTICS_MAX_RANGE_DAYS,
  parseBrandAnalyticsDateRange,
  validateBrandAnalyticsDateRange,
} from "@/lib/brand-analytics-query";

describe("parseBrandAnalyticsDateRange", () => {
  it("defaults to approximately the last 12 months when params are omitted", () => {
    const range = parseBrandAnalyticsDateRange(new URLSearchParams());
    const spanDays =
      (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);

    assert.ok(spanDays >= 360 && spanDays <= 375);
    assert.ok(range.from.getTime() < range.to.getTime());
    assert.equal(BRAND_ANALYTICS_DEFAULT_MONTHS, 12);
  });
});

describe("validateBrandAnalyticsDateRange", () => {
  it("rejects inverted ranges", () => {
    const result = validateBrandAnalyticsDateRange({
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-05-01T00:00:00.000Z"),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /from must be before to/i);
    }
  });

  it("rejects ranges wider than the configured maximum", () => {
    const from = new Date("2024-01-01T00:00:00.000Z");
    const to = new Date("2026-01-01T00:00:00.000Z");
    const result = validateBrandAnalyticsDateRange({ from, to });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, new RegExp(String(BRAND_ANALYTICS_MAX_RANGE_DAYS)));
    }
  });

  it("accepts a one-year range", () => {
    const from = new Date("2025-06-01T00:00:00.000Z");
    const to = new Date("2026-06-01T00:00:00.000Z");
    const result = validateBrandAnalyticsDateRange({ from, to });
    assert.equal(result.ok, true);
  });
});
