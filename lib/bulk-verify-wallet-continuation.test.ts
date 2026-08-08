import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertBulkVerifyWalletContinuationSigningReady,
  hashReversalIds,
  issueBulkVerifyWalletContinuation,
  issueBulkVerifyWalletDebitBypass,
  verifyBulkVerifyWalletContinuation,
  verifyBulkVerifyWalletDebitBypass,
} from "./bulk-verify-wallet-continuation";

describe("bulk verify wallet continuation token", () => {
  const prevCronSecret = process.env.CRON_SECRET;
  const prevContinuationSecret =
    process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET;

  function withTestSecret(run: () => void) {
    delete process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET;
    process.env.CRON_SECRET = "test-cron-secret-for-wallet-continuation";
    try {
      run();
    } finally {
      if (prevCronSecret === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = prevCronSecret;
      }
      if (prevContinuationSecret === undefined) {
        delete process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET;
      } else {
        process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET =
          prevContinuationSecret;
      }
    }
  }

  it("issues a compact token that authorizes later chunks for the same actor/action", () => {
    withTestSecret(() => {
      const reversalIds = ["s1", "s2", "s3"];
      const token = issueBulkVerifyWalletContinuation({
        actorId: "admin-1",
        action: "pending",
        reversalIds,
        skipWalletDebitIds: ["s1", "s2"],
      });

      // Token must stay small even when the ID set is large (hash only).
      assert.ok(token.length < 500);
      assert.equal(
        JSON.parse(
          Buffer.from(token.split(".")[0]!, "base64url").toString("utf8"),
        ).reversalIdsHash,
        hashReversalIds(reversalIds),
      );

      const ok = verifyBulkVerifyWalletContinuation({
        token,
        actorId: "admin-1",
        action: "pending",
        chunkSubmissionIds: ["s3"],
        reversalSubmissionIds: reversalIds,
      });
      assert.equal(ok.ok, true);
      if (ok.ok) {
        assert.deepEqual(ok.reversalIds, ["s1", "s2", "s3"]);
      }
    });
  });

  it("rejects forged tokens, actor mismatch, ID set mismatch, and IDs outside preflight", () => {
    withTestSecret(() => {
      const reversalIds = ["s1", "s2"];
      const token = issueBulkVerifyWalletContinuation({
        actorId: "admin-1",
        action: "rejected",
        reversalIds,
        skipWalletDebitIds: ["s1"],
      });

      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token: token.slice(0, -4) + "xxxx",
          actorId: "admin-1",
          action: "rejected",
          chunkSubmissionIds: ["s2"],
          reversalSubmissionIds: reversalIds,
        }).ok,
        false,
      );

      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token,
          actorId: "other-admin",
          action: "rejected",
          chunkSubmissionIds: ["s2"],
          reversalSubmissionIds: reversalIds,
        }).ok,
        false,
      );

      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token,
          actorId: "admin-1",
          action: "pending",
          chunkSubmissionIds: ["s2"],
          reversalSubmissionIds: reversalIds,
        }).ok,
        false,
      );

      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token,
          actorId: "admin-1",
          action: "rejected",
          chunkSubmissionIds: ["s99"],
          reversalSubmissionIds: reversalIds,
        }).ok,
        false,
      );

      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token,
          actorId: "admin-1",
          action: "rejected",
          chunkSubmissionIds: ["s2"],
          reversalSubmissionIds: ["s1", "s2", "s99"],
        }).ok,
        false,
      );

      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token: true,
          actorId: "admin-1",
          action: "rejected",
          chunkSubmissionIds: ["s1"],
          reversalSubmissionIds: reversalIds,
        }).ok,
        false,
      );

      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token,
          actorId: "admin-1",
          action: "rejected",
          chunkSubmissionIds: ["s1"],
          reversalSubmissionIds: [],
        }).ok,
        false,
      );
    });
  });

  it("prefers BULK_VERIFY_WALLET_CONTINUATION_SECRET over CRON_SECRET", () => {
    const prevCron = process.env.CRON_SECRET;
    const prevCont = process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET;
    try {
      process.env.CRON_SECRET = "cron-secret";
      process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET = "continuation-secret";
      const token = issueBulkVerifyWalletContinuation({
        actorId: "admin-1",
        action: "rejected",
        reversalIds: ["s1"],
      });
      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token,
          actorId: "admin-1",
          action: "rejected",
          chunkSubmissionIds: ["s1"],
          reversalSubmissionIds: ["s1"],
        }).ok,
        true,
      );
      // Token signed with continuation secret must not verify under cron-only.
      delete process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET;
      assert.equal(
        verifyBulkVerifyWalletContinuation({
          token,
          actorId: "admin-1",
          action: "rejected",
          chunkSubmissionIds: ["s1"],
          reversalSubmissionIds: ["s1"],
        }).ok,
        false,
      );
    } finally {
      if (prevCron === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prevCron;
      if (prevCont === undefined) {
        delete process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET;
      } else {
        process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET = prevCont;
      }
    }
  });

  it("assertSigningReady fails without secrets and passes with either", () => {
    const prevCron = process.env.CRON_SECRET;
    const prevCont = process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET;
    try {
      delete process.env.CRON_SECRET;
      delete process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET;
      assert.throws(() => assertBulkVerifyWalletContinuationSigningReady());
      process.env.CRON_SECRET = "ready-secret";
      assert.doesNotThrow(() =>
        assertBulkVerifyWalletContinuationSigningReady(),
      );
      delete process.env.CRON_SECRET;
      process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET = "cont-ready";
      assert.doesNotThrow(() =>
        assertBulkVerifyWalletContinuationSigningReady(),
      );
    } finally {
      if (prevCron === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prevCron;
      if (prevCont === undefined) {
        delete process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET;
      } else {
        process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET = prevCont;
      }
    }
  });

  it("scopes wallet debit bypass authorization to one actor, action, and submission", () => {
    withTestSecret(() => {
      const token = issueBulkVerifyWalletDebitBypass({
        actorId: "admin-1",
        action: "rejected",
        submissionId: "s1",
      });
      assert.equal(
        verifyBulkVerifyWalletDebitBypass({
          token,
          actorId: "admin-1",
          action: "rejected",
          submissionId: "s1",
        }),
        true,
      );
      assert.equal(
        verifyBulkVerifyWalletDebitBypass({
          token,
          actorId: "admin-2",
          action: "rejected",
          submissionId: "s1",
        }),
        false,
      );
      assert.equal(
        verifyBulkVerifyWalletDebitBypass({
          token,
          actorId: "admin-1",
          action: "pending",
          submissionId: "s1",
        }),
        false,
      );
      assert.equal(
        verifyBulkVerifyWalletDebitBypass({
          token,
          actorId: "admin-1",
          action: "rejected",
          submissionId: "s2",
        }),
        false,
      );
    });
  });
});
