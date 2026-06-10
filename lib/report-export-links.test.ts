import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCreatorProfileUrl,
  resolveExportContentUrl,
} from "@/lib/report-export-links";

describe("report export links", () => {
  it("canonicalizes instagram reel URLs", () => {
    assert.equal(
      resolveExportContentUrl(
        "https://www.instagram.com/reel/DYH5T-JKN4x/",
        "instagram",
      ),
      "https://www.instagram.com/reel/DYH5T-JKN4x/",
    );
  });

  it("resolves nested instagram reel paths", () => {
    assert.equal(
      resolveExportContentUrl(
        "https://www.instagram.com/thinkwithnitinn/reel/DYH5T-JKN4x/",
        "instagram",
      ),
      "https://www.instagram.com/reel/DYH5T-JKN4x/",
    );
  });

  it("does not treat instagram profile URLs as content links", () => {
    assert.equal(
      resolveExportContentUrl(
        "https://www.instagram.com/thinkwithnitinn/",
        "instagram",
      ),
      null,
    );
  });

  it("builds instagram profile URLs from usernames", () => {
    assert.equal(
      buildCreatorProfileUrl("thinkwithnitinn", "instagram"),
      "https://www.instagram.com/thinkwithnitinn/",
    );
  });

  it("builds tiktok profile URLs from usernames", () => {
    assert.equal(
      buildCreatorProfileUrl("@creator", "tiktok"),
      "https://www.tiktok.com/@creator",
    );
  });
});
