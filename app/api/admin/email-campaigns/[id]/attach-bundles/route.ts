import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  attachLeadsToCampaign,
  getBundleMembersForAttach,
  recordCampaignBundleAttachments,
} from "@/lib/admin-email/lead-bundles";
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

  try {
    const result = await attachLeadsToCampaign(campaignId, members);
    await recordCampaignBundleAttachments(campaignId, bundleIds);

    return NextResponse.json({
      campaignId,
      ...result,
      bundleCount: bundleIds.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attach failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
