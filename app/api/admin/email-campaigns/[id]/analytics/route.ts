import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getCampaignStepAnalytics } from "@/lib/admin-email/campaign-analytics";
import { requireAdminApi } from "@/lib/admin-email/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  const db = createAdminClient();
  const { data: campaign } = await db
    .from("admin_email_campaigns")
    .select("id")
    .eq("id", id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const stepAnalytics = await getCampaignStepAnalytics(id);

  return NextResponse.json({ stepAnalytics });
}
