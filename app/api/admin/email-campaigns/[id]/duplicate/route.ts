import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { duplicateEmailCampaign } from "@/lib/admin-email/duplicate-campaign";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: { name?: string } = {};
  try {
    const raw = await req.text();
    if (raw.trim()) {
      body = JSON.parse(raw);
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const campaign = await duplicateEmailCampaign(
      id,
      auth.user!.id,
      body.name,
    );
    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        project_id: campaign.project_id,
      },
      copiedRecipientCount: campaign.copiedRecipientCount,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to duplicate campaign";
    const status = message === "Campaign not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
