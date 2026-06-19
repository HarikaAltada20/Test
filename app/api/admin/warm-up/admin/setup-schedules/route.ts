import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { warmUpScheduleSpecs } from "@/lib/admin-email/warm-up-cron";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  return NextResponse.json({
    provider: "vercel",
    endpoint: "/api/cron/process-warm-up-sends",
    schedules: warmUpScheduleSpecs(),
    note: "Warm-up crons are defined in vercel.json and deploy with the app. No manual setup required.",
  });
}

export async function POST() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  return NextResponse.json({
    success: true,
    provider: "vercel",
    schedules: warmUpScheduleSpecs(),
    message:
      "Warm-up schedules are managed in vercel.json. Redeploy to apply cron changes.",
  });
}
