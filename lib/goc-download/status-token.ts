import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_PURPOSE = "goc-desktop-status" as const;
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 2 * 60 * 1000;

export type DesktopStatusTokenPayload = {
  purpose: typeof TOKEN_PURPOSE;
  jobId: string;
  userId: string;
  exp: number;
};

function getStatusHmacSecret(): string {
  const secret = (process.env.GOC_DOWNLOAD_STATUS_HMAC_SECRET || "").trim();
  if (!secret) {
    throw new Error(
      "GOC_DOWNLOAD_STATUS_HMAC_SECRET is required for desktop status tokens",
    );
  }
  if (secret.length < 32) {
    throw new Error(
      "GOC_DOWNLOAD_STATUS_HMAC_SECRET must be at least 32 characters",
    );
  }
  return secret;
}

export function assertDesktopStatusSigningReady(): void {
  getStatusHmacSecret();
}

function encodePayload(payload: DesktopStatusTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signEncoded(encoded: string): string {
  return createHmac("sha256", getStatusHmacSecret())
    .update(encoded)
    .digest("base64url");
}

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function issueDesktopStatusToken(params: {
  jobId: string;
  userId: string;
  ttlMs?: number;
  /** Alternate TTL in seconds (desktop-manifest route). */
  ttlSeconds?: number;
}): string {
  const ttlMs =
    params.ttlMs ??
    (typeof params.ttlSeconds === "number"
      ? params.ttlSeconds * 1000
      : DEFAULT_TTL_MS);
  const payload: DesktopStatusTokenPayload = {
    purpose: TOKEN_PURPOSE,
    jobId: String(params.jobId),
    userId: String(params.userId),
    exp: Date.now() + ttlMs,
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${signEncoded(encoded)}`;
}

type VerifyOk = { ok: true; claims: DesktopStatusTokenPayload; payload: DesktopStatusTokenPayload };
type VerifyErr = { ok: false; reason: string };

function verifyCore(
  token: string,
  opts: { jobId?: string; userId?: string; nowMs?: number },
): VerifyOk | VerifyErr {
  const dot = token.indexOf(".");
  if (dot <= 0) return { ok: false, reason: "Malformed status token" };
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!signature) return { ok: false, reason: "Malformed status token" };

  let expected: string;
  try {
    expected = signEncoded(encoded);
  } catch {
    return { ok: false, reason: "Status signing not configured" };
  }
  if (!safeEqualString(signature, expected)) {
    return { ok: false, reason: "Invalid status token signature" };
  }

  let payload: DesktopStatusTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as DesktopStatusTokenPayload;
  } catch {
    return { ok: false, reason: "Invalid status token payload" };
  }

  if (payload.purpose !== TOKEN_PURPOSE) {
    return { ok: false, reason: "Invalid status token purpose" };
  }
  if (opts.jobId && payload.jobId !== opts.jobId) {
    return { ok: false, reason: "Status token job mismatch" };
  }
  if (opts.userId && payload.userId !== opts.userId) {
    return { ok: false, reason: "Status token user mismatch" };
  }

  const now = opts.nowMs ?? Date.now();
  if (typeof payload.exp !== "number" || now - CLOCK_SKEW_MS > payload.exp) {
    return { ok: false, reason: "Status token expired" };
  }

  return { ok: true, claims: payload, payload };
}

/**
 * Overloads:
 * - verifyDesktopStatusToken({ token, jobId })
 * - verifyDesktopStatusToken(token, { expectedJobId })
 */
export function verifyDesktopStatusToken(
  tokenOrParams:
    | string
    | {
        token: unknown;
        jobId?: string;
        userId?: string;
        nowMs?: number;
      },
  opts?: { expectedJobId?: string; userId?: string; nowMs?: number },
): VerifyOk | VerifyErr {
  if (typeof tokenOrParams === "string") {
    if (!tokenOrParams) return { ok: false, reason: "Missing status token" };
    return verifyCore(tokenOrParams, {
      jobId: opts?.expectedJobId,
      userId: opts?.userId,
      nowMs: opts?.nowMs,
    });
  }
  if (typeof tokenOrParams.token !== "string" || !tokenOrParams.token) {
    return { ok: false, reason: "Missing status token" };
  }
  return verifyCore(tokenOrParams.token, {
    jobId: tokenOrParams.jobId,
    userId: tokenOrParams.userId,
    nowMs: tokenOrParams.nowMs,
  });
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m ? m[1].trim() : null;
}
