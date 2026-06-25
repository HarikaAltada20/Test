import { createAdminClient } from "@/utils/supabase/admin";

const USERS_SELECT = `
  *,
  advertiser_profiles (
    id,
    company_name,
    website_url,
    total_money_spent,
    total_contests_run,
    available_deposit_balance,
    withdrawable_balance,
    subscription_info
  )
`;

const CREATOR_PROFILES_SELECT = `
  id,
  youtube_account,
  instagram_account,
  tiktok_account,
  twitter_account,
  total_contests_participated,
  total_contests_won,
  total_views,
  total_money_won,
  withdrawable_balance,
  total_submissions_made,
  total_submissions_won,
  date_of_birth,
  gender,
  country,
  state,
  city,
  address,
  languages,
  categories,
  subcategories,
  interests,
  trust_score_metrics
`;

export type AdminUserCounts = {
  all: number;
  advertisers: number;
  creators: number;
};

async function fetchCreatorProfilesForUserIds(
  userIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  if (userIds.length === 0) return map;

  const db = createAdminClient();
  // Keep batches small — large `.in()` lists overflow HTTP headers (UUID × N).
  const CHUNK = 50;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const slice = userIds.slice(i, i + CHUNK);
    const { data, error } = await db
      .from("creator_profiles")
      .select(CREATOR_PROFILES_SELECT)
      .in("id", slice);

    if (error) {
      console.error("Error fetching creator profiles:", error);
      continue;
    }

    for (const profile of data ?? []) {
      map.set(profile.id, profile);
    }
  }

  return map;
}

function mergeUsersWithCreatorProfiles(
  users: Record<string, unknown>[],
  creatorProfilesMap: Map<string, Record<string, unknown>>,
) {
  return users.map((user) => ({
    ...user,
    creator_profiles: creatorProfilesMap.get(String(user.id)) ?? null,
  }));
}

export async function getAdminUserCounts(): Promise<AdminUserCounts> {
  const db = createAdminClient();
  const [allRes, advertisersRes, creatorsRes] = await Promise.all([
    db.from("users").select("id", { count: "exact", head: true }),
    db
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("user_type", "advertiser"),
    db
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("user_type", "creator"),
  ]);

  return {
    all: allRes.count ?? 0,
    advertisers: advertisersRes.count ?? 0,
    creators: creatorsRes.count ?? 0,
  };
}

export async function listAdminUsersPaginated(options: {
  offset: number;
  limit: number;
  includeCounts?: boolean;
}) {
  const db = createAdminClient();
  const offset = Math.max(0, options.offset);
  const limit = Math.min(Math.max(1, options.limit), 1000);
  const end = offset + limit - 1;

  const { data: users, error, count } = await db
    .from("users")
    .select(USERS_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, end);

  if (error) {
    throw new Error(error.message);
  }

  const userRows = users ?? [];
  const userIds = userRows.map((user) => String(user.id));
  const creatorProfilesMap = await fetchCreatorProfilesForUserIds(userIds);

  const items = mergeUsersWithCreatorProfiles(
    userRows as Record<string, unknown>[],
    creatorProfilesMap,
  );

  const result: {
    items: typeof items;
    total: number;
    offset: number;
    limit: number;
    counts?: AdminUserCounts;
  } = {
    items,
    total: count ?? items.length,
    offset,
    limit,
  };

  if (options.includeCounts) {
    result.counts = await getAdminUserCounts();
  }

  return result;
}

/** Legacy full load for callers that still need every user in one response. */
export async function listAllAdminUsers() {
  const db = createAdminClient();
  const CHUNK = 1000;
  let users: Record<string, unknown>[] = [];
  let usersFrom = 0;

  while (true) {
    const { data: chunk, error } = await db
      .from("users")
      .select(USERS_SELECT)
      .order("created_at", { ascending: false })
      .range(usersFrom, usersFrom + CHUNK - 1);

    if (error) {
      throw new Error(error.message);
    }

    users = users.concat((chunk ?? []) as Record<string, unknown>[]);
    if (!chunk || chunk.length < CHUNK) break;
    usersFrom += CHUNK;
  }

  let creatorProfiles: Record<string, unknown>[] = [];
  let profilesFrom = 0;
  while (true) {
    const { data: profileChunk, error: creatorProfilesError } = await db
      .from("creator_profiles")
      .select(CREATOR_PROFILES_SELECT)
      .range(profilesFrom, profilesFrom + CHUNK - 1);

    if (creatorProfilesError) {
      console.error("Error fetching creator profiles:", creatorProfilesError);
      break;
    }

    creatorProfiles = creatorProfiles.concat(profileChunk ?? []);
    if (!profileChunk || profileChunk.length < CHUNK) break;
    profilesFrom += CHUNK;
  }

  const creatorProfilesMap = new Map(
    creatorProfiles.map((profile) => [String(profile.id), profile]),
  );

  return mergeUsersWithCreatorProfiles(users, creatorProfilesMap);
}
