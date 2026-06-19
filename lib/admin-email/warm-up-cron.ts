/**
 * Email warm-up schedules — configured in vercel.json (Vercel Cron).
 * All jobs hit GET /api/cron/process-warm-up-sends?action=<action>
 */

export type WarmUpScheduleAction = "reset" | "sends" | "metrics" | "health";

export type WarmUpCronSpec = {
  id: string;
  path: string;
  schedule: string;
  action: WarmUpScheduleAction;
  label: string;
  description: string;
};

/** 9:00 Asia/Kolkata = 03:30 UTC (India has no DST). */
const WARM_UP_SENDS_UTC = "30 3 * * *";

export const WARM_UP_CRON_SPECS: WarmUpCronSpec[] = [
  {
    id: "warm-up-reset",
    path: "/api/cron/process-warm-up-sends?action=reset",
    schedule: "0 0 * * *",
    action: "reset",
    label: "warm-up-reset",
    description: "Reset daily warm-up send counters (midnight UTC)",
  },
  {
    id: "warm-up-sends",
    path: "/api/cron/process-warm-up-sends?action=sends",
    schedule: WARM_UP_SENDS_UTC,
    action: "sends",
    label: "warm-up-sends",
    description: "Automated warm-up sends (09:00 IST / 03:30 UTC)",
  },
  {
    id: "warm-up-metrics",
    path: "/api/cron/process-warm-up-sends?action=metrics",
    schedule: "59 23 * * *",
    action: "metrics",
    label: "warm-up-metrics",
    description: "Daily health score + stage progression (23:59 UTC close-out)",
  },
];

export function warmUpScheduleSpecs() {
  return WARM_UP_CRON_SPECS.map((spec) => ({
    id: spec.id,
    path: spec.path,
    schedule: spec.schedule,
    action: spec.action,
    label: spec.label,
    description: spec.description,
  }));
}

export function warmUpVercelCronEntries() {
  return WARM_UP_CRON_SPECS.map(({ path, schedule }) => ({ path, schedule }));
}
