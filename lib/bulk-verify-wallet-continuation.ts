import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const TOKEN_VERSION = 1 as const;

export type BulkVerifyWalletContinuationPayload = {
  v: typeof TOKEN_VERSION;
  actorId: string;
  action: string;
  /** Sorted unique IDs covered by the wallet preflight. */
  reversalIds: string[];
  /** IDs that already had wallet debit applied in preflight. */
  skipWalletDebitIds: string[];
  exp: number;
};

function getSigningSecret(): string {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    throw new Error(
      "CRON_SECRET is required to sign wallet continuation tokens",
    );
  }
  return secret;
}

function sortUniqueIds(ids: readonly string[]): string[] {
  return Array.from(
    new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
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
  skipWalletDebitIds: readonly string[];
  ttlMs?: number;
}): string {
  const payload: BulkVerifyWalletContinuationPayload = {
    v: TOKEN_VERSION,
    actorId: String(params.actorId),
    action: String(params.action),
    reversalIds: sortUniqueIds(params.reversalIds),
    skipWalletDebitIds: sortUniqueIds(params.skipWalletDebitIds),
    exp: Date.now() + (params.ttlMs ?? TOKEN_TTL_MS),
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${signEncodedPayload(encoded)}`;
}

export type VerifyWalletContinuationResult =
  | {
      ok: true;
      payload: BulkVerifyWalletContinuationPayload;
      skipWalletDebitIds: Set<string>;
    }
  | { ok: false; error: string };

/**
 * Validates a continuation token for a later chunk. Rejects forged / expired /
 * mismatched actor-action tokens and chunks that include IDs outside the
 * original preflight set.
 */
export function verifyBulkVerifyWalletContinuation(params: {
  token: unknown;
  actorId: string;
  action: string;
  chunkSubmissionIds: readonly string[];
}): VerifyWalletContinuationResult {
  if (typeof params.token !== "string" || !params.token.includes(".")) {
    return { ok: false, error: "Invalid wallet reversal continuation token" };
  }

  const [encoded, signature] = params.token.split(".");
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
  if (!payload.actorId || !payload.action || !Array.isArray(payload.reversalIds)) {
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

  const allowed = new Set(payload.reversalIds.map(String));
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
    skipWalletDebitIds: new Set(
      (payload.skipWalletDebitIds || []).map(String).filter(Boolean),
    ),
  };
}
