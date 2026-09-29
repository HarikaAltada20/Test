import { createAdminClient } from "@/utils/supabase/admin";
import type {
  AdminNotificationRecipientMode,
  RecipientUserRow,
  UserManagementFilterSnapshot,
} from "./types";
import { MAX_RECIPIENTS } from "./types";

export const RECIPIENT_USER_SELECT = `
  id,
  email,
  full_name,
  username,
  user_type,
  coins,
  referral_code,
  created_at,
  is_active,
  total_lifetime_coins_earned,
  affiliate_earnings,
  other_earnings,
  advertisers_referred,
  creators_referred,
  creator_profiles (
    total_money_won,
    withdrawable_balance,
    total_contests_won,
    total_contests_participated
  ),
  advertiser_profiles (
    total_money_spent,
    total_contests_run,
    available_deposit_balance,
    withdrawable_balance
  )
`;

type ProfileRow = Record<string, number | null | undefined>;

type RawRecipientUserRow = {
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
  creator_profiles?: ProfileRow | ProfileRow[] | null;
  advertiser_profiles?: ProfileRow | ProfileRow[] | null;
};

function firstProfile<T extends ProfileRow>(
  profiles: T | T[] | null | undefined,
): T | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles;
}

export function normalizeRecipientUserRow(
  raw: RawRecipientUserRow,
): RecipientUserRow {
  const creatorProfile = firstProfile(raw.creator_profiles);
  const advertiserProfile = firstProfile(raw.advertiser_profiles);
  const isCreator = raw.user_type === "creator";
  const isAdvertiser = raw.user_type === "advertiser";

  return {
    id: raw.id,
    email: raw.email,
    full_name: raw.full_name,
    username: raw.username,
    user_type: raw.user_type,
    coins: raw.coins,
    referral_code: raw.referral_code,
    created_at: raw.created_at,
    is_active: raw.is_active,
    total_lifetime_coins_earned: raw.total_lifetime_coins_earned ?? 0,
    affiliate_earnings: raw.affiliate_earnings ?? 0,
    other_earnings: raw.other_earnings ?? 0,
    advertisers_referred: raw.advertisers_referred ?? 0,
    creators_referred: raw.creators_referred ?? 0,
    total_money_won: isCreator ? (creatorProfile?.total_money_won ?? 0) : 0,
    withdrawable_balance: isCreator
      ? (creatorProfile?.withdrawable_balance ?? 0)
      : isAdvertiser
        ? (advertiserProfile?.withdrawable_balance ?? 0)
        : 0,
    total_contests_won: isCreator
      ? (creatorProfile?.total_contests_won ?? 0)
      : 0,
    total_contests_participated: isCreator
      ? (creatorProfile?.total_contests_participated ?? 0)
      : 0,
    total_money_spent: isAdvertiser
      ? (advertiserProfile?.total_money_spent ?? 0)
      : 0,
    total_contests_run: isAdvertiser
      ? (advertiserProfile?.total_contests_run ?? 0)
      : 0,
    available_deposit_balance: isAdvertiser
      ? (advertiserProfile?.available_deposit_balance ?? 0)
      : 0,
  };
}

export async function loadRecipientUsersByIds(
  userIds: string[],
): Promise<RecipientUserRow[]> {
  if (userIds.length === 0) return [];
  const db = createAdminClient();
  const users: RecipientUserRow[] = [];
  const CHUNK = 500;

  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    const { data, error } = await db
      .from("users")
      .select(RECIPIENT_USER_SELECT)
      .in("id", chunk);

    if (error) {
      const { data: fallbackData, error: fallbackError } = await db
        .from("users")
        .select(
          `id, email, full_name, username, user_type, coins, referral_code, created_at, is_active,
          total_lifetime_coins_earned, affiliate_earnings, other_earnings, advertisers_referred, creators_referred,
          advertiser_profiles (
            total_money_spent,
            total_contests_run,
            available_deposit_balance,
            withdrawable_balance
          )`,
        )
        .in("id", chunk);

      if (fallbackError) {
        throw new Error(fallbackError.message);
      }

      const creatorIds = (fallbackData ?? [])
        .filter((row) => row.user_type === "creator")
        .map((row) => row.id);
      const creatorProfilesById = new Map<string, ProfileRow>();

      if (creatorIds.length > 0) {
        const { data: creatorProfiles } = await db
          .from("creator_profiles")
          .select(
            "id, total_money_won, withdrawable_balance, total_contests_won, total_contests_participated",
          )
          .in("id", creatorIds);

        for (const profile of creatorProfiles ?? []) {
          creatorProfilesById.set(profile.id, profile);
        }
      }

      users.push(
        ...((fallbackData ?? []) as RawRecipientUserRow[]).map((row) =>
          normalizeRecipientUserRow({
            ...row,
            creator_profiles: creatorProfilesById.get(row.id) ?? null,
          }),
        ),
      );
      continue;
    }

    users.push(
      ...((data ?? []) as RawRecipientUserRow[]).map(normalizeRecipientUserRow),
    );
  }

  return users;
}

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
      .select(RECIPIENT_USER_SELECT)
      .in("id", chunk);

    if (error) {
      return { users: [], error: error.message };
    }
    users.push(
      ...((data ?? []) as RawRecipientUserRow[]).map(normalizeRecipientUserRow),
    );
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
