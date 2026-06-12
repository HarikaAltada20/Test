import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_campaigns")
    .select(
      "use_project_schedule, daily_limit, schedule_from_time, schedule_to_time, schedule_timezone, schedule_days, scheduled_at",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({
    useProjectDefault: data.use_project_schedule,
    dailyLimit: data.daily_limit,
    fromTime: data.schedule_from_time,
    toTime: data.schedule_to_time,
    timezone: data.schedule_timezone,
    days: data.schedule_days,
    scheduledAt: data.scheduled_at,
  });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: {
    useProjectDefault?: boolean;
    dailyLimit?: number;
    fromTime?: string;
    toTime?: string;
    timezone?: string;
    days?: number[];
    scheduledAt?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from("admin_email_campaigns")
    .update({
      use_project_schedule: body.useProjectDefault ?? true,
      daily_limit: body.dailyLimit ?? 300,
      schedule_from_time: body.fromTime ?? "09:00",
      schedule_to_time: body.toTime ?? "21:00",
      schedule_timezone: body.timezone ?? "UTC",
      schedule_days: body.days ?? [1, 2, 3, 4, 5, 6, 7],
      scheduled_at: body.scheduledAt ?? null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
