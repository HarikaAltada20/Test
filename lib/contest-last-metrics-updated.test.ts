import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contestIdsForUpdatedSubmissions } from "./contest-last-metrics-updated";

describe("contest-last-metrics-updated", () => {
  it("returns distinct contest ids for updated submissions only", () => {
    const submissions = [
      { id: "s1", contest_id: "c1" },
      { id: "s2", contest_id: "c1" },
      { id: "s3", contest_id: "c2" },
      { id: "s4", contest_id: "c3" },
    ];
    const ids = contestIdsForUpdatedSubmissions(submissions, ["s1", "s3"]);
    assert.deepEqual(ids.sort(), ["c1", "c2"]);
  });
});
