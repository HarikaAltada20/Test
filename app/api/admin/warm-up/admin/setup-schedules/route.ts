import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  setupWarmUpQStashSchedules,
  warmUpScheduleSpecs,
} from "@/lib/admin-email/warm-up-qstash";
import { getQStashPublishBaseUrl } from "@/lib/qstash";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  return NextResponse.json({
    provider: "qstash",
    endpoint: "/api/cron/process-warm-up-sends",
    schedules: warmUpScheduleSpecs(),
    note: "POST to this route to create/update QStash schedules (requires QSTASH_TOKEN)",
  });
}

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const baseUrl = getQStashPublishBaseUrl(req);
  const result = await setupWarmUpQStashSchedules(baseUrl);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    baseUrl,
    schedules: result.schedules,
  });
}
