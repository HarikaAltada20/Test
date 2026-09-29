import { createPrivateKey, createPublicKey, sign, verify } from "crypto";
import { canonicalize } from "@/lib/goc-download/canonicalize";
import type {
  GocDownloadManifest,
  GocDownloadSignature,
  GocDownloadUnsignedPayload,
} from "@/lib/goc-download/schemas";
import { gocDownloadUnsignedPayloadSchema } from "@/lib/goc-download/schemas";

function readSigningKeyId(): string {
  const keyId = (process.env.GOC_DOWNLOAD_SIGNING_KEY_ID || "").trim();
  if (!keyId) {
    throw new Error("GOC_DOWNLOAD_SIGNING_KEY_ID is required");
  }
  return keyId;
}

function getPrivateKeyPem(): string {
  const raw = (process.env.GOC_DOWNLOAD_SIGNING_PRIVATE_KEY || "").trim();
  if (!raw) {
    throw new Error("GOC_DOWNLOAD_SIGNING_PRIVATE_KEY is required");
  }
  // Support escaped newlines from env files
  if (raw.includes("BEGIN")) {
    return raw.replace(/\\n/g, "\n");
  }
  throw new Error(
    "GOC_DOWNLOAD_SIGNING_PRIVATE_KEY must be a PKCS8 PEM Ed25519 private key",
  );
}

export function assertManifestSigningReady(): void {
  readSigningKeyId();
  createPrivateKey(getPrivateKeyPem());
}

export function getSigningKeyId(): string {
  return readSigningKeyId();
}

export function exportSigningKeyId(): string {
  return getSigningKeyId();
}

export function signCanonicalBytes(canonicalUtf8: string): GocDownloadSignature {
  const key = createPrivateKey(getPrivateKeyPem());
  const sig = sign(null, Buffer.from(canonicalUtf8, "utf8"), key);
  return {
    keyId: getSigningKeyId(),
    algorithm: "Ed25519",
    value: sig.toString("base64"),
  };
}

export function signManifestPayload(
  payload: GocDownloadUnsignedPayload,
): GocDownloadManifest {
  const parsed = gocDownloadUnsignedPayloadSchema.parse(payload);
  const canonical = canonicalize(parsed);
  const signature = signCanonicalBytes(canonical);
  return { ...parsed, signature };
}

/** Alias used by the desktop-manifest route. */
export function buildSignedManifest(
  payload: GocDownloadUnsignedPayload,
): GocDownloadManifest {
  return signManifestPayload(payload);
}

export function verifyManifestSignature(params: {
  payload: GocDownloadUnsignedPayload;
  signature: GocDownloadSignature;
  publicKeyPem: string;
  expectedKeyId?: string;
}): { ok: true } | { ok: false; reason: string } {
  if (params.signature.algorithm !== "Ed25519") {
    return { ok: false, reason: "Unsupported signature algorithm" };
  }
  if (
    params.expectedKeyId &&
    params.signature.keyId !== params.expectedKeyId
  ) {
    return { ok: false, reason: "Unexpected keyId" };
  }
  try {
    const canonical = canonicalize(params.payload);
    const key = createPublicKey(params.publicKeyPem.replace(/\\n/g, "\n"));
    const ok = verify(
      null,
      Buffer.from(canonical, "utf8"),
      key,
      Buffer.from(params.signature.value, "base64"),
    );
    return ok ? { ok: true } : { ok: false, reason: "Signature mismatch" };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Verification failed",
    };
  }
}

/** Strip signature field for verification of a full manifest object. */
export function unsignedPayloadFromManifest(
  manifest: GocDownloadManifest,
): GocDownloadUnsignedPayload {
  const { signature: _sig, ...rest } = manifest;
  void _sig;
  return gocDownloadUnsignedPayloadSchema.parse(rest);
}
