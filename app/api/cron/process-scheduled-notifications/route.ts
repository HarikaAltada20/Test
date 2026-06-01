import { NextRequest, NextResponse } from "next/server";
import {
  processDueScheduledCampaigns,
  processScheduledCampaignById,
} from "@/lib/admin-notifications/delivery";
import { authorizeProcessScheduledNotifications } from "@/lib/qstash";

export const dynamic = "force-dynamic";

async function handleProcess(
  campaignId?: string,
): Promise<NextResponse> {
  if (campaignId) {
    const result = await processScheduledCampaignById(campaignId);
    const retryable =
      result.reason === "not_due" || result.reason === "lock_failed";
    return NextResponse.json(
      {
        ok: result.processed,
        mode: "single",
        campaignId,
        ...result,
      },
      { status: result.processed || !retryable ? 200 : 503 },
    );
  }

  const processed = await processDueScheduledCampaigns(50);
  return NextResponse.json({ ok: true, mode: "sweep", processed });
}

export async function GET(request: NextRequest) {
  const authorized = await authorizeProcessScheduledNotifications(request, "");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleProcess();
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const authorized = await authorizeProcessScheduledNotifications(
    request,
    rawBody,
  );
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viaQStash = !!request.headers.get("Upstash-Signature");
  console.log(
    `[process-scheduled-notifications] Invoked by ${viaQStash ? "QStash" : "CRON/direct"}`,
  );

  let campaignId: string | undefined;
  if (rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody) as { campaignId?: string };
      if (parsed.campaignId && typeof parsed.campaignId === "string") {
        campaignId = parsed.campaignId;
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  return handleProcess(campaignId);
}
