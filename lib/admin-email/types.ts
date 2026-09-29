export type AdminEmailCampaignStatus =
  | "draft"
  | "configured"
  | "scheduled"
  | "active"
  | "paused"
  | "completed"
  | "partial";

export type EmailDeliveryStatus =
  | "pending"
  | "in_sequence"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "skipped"
  | "failed";

export type AdminEmailRecipientMode =
  | "selected_user_ids"
  | "select_all_filtered";

export type EmailProjectSchedule = {
  dailyLimit: number;
  fromTime: string;
  toTime: string;
  timezone: string;
  days: number[];
};

export const MAX_EMAIL_RECIPIENTS = 10_000;
export const EMAIL_DELIVERY_BATCH_SIZE = 25;
