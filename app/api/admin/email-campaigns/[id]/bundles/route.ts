import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  detachBundleFromCampaign,
  listCampaignAttachedBundles,
} from "@/lib/admin-email/lead-bundles";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id: campaignId } = await context.params;

  try {
    const bundles = await listCampaignAttachedBundles(campaignId);
    return NextResponse.json({ bundles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load bundles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id: campaignId } = await context.params;
  let body: { bundleId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bundleId = body.bundleId?.trim();
  if (!bundleId) {
    return NextResponse.json({ error: "bundleId is required" }, { status: 400 });
  }

  try {
    const result = await detachBundleFromCampaign(campaignId, bundleId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Detach failed";
    const status =
      message === "Campaign not found"
        ? 404
        : message.includes("Cannot remove")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
