import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { getBundleMembersForAttach } from "@/lib/admin-email/lead-bundles";
import type { AdminEmailCampaignStatus } from "@/lib/admin-email/types";

type RouteContext = { params: Promise<{ id: string }> };

const ATTACHABLE_CAMPAIGN_STATUSES: AdminEmailCampaignStatus[] = [
  "draft",
  "configured",
  "scheduled",
  "active",
  "paused",
  "completed",
  "partial",
];

async function rollbackAttachedRecipients(
  campaignId: string,
  recipientIds: string[],
): Promise<void> {
  if (recipientIds.length === 0) return;
  const db = createAdminClient();
  const CHUNK = 500;
  for (let i = 0; i < recipientIds.length; i += CHUNK) {
    await db
      .from("admin_email_campaign_recipients")
      .delete()
      .eq("campaign_id", campaignId)
      .in("id", recipientIds.slice(i, i + CHUNK));
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id: campaignId } = await context.params;
  let body: { bundleIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bundleIds = Array.from(new Set(body.bundleIds ?? []));
  if (bundleIds.length === 0) {
    return NextResponse.json({ error: "Select at least one bundle" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: campaign } = await db
    .from("admin_email_campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (
    !ATTACHABLE_CAMPAIGN_STATUSES.includes(
      campaign.status as AdminEmailCampaignStatus,
    )
  ) {
    return NextResponse.json(
      { error: `Cannot attach bundles to campaign in status: ${campaign.status}` },
      { status: 400 },
    );
  }

  const members = await getBundleMembersForAttach(bundleIds);
  if (members.length === 0) {
    return NextResponse.json(
      { error: "Selected bundles have no leads" },
      { status: 400 },
    );
  }

  const { data: existingRecipients } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id, recipient_email")
    .eq("campaign_id", campaignId);

  const existingUserIds = new Set(
    (existingRecipients ?? [])
      .map((row) => row.user_id)
      .filter((id): id is string => Boolean(id)),
  );
  const existingEmails = new Set(
    (existingRecipients ?? [])
      .map((row) => row.recipient_email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  );

  if (existingUserIds.size > 0) {
    const { data: existingUsers } = await db
      .from("users")
      .select("email")
      .in("id", Array.from(existingUserIds));

    for (const user of existingUsers ?? []) {
      const email = user.email?.trim().toLowerCase();
      if (email) existingEmails.add(email);
    }
  }

  const platformUserIds = Array.from(
    new Set(members.map((m) => m.userId).filter((id): id is string => Boolean(id))),
  );

  const { data: users } =
    platformUserIds.length > 0
      ? await db.from("users").select("id, user_type").in("id", platformUserIds)
      : { data: [] as Array<{ id: string; user_type: string }> };

  const usersById = new Map((users ?? []).map((user) => [user.id, user]));

  const now = new Date().toISOString();
  const recipientRows: Array<Record<string, unknown>> = [];

  for (const member of members) {
    if (member.userId) {
      if (existingUserIds.has(member.userId)) continue;
      const user = usersById.get(member.userId);
      if (!user) continue;

      recipientRows.push({
        campaign_id: campaignId,
        user_id: member.userId,
        user_type_at_send: user.user_type,
        email_delivery_status: "pending",
        created_at: now,
        updated_at: now,
      });
      continue;
    }

    if (existingEmails.has(member.email)) continue;

    recipientRows.push({
      campaign_id: campaignId,
      user_id: null,
      recipient_email: member.email,
      full_name: member.fullName,
      username: member.username,
      user_type_at_send: member.userType || "lead",
      email_delivery_status: "pending",
      created_at: now,
      updated_at: now,
    });
  }

  if (recipientRows.length === 0) {
    return NextResponse.json(
      { error: "All bundle leads are already in this campaign" },
      { status: 400 },
    );
  }

  const insertedRecipientIds: string[] = [];
  const CHUNK = 500;
  for (let i = 0; i < recipientRows.length; i += CHUNK) {
    const chunk = recipientRows.slice(i, i + CHUNK);
    const { data: inserted, error: recipError } = await db
      .from("admin_email_campaign_recipients")
      .insert(chunk)
      .select("id");

    if (recipError) {
      await rollbackAttachedRecipients(campaignId, insertedRecipientIds);
      return NextResponse.json({ error: recipError.message }, { status: 500 });
    }

    insertedRecipientIds.push(
      ...(inserted ?? []).map((row) => row.id).filter(Boolean),
    );
  }

  const { count: totalRecipientCount } = await db
    .from("admin_email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const campaignUpdates: {
    recipient_count: number;
    status?: string;
    completed_at?: string | null;
  } = {
    recipient_count: totalRecipientCount ?? recipientRows.length,
  };

  if (campaign.status === "draft") {
    campaignUpdates.status = "configured";
  } else if (campaign.status === "completed" || campaign.status === "partial") {
    campaignUpdates.status = "configured";
    campaignUpdates.completed_at = null;
  }

  const { error: campaignUpdateError } = await db
    .from("admin_email_campaigns")
    .update(campaignUpdates)
    .eq("id", campaignId);

  if (campaignUpdateError) {
    await rollbackAttachedRecipients(campaignId, insertedRecipientIds);
    return NextResponse.json(
      { error: campaignUpdateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    campaignId,
    recipientCount: totalRecipientCount ?? recipientRows.length,
    attachedCount: recipientRows.length,
    skippedCount: members.length - recipientRows.length,
    bundleCount: bundleIds.length,
    status: campaignUpdates.status ?? campaign.status,
  });
}
