/** ISO timestamps for admin_notification_campaign_recipients writes. */

export function campaignRecipientNow(): string {
  return new Date().toISOString();
}

export function campaignRecipientInsertTimestamps(
  now: string = campaignRecipientNow(),
) {
  return {
    created_at: now,
    updated_at: now,
  };
}

export function campaignRecipientDeliveryStatusPatch(
  deliveryStatus: "delivered" | "failed",
  now: string = campaignRecipientNow(),
) {
  return {
    delivery_status: deliveryStatus,
    updated_at: now,
  };
}
