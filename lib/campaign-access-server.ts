import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getUserSafe } from "@/utils/supabase/auth-server";
import { createAdminClient } from "@/utils/supabase/admin";
import { fetchAllRows } from "@/lib/supabase-paging";
import {
  MAX_USERNAMES_PER_REQUEST,
  parseUsernames,
  type AccessMode,
  type UsernameResolution,
} from "@/lib/campaign-access";

export type AccessActor = {
  userId: string;
  isAdmin: boolean;
  isAdvertiser: boolean;
};

export class CampaignAccessError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function campaignAccessErrorResponse(err: unknown): NextResponse {
  if (err instanceof CampaignAccessError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[campaign-access]", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Signed-in brand or admin making the request. */
export async function getAccessActor(): Promise<AccessActor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getUserSafe(supabase);
  if (!user) throw new CampaignAccessError("Authentication required", 401);

  const { data: row } = await supabase
    .from("users")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = row?.user_type === "admin";
  const isAdvertiser = row?.user_type === "advertiser";
  if (!isAdmin && !isAdvertiser) {
    throw new CampaignAccessError("Brand or admin access required", 403);
  }
  return { userId: user.id, isAdmin, isAdvertiser };
}

/**
 * Brand whose allowlists are being managed. Brands always act on themselves;
 * admins must name the brand (advertiserId) they act for.
 */
export function resolveAllowlistOwner(
  actor: AccessActor,
  requestedAdvertiserId: string | null | undefined,
): string {
  if (actor.isAdmin) {
    if (!requestedAdvertiserId) {
      throw new CampaignAccessError("advertiserId is required for admins", 400);
    }
    return requestedAdvertiserId;
  }
  return actor.userId;
}

export type AllowlistRow = {
  id: string;
  advertiser_id: string;
  name: string;
  member_count: number;
  created_at: string;
  updated_at: string;
};

export const ALLOWLIST_COLUMNS =
  "id, advertiser_id, name, member_count, created_at, updated_at";

function translateAllowlistWriteError(error: { code?: string }): never {
  if (error.code === "23505") {
    throw new CampaignAccessError("A list with this name already exists", 409);
  }
  if (error.code === "23503") {
    throw new CampaignAccessError("Brand not found", 404);
  }
  throw error;
}

/** Creates a saved list and adds members in one call; returns the refreshed row. */
export async function createAllowlistWithMembers(
  admin: SupabaseClient,
  opts: { ownerId: string; name: string; createdBy: string; userIds: string[] },
): Promise<AllowlistRow> {
  const { data: list, error } = await admin
    .from("brand_allowlists")
    .insert({ advertiser_id: opts.ownerId, name: opts.name, created_by: opts.createdBy })
    .select(ALLOWLIST_COLUMNS)
    .single();
  if (error) translateAllowlistWriteError(error);

  await addAllowlistMembers(admin, list!.id, opts.userIds, opts.createdBy);
  if (opts.userIds.length === 0) return list as AllowlistRow;

  const { data: refreshed } = await admin
    .from("brand_allowlists")
    .select(ALLOWLIST_COLUMNS)
    .eq("id", list!.id)
    .single();
  return (refreshed ?? list) as AllowlistRow;
}

export async function renameAllowlist(
  admin: SupabaseClient,
  allowlistId: string,
  name: string,
): Promise<AllowlistRow> {
  const { data, error } = await admin
    .from("brand_allowlists")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", allowlistId)
    .select(ALLOWLIST_COLUMNS)
    .single();
  if (error) translateAllowlistWriteError(error);
  return data as AllowlistRow;
}

export { fetchAllRows };
export const WRITE_BATCH_SIZE = 500;

/** All user ids on a saved list (no 1,000-row truncation). */
export async function loadAllowlistMemberIds(
  admin: SupabaseClient,
  allowlistId: string,
): Promise<string[]> {
  const rows = await fetchAllRows<{ user_id: string }>(() =>
    admin
      .from("brand_allowlist_members")
      .select("user_id")
      .eq("allowlist_id", allowlistId)
      .order("user_id"),
  );
  return rows.map((r) => r.user_id);
}

/** All user ids on a campaign's access list (no 1,000-row truncation). */
export async function loadCampaignAccessUserIds(
  admin: SupabaseClient,
  contestId: string,
): Promise<string[]> {
  const rows = await fetchAllRows<{ user_id: string }>(() =>
    admin
      .from("contest_access_list")
      .select("user_id")
      .eq("contest_id", contestId)
      .order("user_id"),
  );
  return rows.map((r) => r.user_id);
}

/** Inserts members in batches, skipping ones already on the list. Returns how many were new. */
export async function addAllowlistMembers(
  admin: SupabaseClient,
  allowlistId: string,
  userIds: string[],
  addedBy: string,
): Promise<number> {
  const unique = Array.from(new Set(userIds));
  let added = 0;
  for (let i = 0; i < unique.length; i += WRITE_BATCH_SIZE) {
    const rows = unique.slice(i, i + WRITE_BATCH_SIZE).map((user_id) => ({
      allowlist_id: allowlistId,
      user_id,
      added_by: addedBy,
    }));
    const { data, error } = await admin
      .from("brand_allowlist_members")
      .upsert(rows, { onConflict: "allowlist_id,user_id", ignoreDuplicates: true })
      .select("user_id");
    if (error) throw error;
    added += data?.length ?? 0;
  }
  return added;
}

/**
 * Whether the current visitor may see a campaign's data (leaderboards, feeds).
 * Public campaigns are open to everyone; private ones require a signed-in user
 * who passes can_access_contest (access list, owning brand, or admin).
 * Unknown ids return true so the caller keeps its own not-found handling.
 */
export async function canViewCampaign(contestId: string): Promise<boolean> {
  const { data: contest } = await createAdminClient()
    .from("contests")
    .select("access_mode")
    .eq("id", contestId)
    .maybeSingle();
  if (!contest || contest.access_mode === "public") return true;

  const supabase = await createClient();
  const { data: allowed, error } = await supabase.rpc("can_access_contest", {
    p_contest_id: contestId,
  });
  return !error && allowed === true;
}

export const PRIVATE_CAMPAIGN_FORBIDDEN_MESSAGE =
  "This campaign is private or unavailable.";

export async function assertCanManageAllowlist(
  admin: SupabaseClient,
  actor: AccessActor,
  allowlistId: string,
): Promise<AllowlistRow> {
  const { data, error } = await admin
    .from("brand_allowlists")
    .select("id, advertiser_id, name, member_count, created_at, updated_at")
    .eq("id", allowlistId)
    .maybeSingle();
  if (error) throw error;
  if (!data || (!actor.isAdmin && data.advertiser_id !== actor.userId)) {
    throw new CampaignAccessError("Allowlist not found", 404);
  }
  return data as AllowlistRow;
}

export type ManagedContest = {
  id: string;
  advertiser_id: string | null;
  access_mode: AccessMode;
  access_list_skips_requirements: boolean;
};

/** Campaign's owning brand, or an admin. */
export async function assertCanManageCampaignAccess(
  admin: SupabaseClient,
  actor: AccessActor,
  contestId: string,
): Promise<ManagedContest> {
  const { data, error } = await admin
    .from("contests")
    .select("id, advertiser_id, access_mode, access_list_skips_requirements")
    .eq("id", contestId)
    .maybeSingle();
  if (error) throw error;
  if (!data || (!actor.isAdmin && data.advertiser_id !== actor.userId)) {
    throw new CampaignAccessError("Campaign not found", 404);
  }
  return data as ManagedContest;
}

/**
 * Case-insensitive lookup of creator usernames. Only creator accounts resolve;
 * brands/admins and unknown names come back in notFound.
 */
export async function resolveUsernamesToUserIds(
  admin: SupabaseClient,
  input: string | readonly string[],
): Promise<UsernameResolution & { invalid: string[] }> {
  const { valid, invalid } = parseUsernames(input);
  if (valid.length > MAX_USERNAMES_PER_REQUEST) {
    throw new CampaignAccessError(
      `At most ${MAX_USERNAMES_PER_REQUEST} usernames per request`,
      400,
    );
  }

  const byLower = new Map<string, { user_id: string; username: string }>();
  const CHUNK = 100;
  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    // ilike treats "_" as a single-char wildcard; exact matches are re-checked below.
    const filter = chunk.map((u) => `username.ilike.${u}`).join(",");
    const { data, error } = await admin
      .from("users")
      .select("id, username, user_type")
      .or(filter)
      .eq("user_type", "creator");
    if (error) throw error;
    for (const row of data || []) {
      if (row.username) {
        byLower.set(String(row.username).toLowerCase(), {
          user_id: row.id,
          username: row.username,
        });
      }
    }
  }

  const found: { user_id: string; username: string }[] = [];
  const notFound: string[] = [];
  for (const name of valid) {
    const hit = byLower.get(name.toLowerCase());
    if (hit) found.push(hit);
    else notFound.push(name);
  }
  return { found, notFound, invalid };
}

export function getServiceClient(): SupabaseClient {
  return createAdminClient();
}

type MemberUserRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  profile_picture_url: string | null;
};

/** Loads display fields for a set of user ids. */
export async function loadUserDisplay(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, MemberUserRow>> {
  const out = new Map<string, MemberUserRow>();
  const CHUNK = 200;
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const { data, error } = await admin
      .from("users")
      .select("id, username, full_name, profile_picture_url")
      .in("id", chunk);
    if (error) throw error;
    for (const row of data || []) out.set(row.id, row as MemberUserRow);
  }
  return out;
}
