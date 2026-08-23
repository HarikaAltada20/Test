import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseBulkPaymentJobPayload,
  parseBulkModerationJobPayload,
  readQueueOffset,
} from "./bulk-job-payload";

describe("parseBulkPaymentJobPayload", () => {
  it("parses items from payload json", () => {
    const payload = parseBulkPaymentJobPayload({
      items: [{ creatorId: "c1", submissionIds: ["s1", "s2"] }],
    });
    assert.ok(payload);
    assert.equal(payload!.items.length, 1);
    assert.deepEqual(payload!.items[0].submissionIds, ["s1", "s2"]);
  });

  it("returns null for empty items", () => {
    assert.equal(parseBulkPaymentJobPayload({ items: [] }), null);
    assert.equal(parseBulkPaymentJobPayload(null), null);
  });
});

describe("parseBulkModerationJobPayload", () => {
  it("parses submissionIds", () => {
    const payload = parseBulkModerationJobPayload({
      submissionIds: ["a", "b"],
    });
    assert.ok(payload);
    assert.deepEqual(payload!.submissionIds, ["a", "b"]);
    assert.equal(payload!.channel, "submissions");
  });

  it("parses twitter_tweets channel", () => {
    const payload = parseBulkModerationJobPayload({
      submissionIds: ["t1"],
      channel: "twitter_tweets",
    });
    assert.ok(payload);
    assert.equal(payload!.channel, "twitter_tweets");
  });
});

describe("readQueueOffset", () => {
  it("prefers queue_offset over processed_count", () => {
    assert.equal(readQueueOffset({ queue_offset: 3, processed_count: 10 }), 3);
    assert.equal(readQueueOffset({ processed_count: 7 }), 7);
  });
});
