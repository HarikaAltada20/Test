export type AdminNotificationRecipientMode =
  | "selected_user_ids"
  | "select_all_filtered";

export type SendTiming = "immediate" | "scheduled";

export type UserManagementFilterSnapshot = {
  activeTab?: "all" | "advertisers" | "creators";
  isActive?: boolean;
  search?: string;
  filters?: Array<{ column: string; value: string; operator?: string }>;
};

export type RecipientUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  user_type: string;
  coins: number | null;
  referral_code: string | null;
  created_at: string;
  is_active: boolean;
};

export const MAX_RECIPIENTS = 10_000;
/** Recipients delivered per queue worker invocation (Vercel-safe). */
export const DELIVERY_BATCH_SIZE = 50;
export const PUBLIC_ANNOUNCEMENT_TITLE = "Announcement";
