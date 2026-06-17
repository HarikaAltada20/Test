/**
 * QStash recurring schedules for email warm-up jobs.
 * Replaces Vercel Cron so hourly health checks work on Hobby plan too.
 *
 * Run once after deploy: POST /api/admin/warm-up/admin/setup-schedules
 * Or schedules are auto-created when QStash is enabled and setup runs.
 */

import { isQStashEnabled, isLoopbackUrl, getQStashPublishBaseUrl } from "@/lib/qstash";
import { Client } from "@upstash/qstash";

export type WarmUpScheduleAction = "reset" | "sends" | "metrics" | "health";

const WARM_UP_SCHEDULES: {
  scheduleId: string;
  cron: string;
  action: WarmUpScheduleAction;
  label: string;
}[] = [
  {
    scheduleId: "go-viral-warm-up-reset",
    cron: "0 0 * * *",
    action: "reset",
    label: "warm-up-reset",
  },
  {
    scheduleId: "go-viral-warm-up-sends",
    cron: "CRON_TZ=Asia/Kolkata 0 9 * * *",
    action: "sends",
    label: "warm-up-sends",
  },
  {
    scheduleId: "go-viral-warm-up-metrics",
    cron: "59 23 * * *",
    action: "metrics",
    label: "warm-up-metrics",
  },
  {
    scheduleId: "go-viral-warm-up-health",
    cron: "0 * * * *",
    action: "health",
    label: "warm-up-health",
  },
];

function warmUpEndpointUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/cron/process-warm-up-sends`;
}

function getCronAuthHeaders(): Record<string, string> | undefined {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cronSecret}`,
  };
}

/**
 * Create or update all warm-up QStash schedules (idempotent via scheduleId).
 */
export async function setupWarmUpQStashSchedules(baseUrl?: string): Promise<{
  ok: boolean;
  schedules: { scheduleId: string; action: WarmUpScheduleAction }[];
  error?: string;
}> {
  if (!isQStashEnabled()) {
    return {
      ok: false,
      schedules: [],
      error: "QSTASH_TOKEN not configured",
    };
  }

  const origin = (baseUrl ?? getQStashPublishBaseUrl()).replace(/\/$/, "");
  if (isLoopbackUrl(origin)) {
    return {
      ok: false,
      schedules: [],
      error:
        "Public callback URL required; set QSTASH_CALLBACK_URL or NEXT_PUBLIC_APP_URL",
    };
  }

  const client = new Client({ token: process.env.QSTASH_TOKEN! });
  const destination = warmUpEndpointUrl(origin);
  const headers = getCronAuthHeaders();
  const created: { scheduleId: string; action: WarmUpScheduleAction }[] = [];

  for (const spec of WARM_UP_SCHEDULES) {
    await client.schedules.create({
      scheduleId: spec.scheduleId,
      destination,
      cron: spec.cron,
      body: JSON.stringify({ action: spec.action }),
      method: "POST",
      headers,
      retries: 3,
      label: spec.label,
    });
    created.push({ scheduleId: spec.scheduleId, action: spec.action });
  }

  return { ok: true, schedules: created };
}

export function warmUpScheduleSpecs() {
  return WARM_UP_SCHEDULES.map((s) => ({
    scheduleId: s.scheduleId,
    cron: s.cron,
    action: s.action,
    label: s.label,
  }));
}
