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
  total_lifetime_coins_earned?: number | null;
  affiliate_earnings?: number | null;
  other_earnings?: number | null;
  advertisers_referred?: number | null;
  creators_referred?: number | null;
  total_money_won?: number | null;
  withdrawable_balance?: number | null;
  total_contests_won?: number | null;
  total_contests_participated?: number | null;
  total_money_spent?: number | null;
  total_contests_run?: number | null;
  available_deposit_balance?: number | null;
};

export const MAX_RECIPIENTS = 10_000;
/** Recipients delivered per queue worker invocation (Vercel-safe). */
export const DELIVERY_BATCH_SIZE = 50;
export const PUBLIC_ANNOUNCEMENT_TITLE = "Announcement";
