import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { sendSesEmail } from "@/lib/email/ses-client";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: {
    to_emails?: string[];
    subject?: string;
    body?: string;
    from_email?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emails = (body.to_emails ?? []).map((e) => e.trim()).filter(Boolean);
  if (!emails.length) {
    return NextResponse.json({ error: "to_emails required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: campaign } = await db
    .from("admin_email_campaigns")
    .select("project_id, from_email")
    .eq("id", id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let fromEmail = body.from_email?.trim() || campaign.from_email;
  if (!fromEmail) {
    const { data: sender } = await db
      .from("admin_email_project_senders")
      .select("email")
      .eq("project_id", campaign.project_id)
      .eq("is_default", true)
      .maybeSingle();
    fromEmail =
      sender?.email ?? process.env.SES_FROM_EMAIL?.trim() ?? null;
  }

  if (!fromEmail) {
    return NextResponse.json(
      { error: "No sender email configured" },
      { status: 400 },
    );
  }

  const subject = body.subject?.trim() || "Test Email";
  const html = body.body?.trim() || "<p>Test email from your sequence.</p>";

  let sentCount = 0;
  const errors: string[] = [];

  for (const to of emails) {
    const result = await sendSesEmail({ from: fromEmail, to, subject, html });
    if (result.error) errors.push(`${to}: ${result.error}`);
    else sentCount += 1;
  }

  return NextResponse.json({
    success: sentCount > 0,
    sent_count: sentCount,
    message:
      errors.length > 0
        ? errors.join("; ")
        : `Sent ${sentCount} test email(s)`,
  });
}
