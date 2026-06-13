import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  campaignFieldsFromSchedule,
  defaultScheduleItem,
  parseScheduleData,
  type CampaignScheduleItem,
  type ScheduleData,
} from "@/lib/admin-email/schedule-store";

type RouteContext = { params: Promise<{ id: string }> };

function buildGetPayload(
  row: {
    use_project_schedule: boolean;
    daily_limit: number | null;
    schedule_from_time: string | null;
    schedule_to_time: string | null;
    schedule_timezone: string | null;
    schedule_days: number[] | null;
    scheduled_at: string | null;
    schedule_data: unknown;
  },
  project?: {
    daily_limit?: number | null;
    schedule_from_time?: string | null;
    schedule_to_time?: string | null;
    schedule_timezone?: string | null;
    schedule_days?: number[] | null;
  } | null,
) {
  const scheduleData = parseScheduleData(row.schedule_data);
  const useProjectDefault = row.use_project_schedule ?? true;
  const activeScheduleId = useProjectDefault
    ? "default"
    : scheduleData.activeScheduleId !== "default"
      ? scheduleData.activeScheduleId
      : scheduleData.schedules[0]?.id ?? "default";

  const activeCustom = scheduleData.schedules.find(
    (s) => s.id === activeScheduleId,
  );

  const source =
    useProjectDefault && project
      ? {
          dailyLimit: project.daily_limit ?? 300,
          fromTime: project.schedule_from_time ?? "09:00",
          toTime: project.schedule_to_time ?? "21:00",
          timezone: project.schedule_timezone ?? "UTC",
          days: project.schedule_days ?? [1, 2, 3, 4, 5, 6, 7],
        }
      : activeCustom
        ? {
            dailyLimit: activeCustom.dailyLimit,
            fromTime: activeCustom.fromTime,
            toTime: activeCustom.toTime,
            timezone: activeCustom.timezone,
            days: activeCustom.days,
          }
        : {
            dailyLimit: row.daily_limit ?? 300,
            fromTime: row.schedule_from_time ?? "09:00",
            toTime: row.schedule_to_time ?? "21:00",
            timezone: row.schedule_timezone ?? "UTC",
            days: row.schedule_days ?? [1, 2, 3, 4, 5, 6, 7],
          };

  return {
    useProjectDefault,
    activeScheduleId,
    schedules: scheduleData.schedules,
    ...source,
    scheduledAt: row.scheduled_at,
  };
}

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_campaigns")
    .select(
      `
      use_project_schedule,
      daily_limit,
      schedule_from_time,
      schedule_to_time,
      schedule_timezone,
      schedule_days,
      scheduled_at,
      schedule_data,
      project_id
    `,
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { data: project } = await db
    .from("admin_email_projects")
    .select(
      "daily_limit, schedule_from_time, schedule_to_time, schedule_timezone, schedule_days",
    )
    .eq("id", data.project_id)
    .single();

  return NextResponse.json(buildGetPayload(data, project));
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: {
    useProjectDefault?: boolean;
    activeScheduleId?: string;
    createSchedule?: { name?: string };
    updateScheduleName?: { id?: string; name?: string };
    deleteScheduleId?: string;
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
  const { data: campaign, error: fetchError } = await db
    .from("admin_email_campaigns")
    .select(
      "use_project_schedule, daily_limit, schedule_from_time, schedule_to_time, schedule_timezone, schedule_days, schedule_data, project_id",
    )
    .eq("id", id)
    .single();

  if (fetchError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let scheduleData = parseScheduleData(campaign.schedule_data);
  let useProjectDefault = campaign.use_project_schedule ?? true;
  let activeScheduleId = useProjectDefault
    ? "default"
    : scheduleData.activeScheduleId;

  if (body.createSchedule?.name?.trim()) {
    const { data: project } = await db
      .from("admin_email_projects")
      .select(
        "daily_limit, schedule_from_time, schedule_to_time, schedule_timezone, schedule_days",
      )
      .eq("id", campaign.project_id)
      .single();

    const item = defaultScheduleItem(body.createSchedule.name.trim(), {
      dailyLimit: project?.daily_limit ?? 300,
      fromTime: project?.schedule_from_time ?? "09:00",
      toTime: project?.schedule_to_time ?? "21:00",
      timezone: project?.schedule_timezone ?? "UTC",
      days: project?.schedule_days ?? [1, 2, 3, 4, 5, 6, 7],
    });

    scheduleData = {
      activeScheduleId: item.id,
      schedules: [...scheduleData.schedules, item],
    };
    useProjectDefault = false;
    activeScheduleId = item.id;

    const fields = campaignFieldsFromSchedule(item);
    const { error } = await db
      .from("admin_email_campaigns")
      .update({
        use_project_schedule: false,
        schedule_data: scheduleData,
        ...fields,
        scheduled_at: body.scheduledAt ?? null,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      schedule: item,
      activeScheduleId: item.id,
      useProjectDefault: false,
    });
  }

  if (body.deleteScheduleId) {
    const deleteId = body.deleteScheduleId;
    const wasActive =
      !useProjectDefault && activeScheduleId === deleteId;
    const remaining = scheduleData.schedules.filter((s) => s.id !== deleteId);

    if (remaining.length === scheduleData.schedules.length) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    if (wasActive) {
      if (remaining.length === 0) {
        useProjectDefault = true;
        activeScheduleId = "default";
        scheduleData = { activeScheduleId: "default", schedules: [] };
        const { error } = await db
          .from("admin_email_campaigns")
          .update({
            use_project_schedule: true,
            schedule_data: scheduleData,
          })
          .eq("id", id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          ok: true,
          activeScheduleId: "default",
          useProjectDefault: true,
        });
      }

      const next = remaining[0];
      useProjectDefault = false;
      activeScheduleId = next.id;
      scheduleData = { activeScheduleId: next.id, schedules: remaining };
      const fields = campaignFieldsFromSchedule(next);
      const { error } = await db
        .from("admin_email_campaigns")
        .update({
          use_project_schedule: false,
          schedule_data: scheduleData,
          ...fields,
        })
        .eq("id", id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        activeScheduleId: next.id,
        useProjectDefault: false,
      });
    }

    scheduleData = { ...scheduleData, schedules: remaining };
    const { error } = await db
      .from("admin_email_campaigns")
      .update({ schedule_data: scheduleData })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, activeScheduleId, useProjectDefault });
  }

  if (body.updateScheduleName?.id && body.updateScheduleName.name?.trim()) {
    const scheduleId = body.updateScheduleName.id;
    const newName = body.updateScheduleName.name.trim();
    const idx = scheduleData.schedules.findIndex((s) => s.id === scheduleId);
    if (idx < 0) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }
    scheduleData.schedules[idx] = {
      ...scheduleData.schedules[idx],
      name: newName,
    };
    const { error } = await db
      .from("admin_email_campaigns")
      .update({ schedule_data: scheduleData })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, schedule: scheduleData.schedules[idx] });
  }

  if (typeof body.useProjectDefault === "boolean") {
    useProjectDefault = body.useProjectDefault;
    if (useProjectDefault) {
      activeScheduleId = "default";
      scheduleData = { ...scheduleData, activeScheduleId: "default" };
    }
  }

  if (body.activeScheduleId) {
    activeScheduleId = body.activeScheduleId;
    useProjectDefault = activeScheduleId === "default";
    scheduleData = { ...scheduleData, activeScheduleId };
  }

  if (!useProjectDefault && activeScheduleId !== "default") {
    const idx = scheduleData.schedules.findIndex((s) => s.id === activeScheduleId);
    if (idx >= 0) {
      const current = scheduleData.schedules[idx];
      const updated: CampaignScheduleItem = {
        ...current,
        ...(typeof body.dailyLimit === "number"
          ? { dailyLimit: body.dailyLimit }
          : {}),
        ...(typeof body.fromTime === "string" ? { fromTime: body.fromTime } : {}),
        ...(typeof body.toTime === "string" ? { toTime: body.toTime } : {}),
        ...(typeof body.timezone === "string" ? { timezone: body.timezone } : {}),
        ...(Array.isArray(body.days) ? { days: body.days } : {}),
      };
      scheduleData.schedules[idx] = updated;

      const fields = campaignFieldsFromSchedule(updated);
      const { error } = await db
        .from("admin_email_campaigns")
        .update({
          use_project_schedule: false,
          schedule_data: scheduleData,
          ...fields,
          scheduled_at: body.scheduledAt ?? null,
        })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, activeScheduleId, useProjectDefault });
    }
  }

  const patch: Record<string, unknown> = {
    use_project_schedule: useProjectDefault,
    schedule_data: scheduleData,
    scheduled_at: body.scheduledAt ?? null,
  };

  if (!useProjectDefault) {
    patch.daily_limit = body.dailyLimit ?? campaign.daily_limit ?? 300;
    patch.schedule_from_time = body.fromTime ?? campaign.schedule_from_time ?? "09:00";
    patch.schedule_to_time = body.toTime ?? campaign.schedule_to_time ?? "21:00";
    patch.schedule_timezone = body.timezone ?? campaign.schedule_timezone ?? "UTC";
    patch.schedule_days = body.days ?? campaign.schedule_days ?? [1, 2, 3, 4, 5, 6, 7];
  }

  const { error } = await db.from("admin_email_campaigns").update(patch).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, activeScheduleId, useProjectDefault });
}
