import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { handleWarmUpSesEvent } from "@/lib/admin-email/warm-up-events";
import {
  handleSnsSubscriptionConfirmation,
  isSnsEnvelope,
  parseAuthorizedSnsNotification,
  type SnsEnvelope,
} from "@/lib/aws/sns-webhook";

type SesNotification = {
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

type CampaignRecipientRef = {
  campaign_id: string;
  user_id: string | null;
  recipient_id: string | null;
};

function dedupeCampaignRecipients(
  rows: CampaignRecipientRef[],
): CampaignRecipientRef[] {
  const seen = new Set<string>();
  const out: CampaignRecipientRef[] = [];
  for (const row of rows) {
    const key = `${row.campaign_id}:${row.user_id ?? row.recipient_id}`;
    if (!row.user_id && !row.recipient_id) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function resolveBouncedCampaignRecipients(
  messageId: string | undefined,
  email: string,
): Promise<CampaignRecipientRef[]> {
  const db = createAdminClient();
  const matches: CampaignRecipientRef[] = [];

  if (messageId) {
    const [{ data: fromSends }, { data: fromRecipients }] = await Promise.all([
      db
        .from("admin_email_sequence_step_sends")
        .select("campaign_id, user_id")
        .eq("ses_message_id", messageId),
      db
        .from("admin_email_campaign_recipients")
        .select("campaign_id, user_id, id")
        .eq("ses_message_id", messageId),
    ]);

    for (const row of fromRecipients ?? []) {
      matches.push({
        campaign_id: row.campaign_id,
        user_id: row.user_id,
        recipient_id: row.id,
      });
    }

    for (const row of fromSends ?? []) {
      if (!row.user_id) continue;
      matches.push({
        campaign_id: row.campaign_id,
        user_id: row.user_id,
        recipient_id: null,
      });
    }

    if (matches.length > 0) {
      return dedupeCampaignRecipients(matches);
    }
  }

  const normalizedEmail = email.toLowerCase();

  const { data: users } = await db
    .from("users")
    .select("id")
    .eq("email", normalizedEmail);

  const userIds = users?.map((user) => user.id) ?? [];
  if (userIds.length > 0) {
    const { data: activeRecipients } = await db
      .from("admin_email_campaign_recipients")
      .select("campaign_id, user_id, id")
      .in("user_id", userIds)
      .in("email_delivery_status", [
        "sent",
        "delivered",
        "opened",
        "clicked",
        "in_sequence",
      ]);

    return dedupeCampaignRecipients(
      (activeRecipients ?? []).map((row) => ({
        campaign_id: row.campaign_id,
        user_id: row.user_id,
        recipient_id: row.id,
      })),
    );
  }

  const { data: externalRecipients } = await db
    .from("admin_email_campaign_recipients")
    .select("campaign_id, user_id, id")
    .is("user_id", null)
    .eq("recipient_email", normalizedEmail)
    .in("email_delivery_status", [
      "sent",
      "delivered",
      "opened",
      "clicked",
      "in_sequence",
    ]);

  return dedupeCampaignRecipients(
    (externalRecipients ?? []).map((row) => ({
      campaign_id: row.campaign_id,
      user_id: null,
      recipient_id: row.id,
    })),
  );
}

async function markCampaignRecipientBounced(
  ref: CampaignRecipientRef,
  messageId: string | undefined,
  now: string,
): Promise<void> {
  const db = createAdminClient();

  let recipientQuery = db
    .from("admin_email_campaign_recipients")
    .update({
      email_delivery_status: "bounced",
      updated_at: now,
    })
    .eq("campaign_id", ref.campaign_id);

  if (ref.user_id) {
    recipientQuery = recipientQuery.eq("user_id", ref.user_id);
  } else if (ref.recipient_id) {
    recipientQuery = recipientQuery
      .eq("id", ref.recipient_id)
      .is("user_id", null);
  } else {
    return;
  }

  await recipientQuery;

  if (messageId && ref.user_id) {
    await db
      .from("admin_email_sequence_step_sends")
      .update({ email_delivery_status: "bounced" })
      .eq("campaign_id", ref.campaign_id)
      .eq("user_id", ref.user_id)
      .eq("ses_message_id", messageId);
  }
}

async function applySesNotification(notification: SesNotification): Promise<void> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const messageId = notification.mail?.messageId;

  await handleWarmUpSesEvent(notification);

  if (
    notification.notificationType === "Bounce" ||
    notification.eventType === "Bounce"
  ) {
    const emails =
      notification.bounce?.bouncedRecipients
        ?.map((r) => r.emailAddress?.toLowerCase())
        .filter(Boolean) ?? [];

    for (const email of emails) {
      if (!email) continue;

      await db.from("email_suppressions").upsert({
        email,
        reason: "bounce",
        created_at: now,
      });

      const campaignRecipients = await resolveBouncedCampaignRecipients(
        messageId,
        email,
      );

      for (const ref of campaignRecipients) {
        await markCampaignRecipientBounced(ref, messageId, now);
      }
    }
  }

  if (
    notification.notificationType === "Complaint" ||
    notification.eventType === "Complaint"
  ) {
    const emails =
      notification.complaint?.complainedRecipients
        ?.map((r) => r.emailAddress?.toLowerCase())
        .filter(Boolean) ?? [];

    for (const email of emails) {
      if (!email) continue;
      await db.from("email_suppressions").upsert({
        email,
        reason: "complaint",
        created_at: now,
      });
    }
  }
}

export async function POST(req: NextRequest) {
  let body: SesNotification & SnsEnvelope;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (isSnsEnvelope(body)) {
    const subscription = await handleSnsSubscriptionConfirmation(body);
    if (subscription.subscribed) {
      return NextResponse.json({ ok: true, subscribed: true });
    }
    if (subscription.error) {
      return NextResponse.json({ error: subscription.error }, { status: 401 });
    }

    const notification = parseAuthorizedSnsNotification<SesNotification>(body);
    if (!notification) {
      if (body.Type === "Notification") {
        return NextResponse.json({ error: "Unauthorized SNS topic" }, { status: 401 });
      }
      return NextResponse.json({ ok: true, ignored: true });
    }

    await applySesNotification(notification);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "Direct SES notifications are disabled; use SNS" },
    { status: 401 },
  );
}
