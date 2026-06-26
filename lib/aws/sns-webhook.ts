/**
 * Shared helpers for AWS SNS-wrapped webhooks (SES events, inbound mail, etc.).
 */

import { createVerify, X509Certificate } from "crypto";

export type SnsEnvelope = {
  Type?: string;
  TopicArn?: string;
  Message?: string;
  SubscribeURL?: string;
  Token?: string;
  Signature?: string;
  SignatureVersion?: string;
  SigningCertURL?: string;
  MessageId?: string;
  Timestamp?: string;
  Subject?: string;
};

const SNS_SIGNABLE_FIELDS: Record<string, string[]> = {
  Notification: [
    "Message",
    "MessageId",
    "Subject",
    "Timestamp",
    "TopicArn",
    "Type",
  ],
  SubscriptionConfirmation: [
    "Message",
    "MessageId",
    "SubscribeURL",
    "Timestamp",
    "Token",
    "TopicArn",
    "Type",
  ],
  UnsubscribeConfirmation: [
    "Message",
    "MessageId",
    "SubscribeURL",
    "Timestamp",
    "Token",
    "TopicArn",
    "Type",
  ],
};

const certCache = new Map<string, { pem: string; expiresAt: number }>();
const CERT_CACHE_TTL_MS = 60 * 60 * 1000;

function snsTopicArnEnvKeys(): string[] {
  return [
    process.env.SES_SNS_TOPIC_ARN?.trim(),
    process.env.INBOUND_SNS_TOPIC_ARN?.trim(),
  ].filter((value): value is string => Boolean(value));
}

/** When topic ARNs are configured, require an exact match. */
export function isAuthorizedSnsTopic(topicArn: string | undefined): boolean {
  const allowed = snsTopicArnEnvKeys();
  if (allowed.length === 0) {
    return process.env.NODE_ENV !== "production";
  }
  if (!topicArn) return false;
  return allowed.includes(topicArn);
}

export function isSnsEnvelope(
  body: Record<string, unknown>,
): body is SnsEnvelope {
  return typeof body.Type === "string";
}

function shouldVerifySnsSignature(): boolean {
  if (
    process.env.SNS_SKIP_SIGNATURE_VERIFICATION === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    return false;
  }
  return true;
}

function isAllowedAmazonAwsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host.endsWith(".amazonaws.com");
  } catch {
    return false;
  }
}

function isValidSigningCertUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host.startsWith("sns.") && host.endsWith(".amazonaws.com");
  } catch {
    return false;
  }
}

function envelopeAsSignableRecord(
  envelope: SnsEnvelope,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(envelope)) {
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

function buildStringToSign(
  message: Record<string, string>,
  type: string,
  signatureVersion: string,
): string | null {
  const fields = SNS_SIGNABLE_FIELDS[type];
  if (!fields) return null;

  const present = fields.filter((field) => {
    if (field === "Subject" && message.Subject === undefined) return false;
    return message[field] !== undefined;
  });

  const ordered =
    signatureVersion === "2"
      ? [...present].sort((a, b) => a.localeCompare(b))
      : present;

  return ordered.map((field) => `${field}\n${message[field]}\n`).join("");
}

async function fetchSigningCertificate(pemUrl: string): Promise<string | null> {
  const cached = certCache.get(pemUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.pem;
  }

  const response = await fetch(pemUrl);
  if (!response.ok) return null;

  const pem = await response.text();
  certCache.set(pemUrl, {
    pem,
    expiresAt: Date.now() + CERT_CACHE_TTL_MS,
  });
  return pem;
}

/**
 * Verifies the AWS SNS cryptographic signature on the raw envelope.
 * Returns null when valid; otherwise an error message.
 */
export async function verifySnsEnvelopeSignature(
  envelope: SnsEnvelope,
): Promise<string | null> {
  if (!shouldVerifySnsSignature()) {
    return null;
  }

  const type = envelope.Type;
  const signature = envelope.Signature?.trim();
  const signingCertUrl = envelope.SigningCertURL?.trim();
  const signatureVersion = envelope.SignatureVersion?.trim() || "1";

  if (!type || !signature || !signingCertUrl) {
    return "Missing SNS signature fields";
  }

  if (!isValidSigningCertUrl(signingCertUrl)) {
    return "Invalid SNS signing certificate URL";
  }

  const stringToSign = buildStringToSign(
    envelopeAsSignableRecord(envelope),
    type,
    signatureVersion,
  );
  if (!stringToSign) {
    return `Unsupported SNS message type: ${type}`;
  }

  const pem = await fetchSigningCertificate(signingCertUrl);
  if (!pem) {
    return "Failed to fetch SNS signing certificate";
  }

  try {
    const cert = new X509Certificate(pem);
    const algorithm =
      signatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
    const verifier = createVerify(algorithm);
    verifier.update(stringToSign, "utf8");
    const valid = verifier.verify(cert.publicKey, signature, "base64");
    return valid ? null : "Invalid SNS signature";
  } catch (err) {
    const message = err instanceof Error ? err.message : "SNS verify failed";
    return message;
  }
}

export async function handleSnsSubscriptionConfirmation(
  envelope: SnsEnvelope,
): Promise<{ subscribed: boolean; error?: string }> {
  if (envelope.Type !== "SubscriptionConfirmation" || !envelope.SubscribeURL) {
    return { subscribed: false };
  }
  if (!isAuthorizedSnsTopic(envelope.TopicArn)) {
    return { subscribed: false, error: "Unauthorized SNS topic" };
  }

  const signatureError = await verifySnsEnvelopeSignature(envelope);
  if (signatureError) {
    return { subscribed: false, error: signatureError };
  }

  if (!isAllowedAmazonAwsUrl(envelope.SubscribeURL)) {
    return { subscribed: false, error: "Invalid SubscribeURL host" };
  }

  try {
    await fetch(envelope.SubscribeURL);
    return { subscribed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Subscribe failed";
    return { subscribed: false, error: message };
  }
}

/**
 * Returns parsed inner JSON for SNS Notification envelopes, or null when
 * unauthorized / not a notification.
 */
export async function parseAuthorizedSnsNotification<
  T extends Record<string, unknown>,
>(envelope: SnsEnvelope): Promise<T | null> {
  if (envelope.Type !== "Notification" || typeof envelope.Message !== "string") {
    return null;
  }
  if (!isAuthorizedSnsTopic(envelope.TopicArn)) {
    return null;
  }

  const signatureError = await verifySnsEnvelopeSignature(envelope);
  if (signatureError) {
    return null;
  }

  try {
    return JSON.parse(envelope.Message) as T;
  } catch {
    return null;
  }
}
