import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bulkContestConflictMessage } from "./bulk-job-contest-lock";

describe("bulkContestConflictMessage", () => {
  it("explains payment blocking moderation", () => {
    const msg = bulkContestConflictMessage({
      kind: "payment",
      jobId: "pay-1",
    });
    assert.match(msg, /bulk payment/i);
    assert.match(msg, /verify|pending|reject/i);
  });

  it("explains moderation blocking payment", () => {
    const msg = bulkContestConflictMessage({
      kind: "moderation",
      jobId: "mod-1",
    });
    assert.match(msg, /verify|pending|reject/i);
    assert.match(msg, /bulk pay/i);
  });
});
