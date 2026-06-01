import { createAdminClient } from "@/utils/supabase/admin";
import type {
  AdminNotificationRecipientMode,
  RecipientUserRow,
  UserManagementFilterSnapshot,
} from "./types";
import { MAX_RECIPIENTS } from "./types";

const USER_SELECT =
  "id, email, full_name, username, user_type, coins, referral_code, created_at, is_active";

export async function resolveRecipientUsers(input: {
  recipientMode: AdminNotificationRecipientMode;
  userIds?: string[];
  filters?: UserManagementFilterSnapshot;
}): Promise<{ users: RecipientUserRow[]; error?: string }> {
  const uniqueIds = [...new Set((input.userIds ?? []).filter(Boolean))];

  if (uniqueIds.length === 0) {
    return { users: [], error: "At least one recipient is required" };
  }

  if (uniqueIds.length > MAX_RECIPIENTS) {
    return {
      users: [],
      error: "Too many recipients; narrow filters.",
    };
  }

  const db = createAdminClient();
  const users: RecipientUserRow[] = [];
  const CHUNK = 500;

  for (let i = 0; i < uniqueIds.length; i += CHUNK) {
    const chunk = uniqueIds.slice(i, i + CHUNK);
    const { data, error } = await db
      .from("users")
      .select(USER_SELECT)
      .in("id", chunk);

    if (error) {
      return { users: [], error: error.message };
    }
    users.push(...((data ?? []) as RecipientUserRow[]));
  }

  const foundIds = new Set(users.map((u) => u.id));
  const missing = uniqueIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return {
      users: [],
      error: `${missing.length} recipient(s) not found`,
    };
  }

  const isActiveDefault = input.filters?.isActive !== false;
  let filtered = users;
  if (isActiveDefault) {
    filtered = filtered.filter((u) => u.is_active);
  }

  const tab = input.filters?.activeTab;
  if (tab === "creators") {
    filtered = filtered.filter((u) => u.user_type === "creator");
  } else if (tab === "advertisers") {
    filtered = filtered.filter((u) => u.user_type === "advertiser");
  }

  if (filtered.length === 0) {
    return { users: [], error: "No active recipients match the selection" };
  }

  if (filtered.length > MAX_RECIPIENTS) {
    return {
      users: [],
      error: "Too many recipients; narrow filters.",
    };
  }

  return { users: filtered };
}

export function countRecipientsByType(users: RecipientUserRow[]) {
  return users.reduce(
    (acc, u) => {
      if (u.user_type === "creator") acc.creator += 1;
      else if (u.user_type === "advertiser") acc.advertiser += 1;
      else if (u.user_type === "admin") acc.admin += 1;
      return acc;
    },
    { creator: 0, advertiser: 0, admin: 0 },
  );
}
