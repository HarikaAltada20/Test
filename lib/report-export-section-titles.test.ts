import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCreatorWiseSectionTitle,
  buildSubmissionsWiseSectionTitle,
} from "@/lib/report-export-branding";

describe("report export section titles", () => {
  it("builds submissions wise section title from filter", () => {
    assert.equal(
      buildSubmissionsWiseSectionTitle("verified_or_paid"),
      "Submissions wise view - Verified + Paid - submissions list",
    );
  });

  it("builds creator wise section title from filter", () => {
    assert.equal(
      buildCreatorWiseSectionTitle("paid"),
      "Creator wise view - Paid - submissions list",
    );
  });
});
