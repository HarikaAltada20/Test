import { NextRequest, NextResponse } from "next/server";
import {
  processDueScheduledCampaigns,
  processScheduledCampaignById,
} from "@/lib/admin-notifications/delivery";
import { authorizeProcessScheduledNotifications } from "@/lib/qstash";

export const dynamic = "force-dynamic";

function getBaseUrlFromRequest(request: Request): string {
  try {
    const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (xfHost && xfProto) return `${xfProto}://${xfHost}`;
    const u = new URL(request.url);
    return u.origin;
  } catch {
    const url = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
    return url.replace(/\/$/, "");
  }
}

async function handleProcess(
  campaignId?: string,
  baseUrl?: string,
): Promise<NextResponse> {
  if (campaignId) {
    const result = await processScheduledCampaignById(campaignId, { baseUrl });
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

  const processed = await processDueScheduledCampaigns(50, baseUrl);
  return NextResponse.json({ ok: true, mode: "sweep", processed });
}

export async function GET(request: NextRequest) {
  const authorized = await authorizeProcessScheduledNotifications(request, "");
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleProcess(undefined, getBaseUrlFromRequest(request));
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

  return handleProcess(campaignId, getBaseUrlFromRequest(request));
}
