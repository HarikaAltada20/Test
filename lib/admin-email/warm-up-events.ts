/**
 * SES event handling for warm-up send records.
 */

import { createAdminClient } from "@/utils/supabase/admin";
import { recalculateAccountHealthScore } from "@/lib/admin-email/warm-up-service";

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

function eventKind(payload: SesEventPayload): string | undefined {
  return payload.eventType ?? payload.notificationType;
}

export async function handleWarmUpSesEvent(
  payload: SesEventPayload,
): Promise<{ updated: boolean }> {
  const messageId = payload.mail?.messageId?.trim();
  if (!messageId) return { updated: false };

  const db = createAdminClient();
  const { data: send } = await db
    .from("admin_email_warm_up_sends")
    .select("id, account_id, is_delivered, opened_at, clicked_at, is_bounced, is_complained")
    .eq("message_id", messageId)
    .maybeSingle();

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

  await db
    .from("admin_email_warm_up_sends")
    .update(patch)
    .eq("id", send.id);

  if (
    kind === "Delivery" ||
    kind === "Open" ||
    kind === "Click" ||
    kind === "Bounce" ||
    kind === "Complaint"
  ) {
    try {
      await recalculateAccountHealthScore(send.account_id);
    } catch {
      // Non-fatal: send row was still updated
    }
  }

  return { updated: true };
}
