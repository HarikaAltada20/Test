import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolveRecipientUsers } from "@/lib/admin-notifications/recipients";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import type {
  AdminNotificationRecipientMode,
  UserManagementFilterSnapshot,
} from "@/lib/admin-notifications/types";

type RouteContext = { params: Promise<{ id: string }> };

async function rollbackAttachedRecipients(
  campaignId: string,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;
  const db = createAdminClient();
  const CHUNK = 500;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    await db
      .from("admin_email_campaign_recipients")
      .delete()
      .eq("campaign_id", campaignId)
      .in("user_id", userIds.slice(i, i + CHUNK));
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id: campaignId } = await context.params;
  let body: {
    recipientMode?: AdminNotificationRecipientMode;
    userIds?: string[];
    filters?: UserManagementFilterSnapshot;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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

  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: "Can only attach recipients to draft campaigns" },
      { status: 400 },
    );
  }

  const filterSnapshot: UserManagementFilterSnapshot = {
    ...(body.filters ?? {}),
    isActive: body.filters?.isActive !== false,
  };

  const { users, error: recipientError } = await resolveRecipientUsers({
    recipientMode: body.recipientMode ?? "selected_user_ids",
    userIds: body.userIds,
    filters: filterSnapshot,
  });

  if (recipientError || users.length === 0) {
    return NextResponse.json(
      { error: recipientError || "No recipients" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const recipientRows = users.map((u) => ({
    campaign_id: campaignId,
    user_id: u.id,
    user_type_at_send: u.user_type,
    email_delivery_status: "pending" as const,
    created_at: now,
    updated_at: now,
  }));

  const insertedUserIds: string[] = [];
  const CHUNK = 500;
  for (let i = 0; i < recipientRows.length; i += CHUNK) {
    const chunk = recipientRows.slice(i, i + CHUNK);
    const { error: recipError } = await db
      .from("admin_email_campaign_recipients")
      .insert(chunk);
    if (recipError) {
      await rollbackAttachedRecipients(campaignId, insertedUserIds);
      return NextResponse.json({ error: recipError.message }, { status: 500 });
    }
    insertedUserIds.push(...chunk.map((row) => row.user_id));
  }

  const { error: campaignUpdateError } = await db
    .from("admin_email_campaigns")
    .update({
      status: "configured",
      recipient_count: users.length,
      recipient_mode: body.recipientMode ?? "selected_user_ids",
      filter_snapshot:
        body.recipientMode === "select_all_filtered" ? filterSnapshot : null,
    })
    .eq("id", campaignId);

  if (campaignUpdateError) {
    await rollbackAttachedRecipients(campaignId, insertedUserIds);
    return NextResponse.json(
      { error: campaignUpdateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    campaignId,
    recipientCount: users.length,
    status: "configured",
  });
}
