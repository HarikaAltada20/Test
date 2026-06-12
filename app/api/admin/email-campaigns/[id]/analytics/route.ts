import { NextResponse } from "next/server";
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

  return NextResponse.json({
    status: detail.status,
    progressPercent: detail.progressPercent,
    recipientCount: detail.recipientCount,
    sentCount: detail.sentCount,
    remainingCount: detail.remainingCount,
    startedAt: detail.startedAt,
    estimatedCompletionAt: detail.estimatedCompletionAt,
    summary: detail.summary,
  });
}
