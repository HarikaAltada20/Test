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
  const limit = 50;
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
