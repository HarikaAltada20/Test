/**
 * SES event handling for warm-up send records.
 */

import { createAdminClient } from "@/utils/supabase/admin";
import { normalizeSesMessageId } from "@/lib/email/inbound-email-parse";
import type { WarmUpSendRow } from "./warm-up-service";

type SesEventPayload = {
  notificationType?: string;
  eventType?: string;
  mail?: { messageId?: string };
  bounce?: {
    bounceType?: string;
    bouncedRecipients?: Array<{ emailAddress?: string }>;
  };
  complaint?: {
    complainedRecipients?: Array<{ emailAddress?: string }>;
  };
};

const SEND_LOOKUP_FIELDS =
  "id, account_id, is_delivered, opened_at, clicked_at, is_bounced, is_complained";

function eventKind(payload: SesEventPayload): string | undefined {
  return payload.eventType ?? payload.notificationType;
}

async function findWarmUpSendByMessageId(
  messageId: string,
): Promise<Pick<
  WarmUpSendRow,
  | "id"
  | "account_id"
  | "is_delivered"
  | "opened_at"
  | "clicked_at"
  | "is_bounced"
  | "is_complained"
> | null> {
  const db = createAdminClient();

  const { data: exact } = await db
    .from("admin_email_warm_up_sends")
    .select(SEND_LOOKUP_FIELDS)
    .eq("message_id", messageId)
    .maybeSingle();
  if (exact) return exact;

  const normalized = normalizeSesMessageId(messageId);
  if (!normalized) return null;

  const { data: fuzzy } = await db
    .from("admin_email_warm_up_sends")
    .select(SEND_LOOKUP_FIELDS)
    .ilike("message_id", `%${normalized}%`)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return fuzzy;
}

export async function handleWarmUpSesEvent(
  payload: SesEventPayload,
): Promise<{ updated: boolean }> {
  const messageId = payload.mail?.messageId?.trim();
  if (!messageId) return { updated: false };

  const send = await findWarmUpSendByMessageId(messageId);
  if (!send) return { updated: false };

  const now = new Date().toISOString();
  const kind = eventKind(payload);
  const patch: Record<string, unknown> = {};

  switch (kind) {
    case "Delivery":
      patch.is_delivered = true;
      break;
    case "Open":
      if (!send.opened_at) patch.opened_at = now;
      break;
    case "Click":
      if (!send.clicked_at) patch.clicked_at = now;
      if (!send.opened_at) patch.opened_at = now;
      break;
    case "Bounce":
      patch.is_bounced = true;
      patch.is_delivered = false;
      patch.bounce_type = payload.bounce?.bounceType ?? "unknown";
      break;
    case "Complaint":
      patch.is_complained = true;
      break;
    default:
      return { updated: false };
  }

  const db = createAdminClient();
  await db
    .from("admin_email_warm_up_sends")
    .update(patch)
    .eq("id", send.id);

  return { updated: true };
}
