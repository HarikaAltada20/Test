"use client";

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let pollerStarted = false;
let pollerInterval: ReturnType<typeof setInterval> | null = null;
let pollerRefCount = 0;
let onDeliveryChange: (() => void) | null = null;

export function setScheduledDeliveryListener(listener: (() => void) | null) {
  onDeliveryChange = listener;
}

function deliverCampaign(campaignId: string) {
  void fetch(`/api/admin/notifications/campaigns/${campaignId}/deliver`, {
    method: "POST",
  })
    .then(() => onDeliveryChange?.())
    .catch((err) => {
      console.warn("[scheduled-notification] deliver failed:", err);
    });
}

function processAllDue() {
  void fetch("/api/admin/notifications/process-due", { method: "POST" })
    .then(() => onDeliveryChange?.())
    .catch((err) => {
      console.warn("[scheduled-notification] process-due failed:", err);
    });
}

/** Fire delivery at scheduled_at (while this browser tab is open). */
export function scheduleClientDelivery(
  campaignId: string,
  scheduledAtIso: string,
) {
  const existing = timers.get(campaignId);
  if (existing) clearTimeout(existing);

  const ms = new Date(scheduledAtIso).getTime() - Date.now();
  if (Number.isNaN(ms)) return;

  if (ms <= 0) {
    deliverCampaign(campaignId);
    return;
  }

  const maxMs = 7 * 24 * 60 * 60 * 1000;
  if (ms > maxMs) return;

  const timer = setTimeout(() => {
    timers.delete(campaignId);
    deliverCampaign(campaignId);
  }, ms);
  timers.set(campaignId, timer);
}

export function clearClientDelivery(campaignId: string) {
  const t = timers.get(campaignId);
  if (t) clearTimeout(t);
  timers.delete(campaignId);
}

/** Poll for due campaigns every 15s while admin dashboard is mounted. */
export function retainScheduledNotificationPoller(): () => void {
  if (typeof window === "undefined") return () => {};

  pollerRefCount += 1;
  if (!pollerStarted) {
    pollerStarted = true;
    processAllDue();
    pollerInterval = setInterval(processAllDue, 15_000);
  }

  return () => {
    pollerRefCount = Math.max(0, pollerRefCount - 1);
    if (pollerRefCount === 0 && pollerInterval) {
      clearInterval(pollerInterval);
      pollerInterval = null;
      pollerStarted = false;
    }
  };
}

export function syncClientDeliveryTimers(
  campaigns: Array<{ id: string; status: string; scheduledAt: string | null }>,
) {
  const scheduled = campaigns.filter(
    (c) => c.status === "scheduled" && c.scheduledAt,
  );
  const activeIds = new Set(scheduled.map((c) => c.id));

  for (const id of timers.keys()) {
    if (!activeIds.has(id)) clearClientDelivery(id);
  }

  for (const c of scheduled) {
    scheduleClientDelivery(c.id, c.scheduledAt!);
  }
}
