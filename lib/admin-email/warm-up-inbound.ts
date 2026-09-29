/**
 * Inbound email handling for warm-up sender accounts:
 * - records emails received in the sender inbox
 * - marks outbound warm-up sends as replied
 */

import { createAdminClient } from "@/utils/supabase/admin";
import {
  canonicalMessageId,
  normalizeSesMessageId,
} from "@/lib/email/inbound-email-parse";

export type WarmUpInboundInput = {
  fromEmail: string;
  toEmail: string;
  inReplyToMessageId?: string | null;
  referenceMessageIds?: string[];
  sesMessageId?: string | null;
  receivedAt?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findWarmUpSendForReply(
  accountId: string,
  referenceIds: string[],
  fromEmail: string,
) {
  const db = createAdminClient();

  for (const refId of referenceIds) {
    const normalized = normalizeSesMessageId(refId);
    if (!normalized) continue;

    const { data: send } = await db
      .from("admin_email_warm_up_sends")
      .select("id, replied_at, opened_at")
      .eq("account_id", accountId)
      .is("replied_at", null)
      .ilike("message_id", `%${normalized}%`)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (send) return send;
  }

  const { data: sendByRecipient } = await db
    .from("admin_email_warm_up_sends")
    .select("id, replied_at, opened_at")
    .eq("account_id", accountId)
    .eq("recipient_email", normalizeEmail(fromEmail))
    .is("replied_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return sendByRecipient;
}

export async function handleWarmUpInbound(
  input: WarmUpInboundInput,
): Promise<{ handled: boolean; accountId?: string; replied?: boolean }> {
  const toEmail = normalizeEmail(input.toEmail);
  const fromEmail = normalizeEmail(input.fromEmail);
  if (!toEmail || !fromEmail) return { handled: false };

  const db = createAdminClient();
  const { data: account } = await db
    .from("admin_email_warm_up_accounts")
    .select("id, project_id, email")
    .eq("email", toEmail)
    .maybeSingle();

  if (!account) return { handled: false };

  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const sesMessageId = canonicalMessageId(input.sesMessageId);

  if (sesMessageId) {
    const { data: existing } = await db
      .from("admin_email_warm_up_received")
      .select("id")
      .eq("ses_message_id", sesMessageId)
      .maybeSingle();
    if (existing) {
      return { handled: true, accountId: account.id };
    }
  }

  await db.from("admin_email_warm_up_received").insert({
    account_id: account.id,
    project_id: account.project_id,
    from_email: fromEmail,
    ses_message_id: sesMessageId,
    received_at: receivedAt,
  });

  const referenceIds = [
    ...(input.referenceMessageIds ?? []),
    ...(input.inReplyToMessageId ? [input.inReplyToMessageId] : []),
  ].filter((id, index, all) => all.indexOf(id) === index);

  const send = await findWarmUpSendForReply(
    account.id,
    referenceIds,
    fromEmail,
  );

  if (send && !send.replied_at) {
    await db
      .from("admin_email_warm_up_sends")
      .update({
        replied_at: receivedAt,
        ...(send.opened_at ? {} : { opened_at: receivedAt }),
      })
      .eq("id", send.id);

    return { handled: true, accountId: account.id, replied: true };
  }

  return { handled: true, accountId: account.id };
}
