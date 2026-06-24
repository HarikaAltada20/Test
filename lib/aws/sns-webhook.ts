/**
 * Shared helpers for AWS SNS-wrapped webhooks (SES events, inbound mail, etc.).
 */

export type SnsEnvelope = {
  Type?: string;
  TopicArn?: string;
  Message?: string;
  SubscribeURL?: string;
  Token?: string;
};

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

export async function handleSnsSubscriptionConfirmation(
  envelope: SnsEnvelope,
): Promise<{ subscribed: boolean; error?: string }> {
  if (envelope.Type !== "SubscriptionConfirmation" || !envelope.SubscribeURL) {
    return { subscribed: false };
  }
  if (!isAuthorizedSnsTopic(envelope.TopicArn)) {
    return { subscribed: false, error: "Unauthorized SNS topic" };
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
export function parseAuthorizedSnsNotification<T extends Record<string, unknown>>(
  envelope: SnsEnvelope,
): T | null {
  if (envelope.Type !== "Notification" || typeof envelope.Message !== "string") {
    return null;
  }
  if (!isAuthorizedSnsTopic(envelope.TopicArn)) {
    return null;
  }
  try {
    return JSON.parse(envelope.Message) as T;
  } catch {
    return null;
  }
}
