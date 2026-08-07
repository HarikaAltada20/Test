import { createHash, createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TOKEN_VERSION = 2 as const;

/**
 * Compact continuation payload: stores a hash of the preflight ID set instead of
 * embedding thousands of UUIDs (keeps later chunk request bodies small).
 */
export type BulkVerifyWalletContinuationPayload = {
  v: typeof TOKEN_VERSION;
  actorId: string;
  action: string;
  /** SHA-256 hex of sorted unique reversal IDs joined by comma. */
  reversalIdsHash: string;
  exp: number;
};

function getSigningSecret(): string {
  const secret = (
    process.env.BULK_VERIFY_WALLET_CONTINUATION_SECRET ||
    process.env.CRON_SECRET ||
    ""
  ).trim();
  if (!secret) {
    throw new Error(
      "BULK_VERIFY_WALLET_CONTINUATION_SECRET or CRON_SECRET is required to sign wallet continuation tokens",
    );
  }
  return secret;
}

/** Fail before wallet debit if continuation tokens cannot be signed. */
export function assertBulkVerifyWalletContinuationSigningReady(): void {
  getSigningSecret();
}

export function sortUniqueIds(ids: readonly string[]): string[] {
  return Array.from(
    new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
}

/** Stable hash of the full wallet-preflight ID set. */
export function hashReversalIds(ids: readonly string[]): string {
  return createHash("sha256")
    .update(sortUniqueIds(ids).join(","))
    .digest("hex");
}

function encodePayload(payload: BulkVerifyWalletContinuationPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signEncodedPayload(encoded: string): string {
  return createHmac("sha256", getSigningSecret())
    .update(encoded)
    .digest("base64url");
}

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Issue after a successful full-set wallet preflight so later verify chunks can
 * skip re-debit without trusting a client boolean.
 */
export function issueBulkVerifyWalletContinuation(params: {
  actorId: string;
  action: string;
  reversalIds: readonly string[];
  /** @deprecated Ignored — later chunks force-skip wallet debit for the whole set. */
  skipWalletDebitIds?: readonly string[];
  ttlMs?: number;
}): string {
  const payload: BulkVerifyWalletContinuationPayload = {
    v: TOKEN_VERSION,
    actorId: String(params.actorId),
    action: String(params.action),
    reversalIdsHash: hashReversalIds(params.reversalIds),
    exp: Date.now() + (params.ttlMs ?? TOKEN_TTL_MS),
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${signEncodedPayload(encoded)}`;
}

export type VerifyWalletContinuationResult =
  | {
      ok: true;
      payload: BulkVerifyWalletContinuationPayload;
      /** Full preflight set (from client); used for membership checks. */
      reversalIds: string[];
    }
  | { ok: false; error: string };

/**
 * Validates a continuation token for a later chunk. Rejects forged / expired /
 * mismatched actor-action tokens. Caller must resend the full preflight ID set
 * so the server can verify the hash and that the chunk is a subset.
 */
export function verifyBulkVerifyWalletContinuation(params: {
  token: unknown;
  actorId: string;
  action: string;
  chunkSubmissionIds: readonly string[];
  /** Full ID set from the original wallet preflight (required for v2). */
  reversalSubmissionIds: readonly string[];
}): VerifyWalletContinuationResult {
  if (typeof params.token !== "string" || !params.token.includes(".")) {
    return { ok: false, error: "Invalid wallet reversal continuation token" };
  }

  const dot = params.token.indexOf(".");
  const encoded = params.token.slice(0, dot);
  const signature = params.token.slice(dot + 1);
  if (!encoded || !signature) {
    return { ok: false, error: "Invalid wallet reversal continuation token" };
  }

  let expectedSig: string;
  try {
    expectedSig = signEncodedPayload(encoded);
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Failed to verify wallet reversal continuation",
    };
  }

  if (!safeEqualString(signature, expectedSig)) {
    return { ok: false, error: "Wallet reversal continuation signature mismatch" };
  }

  let payload: BulkVerifyWalletContinuationPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as BulkVerifyWalletContinuationPayload;
  } catch {
    return { ok: false, error: "Wallet reversal continuation payload is invalid" };
  }

  if (payload?.v !== TOKEN_VERSION) {
    return { ok: false, error: "Unsupported wallet reversal continuation version" };
  }
  if (
    !payload.actorId ||
    !payload.action ||
    typeof payload.reversalIdsHash !== "string" ||
    !payload.reversalIdsHash
  ) {
    return { ok: false, error: "Wallet reversal continuation payload is incomplete" };
  }
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
    return { ok: false, error: "Wallet reversal continuation has expired" };
  }
  if (payload.actorId !== String(params.actorId)) {
    return { ok: false, error: "Wallet reversal continuation actor mismatch" };
  }
  if (payload.action !== String(params.action)) {
    return { ok: false, error: "Wallet reversal continuation action mismatch" };
  }

  const reversalIds = sortUniqueIds(params.reversalSubmissionIds);
  if (reversalIds.length === 0) {
    return {
      ok: false,
      error:
        "walletReversalSubmissionIds is required with walletReversalContinuation",
    };
  }

  const actualHash = hashReversalIds(reversalIds);
  if (!safeEqualString(actualHash, payload.reversalIdsHash)) {
    return {
      ok: false,
      error: "Wallet reversal continuation ID set does not match preflight",
    };
  }

  const allowed = new Set(reversalIds);
  const chunkIds = sortUniqueIds(params.chunkSubmissionIds);
  const outside = chunkIds.filter((id) => !allowed.has(id));
  if (outside.length > 0) {
    return {
      ok: false,
      error:
        "Chunk includes submission IDs not covered by the wallet reversal preflight",
    };
  }

  return {
    ok: true,
    payload,
    reversalIds,
  };
}
