"use client";

import { useEffect } from "react";
import {
  retainScheduledNotificationPoller,
  scheduleClientDelivery,
  syncClientDeliveryTimers,
} from "@/lib/admin-notifications/client-delivery-scheduler";

/** Keeps scheduled notifications delivering on time while admin Users page is open. */
export function useAdminScheduledNotificationDelivery(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return retainScheduledNotificationPoller();
  }, [active]);
}

export function useSyncScheduledCampaignTimers(
  campaigns: Array<{
    id: string;
    status: string;
    scheduledAt: string | null;
  }>,
  active: boolean,
) {
  useEffect(() => {
    if (!active || campaigns.length === 0) return;
    syncClientDeliveryTimers(campaigns);
  }, [active, campaigns]);
}

export { scheduleClientDelivery };
