import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  EMAIL_PROJECT_WITH_SENDERS_SELECT,
  MAX_PROJECT_DESCRIPTION_LENGTH,
} from "@/lib/admin-email/project-options";
import {
  countProjectSentToday,
  normalizeScheduleTime,
} from "@/lib/admin-email/schedule";

type RouteContext = { params: Promise<{ id: string }> };

const PROJECT_SELECT = EMAIL_PROJECT_WITH_SENDERS_SELECT;

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_projects")
    .select(PROJECT_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { count: campaignCount } = await db
    .from("admin_email_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("project_id", id);

  const { data: campaignStats } = await db
    .from("admin_email_campaigns")
    .select("recipient_count, sent_count")
    .eq("project_id", id);

  let recipientTotal = 0;
  let sentTotal = 0;
  for (const c of campaignStats ?? []) {
    recipientTotal += c.recipient_count ?? 0;
    sentTotal += c.sent_count ?? 0;
  }

  const sentToday = await countProjectSentToday(
    id,
    data.schedule_timezone ?? "UTC",
  );

  return NextResponse.json({
    project: {
      ...data,
      stats: {
        campaignCount: campaignCount ?? 0,
        recipientTotal,
        sentTotal,
        sentToday,
      },
    },
  });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.name === "string") patch.name = body.name.trim();
  if (body.websiteUrl === null || typeof body.websiteUrl === "string") {
    patch.website_url =
      typeof body.websiteUrl === "string" ? body.websiteUrl.trim() || null : null;
  }
  if (body.targetAudience === null || typeof body.targetAudience === "string") {
    patch.target_audience =
      typeof body.targetAudience === "string"
        ? body.targetAudience.trim() || null
        : null;
  }
  if (body.description === null || typeof body.description === "string") {
    const desc =
      typeof body.description === "string" ? body.description.trim() : "";
    if (desc.length > MAX_PROJECT_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `Description max ${MAX_PROJECT_DESCRIPTION_LENGTH} characters` },
        { status: 400 },
      );
    }
    patch.description = desc || null;
  }
  if (typeof body.dailyLimit === "number") patch.daily_limit = body.dailyLimit;
  if (typeof body.scheduleFromTime === "string") {
    patch.schedule_from_time = normalizeScheduleTime(body.scheduleFromTime);
  }
  if (typeof body.scheduleToTime === "string") {
    patch.schedule_to_time = normalizeScheduleTime(body.scheduleToTime);
  }
  if (typeof body.scheduleTimezone === "string") {
    patch.schedule_timezone = body.scheduleTimezone;
  }
  if (typeof body.sendIntervalSeconds === "number") {
    patch.send_interval_seconds = Math.max(1, Math.min(body.sendIntervalSeconds, 3600));
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_projects")
    .update(patch)
    .eq("id", id)
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}
