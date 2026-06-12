import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

type SesNotification = {
  notificationType?: string;
  bounce?: {
    bouncedRecipients?: Array<{ emailAddress?: string }>;
  };
  complaint?: {
    complainedRecipients?: Array<{ emailAddress?: string }>;
  };
};

export async function POST(req: NextRequest) {
  let body: SesNotification | { Type?: string; Message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let notification: SesNotification = body as SesNotification;
  if ("Message" in body && typeof body.Message === "string") {
    try {
      notification = JSON.parse(body.Message) as SesNotification;
    } catch {
      return NextResponse.json({ ok: true });
    }
  }

  const db = createAdminClient();
  const now = new Date().toISOString();

  if (notification.notificationType === "Bounce") {
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

      await db
        .from("admin_email_campaign_recipients")
        .update({
          email_delivery_status: "bounced",
          updated_at: now,
        })
        .in(
          "user_id",
          (
            await db.from("users").select("id").eq("email", email)
          ).data?.map((u) => u.id) ?? [],
        );
    }
  }

  if (notification.notificationType === "Complaint") {
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

  return NextResponse.json({ ok: true });
}
