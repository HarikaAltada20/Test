import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { normalizeCampaignSenderIds } from "@/lib/admin-email/campaign-senders";

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
      from_email, from_sender_id, from_sender_ids, stop_on_reply, recipient_mode, filter_snapshot,
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
    .eq("project_id", data.project_id)
    .order("created_at", { ascending: true });

  let createdByName = "";
  if (data.created_by) {
    const { data: creator } = await db
      .from("users")
      .select("full_name")
      .eq("id", data.created_by)
      .maybeSingle();
    createdByName = creator?.full_name ?? "";
  }

  const fromSenderIds = normalizeCampaignSenderIds(
    data.from_sender_ids,
    data.from_sender_id,
  );

  return NextResponse.json({
    fromEmail: data.from_email,
    fromSenderId: data.from_sender_id,
    fromSenderIds,
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
  let body: {
    fromSenderId?: string | null;
    fromSenderIds?: string[] | null;
    stopOnReply?: boolean;
  };
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

  const requestedIds =
    body.fromSenderIds !== undefined
      ? body.fromSenderIds?.filter((senderId) => typeof senderId === "string") ??
        []
      : body.fromSenderId
        ? [body.fromSenderId]
        : [];

  const uniqueIds = [...new Set(requestedIds.filter(Boolean))];

  let fromEmail: string | null = null;
  let fromSenderId: string | null = null;
  let fromSenderIds: string[] = [];

  if (uniqueIds.length > 0) {
    const { data: selectedSenders, error: senderError } = await db
      .from("admin_email_project_senders")
      .select("id, email")
      .eq("project_id", campaign.project_id)
      .in("id", uniqueIds);

    if (senderError) {
      return NextResponse.json({ error: senderError.message }, { status: 500 });
    }

    const byId = new Map((selectedSenders ?? []).map((row) => [row.id, row]));
    fromSenderIds = uniqueIds.filter((senderId) => byId.has(senderId));
    fromSenderId = fromSenderIds[0] ?? null;
    fromEmail = fromSenderId ? (byId.get(fromSenderId)?.email ?? null) : null;
  } else {
    const { data: defaultSender } = await db
      .from("admin_email_project_senders")
      .select("id, email")
      .eq("project_id", campaign.project_id)
      .eq("is_default", true)
      .maybeSingle();
    fromSenderId = defaultSender?.id ?? null;
    fromEmail = defaultSender?.email ?? null;
    fromSenderIds = [];
  }

  const { error } = await db
    .from("admin_email_campaigns")
    .update({
      from_sender_id: fromSenderId,
      from_sender_ids: fromSenderIds,
      from_email: fromEmail,
      stop_on_reply: body.stopOnReply ?? false,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    fromEmail,
    fromSenderIds,
  });
}
