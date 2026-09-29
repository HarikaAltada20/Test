import { randomUUID } from "crypto";

export type CampaignScheduleItem = {
  id: string;
  name: string;
  dailyLimit: number;
  fromTime: string;
  toTime: string;
  timezone: string;
  days: number[];
};

export type ScheduleData = {
  activeScheduleId: string;
  schedules: CampaignScheduleItem[];
};

const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6, 7];

export function defaultScheduleItem(
  name: string,
  overrides?: Partial<CampaignScheduleItem>,
): CampaignScheduleItem {
  return {
    id: randomUUID(),
    name,
    dailyLimit: 300,
    fromTime: "09:00",
    toTime: "21:00",
    timezone: "UTC",
    days: DEFAULT_DAYS,
    ...overrides,
  };
}

export function parseScheduleData(raw: unknown): ScheduleData {
  if (!raw || typeof raw !== "object") {
    return { activeScheduleId: "default", schedules: [] };
  }
  const data = raw as Partial<ScheduleData>;
  const schedules = Array.isArray(data.schedules)
    ? data.schedules.filter(
        (s): s is CampaignScheduleItem =>
          !!s &&
          typeof s === "object" &&
          typeof (s as CampaignScheduleItem).id === "string" &&
          typeof (s as CampaignScheduleItem).name === "string",
      )
    : [];
  return {
    activeScheduleId:
      typeof data.activeScheduleId === "string"
        ? data.activeScheduleId
        : "default",
    schedules,
  };
}

export function campaignFieldsFromSchedule(item: CampaignScheduleItem) {
  return {
    daily_limit: item.dailyLimit,
    schedule_from_time: item.fromTime,
    schedule_to_time: item.toTime,
    schedule_timezone: item.timezone,
    schedule_days: item.days,
  };
}
