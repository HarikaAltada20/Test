import { createAdminClient } from "@/utils/supabase/admin";
import { parseScheduleData } from "./schedule-store";
import type { EmailProjectSchedule } from "./types";
import { EMAIL_DELIVERY_BATCH_SIZE } from "./types";

const WEEKDAY_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const SENT_STATUSES = ["sent", "delivered", "opened", "clicked"] as const;

export type ResolvedSchedule = EmailProjectSchedule;

export type CampaignScheduleRow = {
  use_project_schedule: boolean;
  daily_limit: number | null;
  schedule_from_time: string | null;
  schedule_to_time: string | null;
  schedule_timezone: string | null;
  schedule_days: number[] | null;
  schedule_data?: unknown;
};

export type ProjectScheduleRow = {
  daily_limit: number;
  schedule_from_time: string;
  schedule_to_time: string;
  schedule_timezone: string;
  schedule_days: number[];
};

export function parseTimeToMinutes(time: string): number {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/** Normalize HH:mm or HH:mm:ss to HH:mm for storage and comparisons. */
export function normalizeScheduleTime(time: string): string {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return time.trim();
  return `${String(parseInt(match[1], 10)).padStart(2, "0")}:${match[2]}`;
}

export function getDateKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getIsoWeekday(date: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  return WEEKDAY_MAP[weekday] ?? 1;
}

export function getTimeMinutesInTimezone(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(
    parts.find((p) => p.type === "hour")?.value ?? "0",
    10,
  );
  const minute = parseInt(
    parts.find((p) => p.type === "minute")?.value ?? "0",
    10,
  );
  return hour * 60 + minute;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

/** UTC instant for a local calendar date + HH:mm in the given timezone. */
export function zonedTimeToUtc(
  dateKey: string,
  time: string,
  timezone: string,
): Date {
  const targetMinutes = parseTimeToMinutes(time);
  const hour = Math.floor(targetMinutes / 60);
  const minute = targetMinutes % 60;
  const naive = new Date(
    `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`,
  );

  for (let deltaHours = -26; deltaHours <= 26; deltaHours += 1) {
    const candidate = new Date(naive.getTime() + deltaHours * 3_600_000);
    if (
      getDateKeyInTimezone(candidate, timezone) === dateKey &&
      getTimeMinutesInTimezone(candidate, timezone) === targetMinutes
    ) {
      return candidate;
    }
  }

  return naive;
}

export function resolveEffectiveSchedule(
  campaign: CampaignScheduleRow,
  project: ProjectScheduleRow | null,
): ResolvedSchedule {
  if (campaign.use_project_schedule && project) {
    return {
      dailyLimit: project.daily_limit ?? 300,
      fromTime: project.schedule_from_time ?? "09:00",
      toTime: project.schedule_to_time ?? "21:00",
      timezone: project.schedule_timezone ?? "UTC",
      days: project.schedule_days ?? [1, 2, 3, 4, 5, 6, 7],
    };
  }

  const scheduleData = parseScheduleData(campaign.schedule_data);
  if (scheduleData.activeScheduleId !== "default") {
    const active = scheduleData.schedules.find(
      (item) => item.id === scheduleData.activeScheduleId,
    );
    if (active) {
      return {
        dailyLimit: active.dailyLimit,
        fromTime: active.fromTime,
        toTime: active.toTime,
        timezone: active.timezone,
        days: active.days,
      };
    }
  }

  return {
    dailyLimit: campaign.daily_limit ?? 300,
    fromTime: campaign.schedule_from_time ?? "09:00",
    toTime: campaign.schedule_to_time ?? "21:00",
    timezone: campaign.schedule_timezone ?? "UTC",
    days: campaign.schedule_days ?? [1, 2, 3, 4, 5, 6, 7],
  };
}

export function isWithinSendWindow(
  schedule: ResolvedSchedule,
  now = new Date(),
): boolean {
  const weekday = getIsoWeekday(now, schedule.timezone);
  if (!schedule.days.includes(weekday)) return false;

  const currentMinutes = getTimeMinutesInTimezone(now, schedule.timezone);
  const fromMinutes = parseTimeToMinutes(schedule.fromTime);
  const toMinutes = parseTimeToMinutes(schedule.toTime);

  return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
}

export function getNextSendWindowStart(
  schedule: ResolvedSchedule,
  now = new Date(),
  earliest?: Date,
): Date {
  const floor = earliest && earliest > now ? earliest : now;
  const startMinute = new Date(Math.ceil(floor.getTime() / 60_000) * 60_000);
  const dateKey = getDateKeyInTimezone(startMinute, schedule.timezone);

  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const dayKey = addDaysToDateKey(dateKey, dayOffset);
    const weekday = getIsoWeekday(
      zonedTimeToUtc(dayKey, "12:00", schedule.timezone),
      schedule.timezone,
    );
    if (!schedule.days.includes(weekday)) continue;

    const windowStart = zonedTimeToUtc(
      dayKey,
      schedule.fromTime,
      schedule.timezone,
    );
    const windowEnd = zonedTimeToUtc(dayKey, schedule.toTime, schedule.timezone);

    if (dayOffset === 0) {
      if (startMinute < windowStart) return windowStart;
      if (startMinute <= windowEnd) return startMinute;
      continue;
    }

    return windowStart;
  }

  return new Date(startMinute.getTime() + 3_600_000);
}

function countRowsOnDateKey(
  rows: Array<{ sent_at?: string | null; updated_at?: string | null }>,
  timezone: string,
  todayKey: string,
  timestampField: "sent_at" | "updated_at",
): number {
  return rows.filter((row) => {
    const value = row[timestampField];
    return (
      value && getDateKeyInTimezone(new Date(value), timezone) === todayKey
    );
  }).length;
}

async function loadCampaignSendRows(
  campaignIds: string[],
  lookback: string,
): Promise<{
  stepSendsByCampaign: Map<string, Array<{ sent_at: string | null }>>;
  recipientsByCampaign: Map<string, Array<{ updated_at: string | null }>>;
}> {
  const stepSendsByCampaign = new Map<
    string,
    Array<{ sent_at: string | null }>
  >();
  const recipientsByCampaign = new Map<
    string,
    Array<{ updated_at: string | null }>
  >();

  if (campaignIds.length === 0) {
    return { stepSendsByCampaign, recipientsByCampaign };
  }

  const db = createAdminClient();
  const { data: stepSends } = await db
    .from("admin_email_sequence_step_sends")
    .select("campaign_id, sent_at")
    .in("campaign_id", campaignIds)
    .gte("sent_at", lookback);

  for (const row of stepSends ?? []) {
    const bucket = stepSendsByCampaign.get(row.campaign_id) ?? [];
    bucket.push({ sent_at: row.sent_at });
    stepSendsByCampaign.set(row.campaign_id, bucket);
  }

  const campaignsWithoutStepSends = campaignIds.filter(
    (id) => !stepSendsByCampaign.has(id),
  );
  if (campaignsWithoutStepSends.length > 0) {
    const { data: recipients } = await db
      .from("admin_email_campaign_recipients")
      .select("campaign_id, updated_at")
      .in("campaign_id", campaignsWithoutStepSends)
      .in("email_delivery_status", [...SENT_STATUSES])
      .gte("updated_at", lookback);

    for (const row of recipients ?? []) {
      const bucket = recipientsByCampaign.get(row.campaign_id) ?? [];
      bucket.push({ updated_at: row.updated_at });
      recipientsByCampaign.set(row.campaign_id, bucket);
    }
  }

  return { stepSendsByCampaign, recipientsByCampaign };
}

function countCampaignSentTodayFromRows(
  campaignId: string,
  timezone: string,
  todayKey: string,
  stepSendsByCampaign: Map<string, Array<{ sent_at: string | null }>>,
  recipientsByCampaign: Map<string, Array<{ updated_at: string | null }>>,
): number {
  const stepSends = stepSendsByCampaign.get(campaignId) ?? [];
  if (stepSends.length > 0) {
    return countRowsOnDateKey(stepSends, timezone, todayKey, "sent_at");
  }

  const recipients = recipientsByCampaign.get(campaignId) ?? [];
  return countRowsOnDateKey(recipients, timezone, todayKey, "updated_at");
}

export async function countCampaignSentToday(
  campaignId: string,
  timezone: string,
  now = new Date(),
): Promise<number> {
  const todayKey = getDateKeyInTimezone(now, timezone);
  const lookback = new Date(now.getTime() - 48 * 3_600_000).toISOString();
  const { stepSendsByCampaign, recipientsByCampaign } =
    await loadCampaignSendRows([campaignId], lookback);

  return countCampaignSentTodayFromRows(
    campaignId,
    timezone,
    todayKey,
    stepSendsByCampaign,
    recipientsByCampaign,
  );
}

export type ProjectSentTodayInput = {
  projectId: string;
  timezone: string;
};

export async function countProjectSentToday(
  projectId: string,
  timezone: string,
  now = new Date(),
): Promise<number> {
  const counts = await countProjectsSentToday(
    [{ projectId, timezone }],
    now,
  );
  return counts.get(projectId) ?? 0;
}

export async function countProjectsSentToday(
  projects: ProjectSentTodayInput[],
  now = new Date(),
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (projects.length === 0) return counts;

  for (const project of projects) {
    counts.set(project.projectId, 0);
  }

  const db = createAdminClient();
  const projectIds = projects.map((project) => project.projectId);
  const timezoneByProject = new Map(
    projects.map((project) => [project.projectId, project.timezone]),
  );
  const todayKeyByProject = new Map(
    projects.map((project) => [
      project.projectId,
      getDateKeyInTimezone(now, project.timezone),
    ]),
  );

  const { data: campaigns } = await db
    .from("admin_email_campaigns")
    .select("id, project_id")
    .in("project_id", projectIds);

  if (!campaigns?.length) return counts;

  const campaignsByProject = new Map<string, string[]>();
  for (const campaign of campaigns) {
    const bucket = campaignsByProject.get(campaign.project_id) ?? [];
    bucket.push(campaign.id);
    campaignsByProject.set(campaign.project_id, bucket);
  }

  const lookback = new Date(now.getTime() - 48 * 3_600_000).toISOString();
  const { stepSendsByCampaign, recipientsByCampaign } =
    await loadCampaignSendRows(
      campaigns.map((campaign) => campaign.id),
      lookback,
    );

  for (const [projectId, campaignIds] of campaignsByProject) {
    const timezone = timezoneByProject.get(projectId) ?? "UTC";
    const todayKey = todayKeyByProject.get(projectId) ?? getDateKeyInTimezone(now, timezone);
    let total = 0;
    for (const campaignId of campaignIds) {
      total += countCampaignSentTodayFromRows(
        campaignId,
        timezone,
        todayKey,
        stepSendsByCampaign,
        recipientsByCampaign,
      );
    }
    counts.set(projectId, total);
  }

  return counts;
}

export type SendGateResult =
  | { allowed: true; batchLimit: number }
  | { allowed: false; reason: string; retryAt: Date };

const SCHEDULE_START_GRACE_MS = 60_000;

export async function evaluateCampaignSendGate(
  campaignId: string,
  schedule: ResolvedSchedule,
  options?: {
    scheduledAt?: string | null;
    now?: Date;
    projectId?: string;
  },
): Promise<SendGateResult> {
  const now = options?.now ?? new Date();

  if (options?.scheduledAt) {
    const due = new Date(options.scheduledAt);
    if (
      !Number.isNaN(due.getTime()) &&
      due.getTime() > now.getTime() + SCHEDULE_START_GRACE_MS
    ) {
      return { allowed: false, reason: "not_due", retryAt: due };
    }
  }

  if (!isWithinSendWindow(schedule, now)) {
    return {
      allowed: false,
      reason: "outside_window",
      retryAt: getNextSendWindowStart(schedule, now),
    };
  }

  const sentToday = options?.projectId
    ? await countProjectSentToday(options.projectId, schedule.timezone, now)
    : await countCampaignSentToday(campaignId, schedule.timezone, now);
  const remaining = schedule.dailyLimit - sentToday;
  if (remaining <= 0) {
    const tomorrowKey = addDaysToDateKey(
      getDateKeyInTimezone(now, schedule.timezone),
      1,
    );
    return {
      allowed: false,
      reason: "daily_limit",
      retryAt: zonedTimeToUtc(
        tomorrowKey,
        schedule.fromTime,
        schedule.timezone,
      ),
    };
  }

  return {
    allowed: true,
    batchLimit: Math.min(EMAIL_DELIVERY_BATCH_SIZE, remaining),
  };
}
