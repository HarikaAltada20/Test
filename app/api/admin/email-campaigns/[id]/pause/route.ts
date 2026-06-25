import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const db = createAdminClient();

  const { data: campaign } = await db
    .from("admin_email_campaigns")
    .select("status")
    .eq("id", id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (!["active", "scheduled"].includes(campaign.status)) {
    return NextResponse.json(
      { error: "Only active or scheduled campaigns can be paused" },
      { status: 400 },
    );
  }

  await db
    .from("admin_email_campaigns")
    .update({ status: "paused" })
    .eq("id", id);

  return NextResponse.json({ status: "paused" });
}
