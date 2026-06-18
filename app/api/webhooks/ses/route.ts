import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { handleWarmUpSesEvent } from "@/lib/admin-email/warm-up-events";
import {
  handleSnsSubscriptionConfirmation,
  isDirectWebhookAllowed,
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
  user_id: string;
};

function dedupeCampaignRecipients(
  rows: CampaignRecipientRef[],
): CampaignRecipientRef[] {
  const seen = new Set<string>();
  const out: CampaignRecipientRef[] = [];
  for (const row of rows) {
    const key = `${row.campaign_id}:${row.user_id}`;
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
        .select("campaign_id, user_id")
        .eq("ses_message_id", messageId),
    ]);

    matches.push(...((fromSends ?? []) as CampaignRecipientRef[]));
    matches.push(...((fromRecipients ?? []) as CampaignRecipientRef[]));

    if (matches.length > 0) {
      return dedupeCampaignRecipients(matches);
    }
  }

  const { data: users } = await db
    .from("users")
    .select("id")
    .eq("email", email);

  const userIds = users?.map((user) => user.id) ?? [];
  if (userIds.length === 0) return [];

  const { data: activeRecipients } = await db
    .from("admin_email_campaign_recipients")
    .select("campaign_id, user_id")
    .in("user_id", userIds)
    .in("email_delivery_status", [
      "sent",
      "delivered",
      "opened",
      "clicked",
      "in_sequence",
    ]);

  return dedupeCampaignRecipients(
    (activeRecipients ?? []) as CampaignRecipientRef[],
  );
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

      for (const { campaign_id, user_id } of campaignRecipients) {
        await db
          .from("admin_email_campaign_recipients")
          .update({
            email_delivery_status: "bounced",
            updated_at: now,
          })
          .eq("campaign_id", campaign_id)
          .eq("user_id", user_id);

        if (messageId) {
          await db
            .from("admin_email_sequence_step_sends")
            .update({ email_delivery_status: "bounced" })
            .eq("campaign_id", campaign_id)
            .eq("user_id", user_id)
            .eq("ses_message_id", messageId);
        }
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

  if (!isDirectWebhookAllowed()) {
    return NextResponse.json(
      { error: "Direct SES notifications are disabled; use SNS" },
      { status: 401 },
    );
  }

  await applySesNotification(body);
  return NextResponse.json({ ok: true });
}
