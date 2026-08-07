import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bulkVerifyWalletContinuationStorageKey } from "./bulk-verify-wallet-continuation-storage";

describe("bulkVerifyWalletContinuationStorageKey", () => {
  it("is stable for the same ID set regardless of order", () => {
    const a = bulkVerifyWalletContinuationStorageKey({
      contestId: "c1",
      action: "rejected",
      reversalSubmissionIds: ["b", "a", "c"],
    });
    const b = bulkVerifyWalletContinuationStorageKey({
      contestId: "c1",
      action: "rejected",
      reversalSubmissionIds: ["c", "a", "b"],
    });
    assert.equal(a, b);
  });

  it("changes when action or contest changes", () => {
    const base = bulkVerifyWalletContinuationStorageKey({
      contestId: "c1",
      action: "rejected",
      reversalSubmissionIds: ["a"],
    });
    const otherAction = bulkVerifyWalletContinuationStorageKey({
      contestId: "c1",
      action: "verified",
      reversalSubmissionIds: ["a"],
    });
    const otherContest = bulkVerifyWalletContinuationStorageKey({
      contestId: "c2",
      action: "rejected",
      reversalSubmissionIds: ["a"],
    });
    assert.notEqual(base, otherAction);
    assert.notEqual(base, otherContest);
  });
});
