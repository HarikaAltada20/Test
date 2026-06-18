import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { handleWarmUpSesEvent } from "@/lib/admin-email/warm-up-events";
import {
  handleSnsSubscriptionConfirmation,
  isAuthorizedSnsTopic,
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

async function applySesNotification(notification: SesNotification): Promise<void> {
  const db = createAdminClient();
  const now = new Date().toISOString();

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

      const { data: users } = await db
        .from("users")
        .select("id")
        .eq("email", email);

      const userIds = users?.map((u) => u.id) ?? [];
      if (userIds.length === 0) continue;

      await db
        .from("admin_email_campaign_recipients")
        .update({
          email_delivery_status: "bounced",
          updated_at: now,
        })
        .in("user_id", userIds);
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
