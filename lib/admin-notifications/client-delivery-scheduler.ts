"use client";

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let pollerStarted = false;
let pollerInterval: ReturnType<typeof setInterval> | null = null;
let pollerRefCount = 0;
let hasScheduledCampaignsFlag = false;
let processDueInFlight = false;
let onDeliveryChange: (() => void) | null = null;
let deliveryChangeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const PROCESS_DUE_INTERVAL_MS = 60_000;
const DELIVERY_CHANGE_DEBOUNCE_MS = 500;

export function setScheduledDeliveryListener(listener: (() => void) | null) {
  onDeliveryChange = listener;
}

function notifyDeliveryChange() {
  if (!onDeliveryChange) return;
  if (deliveryChangeDebounceTimer) {
    clearTimeout(deliveryChangeDebounceTimer);
  }
  deliveryChangeDebounceTimer = setTimeout(() => {
    deliveryChangeDebounceTimer = null;
    onDeliveryChange?.();
  }, DELIVERY_CHANGE_DEBOUNCE_MS);
}

function deliverCampaign(campaignId: string) {
  void fetch(`/api/admin/notifications/campaigns/${campaignId}/deliver`, {
    method: "POST",
  })
    .then(() => notifyDeliveryChange())
    .catch((err) => {
      console.warn("[scheduled-notification] deliver failed:", err);
    });
}

function processAllDue() {
  if (processDueInFlight) return;
  processDueInFlight = true;
  void fetch("/api/admin/notifications/process-due", { method: "POST" })
    .then(() => notifyDeliveryChange())
    .catch((err) => {
      console.warn("[scheduled-notification] process-due failed:", err);
    })
    .finally(() => {
      processDueInFlight = false;
    });
}

function stopPollerInterval() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
}

function syncPollerInterval() {
  if (pollerRefCount === 0 || !pollerStarted) {
    stopPollerInterval();
    return;
  }
  if (!hasScheduledCampaignsFlag) {
    stopPollerInterval();
    return;
  }
  if (pollerInterval) return;
  pollerInterval = setInterval(processAllDue, PROCESS_DUE_INTERVAL_MS);
}

/** Update whether any scheduled campaigns need client-side due processing. */
export function setHasScheduledCampaigns(hasScheduled: boolean) {
  const wasScheduled = hasScheduledCampaignsFlag;
  hasScheduledCampaignsFlag = hasScheduled;
  syncPollerInterval();
  if (
    hasScheduled &&
    !wasScheduled &&
    pollerStarted &&
    pollerRefCount > 0
  ) {
    processAllDue();
  }
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

/** Poll for due campaigns while admin dashboard is mounted and campaigns are scheduled. */
export function retainScheduledNotificationPoller(): () => void {
  if (typeof window === "undefined") return () => {};

  pollerRefCount += 1;
  if (!pollerStarted) {
    pollerStarted = true;
    if (hasScheduledCampaignsFlag) {
      processAllDue();
    }
    syncPollerInterval();
  }

  return () => {
    pollerRefCount = Math.max(0, pollerRefCount - 1);
    if (pollerRefCount === 0) {
      stopPollerInterval();
      pollerStarted = false;
      if (deliveryChangeDebounceTimer) {
        clearTimeout(deliveryChangeDebounceTimer);
        deliveryChangeDebounceTimer = null;
      }
    } else {
      syncPollerInterval();
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

  setHasScheduledCampaigns(scheduled.length > 0);

  for (const id of timers.keys()) {
    if (!activeIds.has(id)) clearClientDelivery(id);
  }

  for (const c of scheduled) {
    scheduleClientDelivery(c.id, c.scheduledAt!);
  }
}
