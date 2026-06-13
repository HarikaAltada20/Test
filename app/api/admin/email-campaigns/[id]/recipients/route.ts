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
  let query = db
    .from("admin_email_campaign_recipients")
    .select(
      `
      user_id, email_delivery_status, from_email, opened_at, clicked_at,
      user:users (email, full_name, username, user_type)
    `,
      { count: "exact" },
    )
    .eq("campaign_id", id)
    .order("user_id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    if (status === "not_opened") {
      query = query.in("email_delivery_status", ["sent", "delivered"]);
    } else {
      query = query.eq("email_delivery_status", status);
    }
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let rows = (data ?? []).map((r, idx) => {
    const user = r.user as {
      email: string;
      full_name: string | null;
      username: string | null;
      user_type: string;
    } | null;
    return {
      index: offset + idx + 1,
      userId: r.user_id,
      email: user?.email ?? "",
      fullName: user?.full_name ?? "",
      username: user?.username ?? "",
      userType: user?.user_type ?? "",
      country: "",
      status: r.email_delivery_status,
      fromEmail: r.from_email,
      openedAt: r.opened_at,
      clickedAt: r.clicked_at,
    };
  });

  if (search) {
    rows = rows.filter(
      (r) =>
        r.email.toLowerCase().includes(search) ||
        r.fullName.toLowerCase().includes(search) ||
        r.username.toLowerCase().includes(search),
    );
  }

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
  let body: { userIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userIds = body.userIds?.filter(Boolean) ?? [];
  if (userIds.length === 0) {
    return NextResponse.json({ error: "userIds is required" }, { status: 400 });
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

  let idsToDelete = userIds;

  if (campaign.status === "active") {
    const { data: recipients } = await db
      .from("admin_email_campaign_recipients")
      .select("user_id, email_delivery_status")
      .eq("campaign_id", campaignId)
      .in("user_id", userIds);

    idsToDelete = (recipients ?? [])
      .filter((r) => r.email_delivery_status === "pending")
      .map((r) => r.user_id);

    if (idsToDelete.length === 0) {
      return NextResponse.json(
        { error: "No pending leads to remove from an active campaign" },
        { status: 400 },
      );
    }
  }

  await db
    .from("admin_email_tracking")
    .delete()
    .eq("campaign_id", campaignId)
    .in("user_id", idsToDelete);

  let deletedTotal = 0;
  const CHUNK = 100;
  for (let i = 0; i < idsToDelete.length; i += CHUNK) {
    const chunk = idsToDelete.slice(i, i + CHUNK);
    const { error: deleteError, count } = await db
      .from("admin_email_campaign_recipients")
      .delete({ count: "exact" })
      .eq("campaign_id", campaignId)
      .in("user_id", chunk);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    deletedTotal += count ?? chunk.length;
  }

  const { count: remainingCount } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id", { count: "exact", head: true })
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
