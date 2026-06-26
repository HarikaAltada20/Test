import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const status = req.nextUrl.searchParams.get("status");
  const search = req.nextUrl.searchParams.get("search")?.trim().toLowerCase();
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    500,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10)),
  );
  const offset = (page - 1) * limit;

  const db = createAdminClient();
  const userRelation = "user:users (email, full_name, username, user_type)";

  let query = db
    .from("admin_email_campaign_recipients")
    .select(
      `
      id,
      user_id,
      recipient_email,
      full_name,
      username,
      user_type_at_send,
      email_delivery_status,
      from_email,
      opened_at,
      clicked_at,
      ${userRelation}
    `,
      { count: "exact" },
    )
    .eq("campaign_id", id)
    .order("created_at", { ascending: true });

  if (status && status !== "all") {
    if (status === "not_opened") {
      query = query.in("email_delivery_status", ["sent", "delivered"]);
    } else {
      query = query.eq("email_delivery_status", status);
    }
  }

  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      `recipient_email.ilike.${pattern},full_name.ilike.${pattern},username.ilike.${pattern},user.email.ilike.${pattern},user.full_name.ilike.${pattern},user.username.ilike.${pattern}`,
    );
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type RecipientUser = {
    email: string;
    full_name: string | null;
    username: string | null;
    user_type: string;
  };

  const displayUserType = (value: string | null | undefined) => {
    const normalized = value?.trim();
    if (!normalized || normalized.toLowerCase() === "lead") return "";
    return normalized;
  };

  let rows = (data ?? []).map((r, idx) => {
    const rawUser = r.user as RecipientUser | RecipientUser[] | null;
    const user = Array.isArray(rawUser) ? rawUser[0] ?? null : rawUser;
    return {
      index: offset + idx + 1,
      recipientId: r.id,
      userId: r.user_id ?? null,
      email: user?.email ?? r.recipient_email ?? "",
      fullName: user?.full_name ?? r.full_name ?? "",
      username: user?.username ?? r.username ?? "",
      userType: displayUserType(user?.user_type ?? r.user_type_at_send),
      country: "",
      status: r.email_delivery_status,
      fromEmail: r.from_email,
      openedAt: r.opened_at,
      clickedAt: r.clicked_at,
    };
  });

  return NextResponse.json({
    recipients: rows,
    page,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / limit),
  });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id: campaignId } = await context.params;
  let body: { userIds?: string[]; recipientIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const requestedIds = Array.from(
    new Set([...(body.recipientIds ?? []), ...(body.userIds ?? [])].filter(Boolean)),
  );
  if (requestedIds.length === 0) {
    return NextResponse.json(
      { error: "recipientIds or userIds is required" },
      { status: 400 },
    );
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

  if (campaign.status === "completed" || campaign.status === "partial") {
    return NextResponse.json(
      { error: "Cannot remove leads from a completed campaign" },
      { status: 400 },
    );
  }

  const { data: campaignRecipients, error: recipientsError } = await db
    .from("admin_email_campaign_recipients")
    .select("id, user_id, email_delivery_status")
    .eq("campaign_id", campaignId);

  if (recipientsError) {
    return NextResponse.json({ error: recipientsError.message }, { status: 500 });
  }

  const requestedIdSet = new Set(requestedIds);
  let recipientsToDelete = (campaignRecipients ?? []).filter(
    (recipient) =>
      requestedIdSet.has(recipient.id) ||
      (recipient.user_id && requestedIdSet.has(recipient.user_id)),
  );

  if (campaign.status === "active") {
    recipientsToDelete = recipientsToDelete.filter(
      (recipient) => recipient.email_delivery_status === "pending",
    );
  }

  if (recipientsToDelete.length === 0) {
    return NextResponse.json(
      {
        error:
          campaign.status === "active"
            ? "No pending leads to remove from an active campaign"
            : "No matching leads found to remove",
      },
      { status: 400 },
    );
  }

  const recipientIdsToDelete = recipientsToDelete.map((recipient) => recipient.id);
  const userIdsForTracking = recipientsToDelete
    .map((recipient) => recipient.user_id)
    .filter((id): id is string => Boolean(id));

  if (userIdsForTracking.length > 0) {
    await db
      .from("admin_email_tracking")
      .delete()
      .eq("campaign_id", campaignId)
      .in("user_id", userIdsForTracking);
  }

  let deletedTotal = 0;
  const CHUNK = 100;
  for (let i = 0; i < recipientIdsToDelete.length; i += CHUNK) {
    const chunk = recipientIdsToDelete.slice(i, i + CHUNK);
    const { error: deleteError, count } = await db
      .from("admin_email_campaign_recipients")
      .delete({ count: "exact" })
      .eq("campaign_id", campaignId)
      .in("id", chunk);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    deletedTotal += count ?? chunk.length;
  }

  const { count: remainingCount } = await db
    .from("admin_email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const recipientCount = remainingCount ?? 0;
  const updates: { recipient_count: number; status?: string } = {
    recipient_count: recipientCount,
  };
  if (recipientCount === 0 && campaign.status === "configured") {
    updates.status = "draft";
  }

  await db.from("admin_email_campaigns").update(updates).eq("id", campaignId);

  return NextResponse.json({
    deletedCount: deletedTotal,
    recipientCount,
  });
}
