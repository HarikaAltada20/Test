import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getEmailCampaignDetail } from "@/lib/admin-email/campaign-detail";
import { requireAdminApi } from "@/lib/admin-email/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const detail = await getEmailCampaignDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function DELETE(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const db = createAdminClient();

  const { data: campaign } = await db
    .from("admin_email_campaigns")
    .select("id, status, name")
    .eq("id", id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (campaign.status === "active") {
    return NextResponse.json(
      { error: "Pause the campaign before deleting" },
      { status: 400 },
    );
  }

  const { error } = await db.from("admin_email_campaigns").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: campaign.id, name: campaign.name });
}
