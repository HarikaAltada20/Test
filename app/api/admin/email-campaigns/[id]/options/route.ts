import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_campaigns")
    .select(
      `
      from_email, from_sender_id, stop_on_reply, recipient_mode, filter_snapshot,
      created_at, project_id, created_by,
      project:admin_email_projects (name)
    `,
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { data: senders } = await db
    .from("admin_email_project_senders")
    .select("id, email, is_default, ses_verified")
    .eq("project_id", data.project_id);

  let createdByName = "";
  if (data.created_by) {
    const { data: creator } = await db
      .from("users")
      .select("full_name")
      .eq("id", data.created_by)
      .maybeSingle();
    createdByName = creator?.full_name ?? "";
  }

  return NextResponse.json({
    fromEmail: data.from_email,
    fromSenderId: data.from_sender_id,
    stopOnReply: data.stop_on_reply,
    senders: senders ?? [],
    summary: {
      projectName: (data.project as { name: string } | null)?.name ?? "",
      createdBy: createdByName,
      recipientMode: data.recipient_mode,
      filterSnapshot: data.filter_snapshot,
      createdAt: data.created_at,
    },
  });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: { fromSenderId?: string | null; stopOnReply?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: campaign } = await db
    .from("admin_email_campaigns")
    .select("project_id")
    .eq("id", id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let fromEmail: string | null = null;
  let fromSenderId: string | null = body.fromSenderId ?? null;

  if (fromSenderId) {
    const { data: sender } = await db
      .from("admin_email_project_senders")
      .select("email")
      .eq("id", fromSenderId)
      .eq("project_id", campaign.project_id)
      .single();
    fromEmail = sender?.email ?? null;
  } else {
    const { data: defaultSender } = await db
      .from("admin_email_project_senders")
      .select("id, email")
      .eq("project_id", campaign.project_id)
      .eq("is_default", true)
      .maybeSingle();
    fromSenderId = defaultSender?.id ?? null;
    fromEmail = defaultSender?.email ?? null;
  }

  const { error } = await db
    .from("admin_email_campaigns")
    .update({
      from_sender_id: fromSenderId,
      from_email: fromEmail,
      stop_on_reply: body.stopOnReply ?? false,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fromEmail });
}
