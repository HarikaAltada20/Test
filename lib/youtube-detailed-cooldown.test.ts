import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { youtubeDetailedCooldownTimestamp } from "./youtube-detailed-cooldown";

describe("youtubeDetailedCooldownTimestamp", () => {
  const ytLast = {
    core: "2026-08-18T10:04:30.000Z",
    traffic: "2026-08-18T08:00:00.000Z",
    demographics: "2026-08-18T07:00:00.000Z",
  };

  it("returns the matching per-scope timestamp", () => {
    assert.equal(youtubeDetailedCooldownTimestamp("core", ytLast), ytLast.core);
    assert.equal(
      youtubeDetailedCooldownTimestamp("traffic", ytLast),
      ytLast.traffic,
    );
    assert.equal(
      youtubeDetailedCooldownTimestamp("demographics", ytLast),
      ytLast.demographics,
    );
  });

  it("uses the newest timestamp for all-like scopes so recent core blocks refresh all", () => {
    assert.equal(youtubeDetailedCooldownTimestamp("all", ytLast), ytLast.core);
    assert.equal(
      youtubeDetailedCooldownTimestamp("all_standard", ytLast),
      ytLast.core,
    );
  });

  it("returns null when no timestamps exist", () => {
    assert.equal(youtubeDetailedCooldownTimestamp("all", {}), null);
  });
});
