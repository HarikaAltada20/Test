import { createAdminClient } from "@/utils/supabase/admin";

export type LeadBundleStatus = "active" | "completed" | "archived";

export type LeadBundleListItem = {
  id: string;
  projectId: string | null;
  projectName: string | null;
  name: string;
  description: string | null;
  status: LeadBundleStatus;
  sourceCampaignId: string | null;
  totalLeads: number;
  processedCount: number;
  failedCount: number;
  createdAt: string;
};

export type LeadBundleMember = {
  id: string;
  userId: string | null;
  email: string;
  fullName: string | null;
  username: string | null;
  userType: string;
};

function mapBundleRow(row: {
  id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  status: string;
  source_campaign_id: string | null;
  total_leads: number;
  processed_count: number;
  failed_count: number;
  created_at: string;
  admin_email_projects?: { name: string } | { name: string }[] | null;
}): LeadBundleListItem {
  const project = Array.isArray(row.admin_email_projects)
    ? row.admin_email_projects[0]
    : row.admin_email_projects;

  return {
    id: row.id,
    projectId: row.project_id,
    projectName: project?.name ?? null,
    name: row.name,
    description: row.description,
    status: row.status as LeadBundleStatus,
    sourceCampaignId: row.source_campaign_id,
    totalLeads: row.total_leads ?? 0,
    processedCount: row.processed_count ?? 0,
    failedCount: row.failed_count ?? 0,
    createdAt: row.created_at,
  };
}

export async function listLeadBundles(params: {
  search?: string;
  projectId?: string;
  page?: number;
  limit?: number;
}): Promise<{ bundles: LeadBundleListItem[]; total: number; totalPages: number }> {
  const db = createAdminClient();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = db
    .from("admin_email_lead_bundles")
    .select(
      `
      id,
      project_id,
      name,
      description,
      status,
      source_campaign_id,
      total_leads,
      processed_count,
      failed_count,
      created_at,
      admin_email_projects ( name )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (params.projectId && params.projectId !== "all") {
    query = query.eq("project_id", params.projectId);
  }

  const search = params.search?.trim();
  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    bundles: (data ?? []).map(mapBundleRow),
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getLeadBundle(bundleId: string): Promise<LeadBundleListItem | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_lead_bundles")
    .select(
      `
      id,
      project_id,
      name,
      description,
      status,
      source_campaign_id,
      total_leads,
      processed_count,
      failed_count,
      created_at,
      admin_email_projects ( name )
    `,
    )
    .eq("id", bundleId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapBundleRow(data);
}

export async function createLeadBundle(input: {
  name: string;
  description?: string | null;
  projectId?: string | null;
  sourceCampaignId?: string | null;
}): Promise<LeadBundleListItem> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_lead_bundles")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      project_id: input.projectId ?? null,
      source_campaign_id: input.sourceCampaignId ?? null,
      status: "active",
    })
    .select(
      `
      id,
      project_id,
      name,
      description,
      status,
      source_campaign_id,
      total_leads,
      processed_count,
      failed_count,
      created_at,
      admin_email_projects ( name )
    `,
    )
    .single();

  if (error) throw new Error(error.message);
  return mapBundleRow(data);
}

export async function deleteLeadBundle(bundleId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("admin_email_lead_bundles")
    .delete()
    .eq("id", bundleId);
  if (error) throw new Error(error.message);
}

export function parseCsvEmails(csvText: string): string[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headerCells = splitCsvLine(lines[0]).map((c) => c.toLowerCase().trim());
  const emailColIndex = headerCells.findIndex((c) =>
    ["email", "e-mail", "email address", "mail"].includes(c),
  );

  const emails = new Set<string>();
  const startRow = emailColIndex >= 0 ? 1 : 0;
  const colIndex = emailColIndex >= 0 ? emailColIndex : 0;

  for (let i = startRow; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const raw = cells[colIndex] ?? cells[0];
    const email = raw?.trim().toLowerCase();
    if (email && email.includes("@")) emails.add(email);
  }

  return Array.from(emails);
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function syncBundleMemberCounts(bundleId: string): Promise<number> {
  const db = createAdminClient();
  const { count } = await db
    .from("admin_email_lead_bundle_members")
    .select("id", { count: "exact", head: true })
    .eq("bundle_id", bundleId);

  const total = count ?? 0;
  await db
    .from("admin_email_lead_bundles")
    .update({ total_leads: total, processed_count: total })
    .eq("id", bundleId);

  return total;
}

export async function importEmailsToBundle(
  bundleId: string,
  emails: string[],
): Promise<{ matched: number; failed: number; total: number }> {
  const db = createAdminClient();
  const uniqueEmails = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"))),
  );

  if (uniqueEmails.length === 0) {
    return { matched: 0, failed: 0, total: 0 };
  }

  const matchedUsers: Array<{ id: string; email: string }> = [];
  const CHUNK = 200;
  for (let i = 0; i < uniqueEmails.length; i += CHUNK) {
    const chunk = uniqueEmails.slice(i, i + CHUNK);
    const { data } = await db
      .from("users")
      .select("id, email")
      .in("email", chunk);
    for (const row of data ?? []) {
      matchedUsers.push({ id: row.id, email: row.email });
    }
  }

  const matchedEmailSet = new Set(matchedUsers.map((u) => u.email.toLowerCase()));
  const unmatchedEmails = uniqueEmails.filter((e) => !matchedEmailSet.has(e));

  const { data: existingMembers } = await db
    .from("admin_email_lead_bundle_members")
    .select("user_id, email")
    .eq("bundle_id", bundleId);

  const existingUserIds = new Set(
    (existingMembers ?? [])
      .map((r) => r.user_id)
      .filter((id): id is string => Boolean(id)),
  );
  const existingEmails = new Set(
    (existingMembers ?? [])
      .map((r) => r.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  );

  if (matchedUsers.length > 0) {
    const newMembers = matchedUsers
      .filter((u) => !existingUserIds.has(u.id))
      .map((u) => ({
        bundle_id: bundleId,
        user_id: u.id,
      }));

    const MEMBER_CHUNK = 500;
    for (let i = 0; i < newMembers.length; i += MEMBER_CHUNK) {
      const { error } = await db
        .from("admin_email_lead_bundle_members")
        .insert(newMembers.slice(i, i + MEMBER_CHUNK));
      if (error) throw new Error(error.message);
    }
  }

  const externalEmails = unmatchedEmails.filter((email) => !existingEmails.has(email));
  if (externalEmails.length > 0) {
    const externalRows = externalEmails.map((email) => ({
      bundle_id: bundleId,
      user_id: null,
      email,
    }));

    const MEMBER_CHUNK = 500;
    for (let i = 0; i < externalRows.length; i += MEMBER_CHUNK) {
      const { error } = await db
        .from("admin_email_lead_bundle_members")
        .insert(externalRows.slice(i, i + MEMBER_CHUNK));
      if (error) throw new Error(error.message);
    }
  }

  const total = await syncBundleMemberCounts(bundleId);
  const addedUserCount = matchedUsers.filter((u) => !existingUserIds.has(u.id)).length;
  const addedExternalCount = externalEmails.length;
  const addedCount = addedUserCount + addedExternalCount;

  const { error: updateError } = await db
    .from("admin_email_lead_bundles")
    .update({
      failed_count: Math.max(0, uniqueEmails.length - addedCount),
      status: total > 0 ? "active" : "active",
    })
    .eq("id", bundleId);

  if (updateError) throw new Error(updateError.message);

  return {
    matched: addedCount,
    failed: Math.max(0, uniqueEmails.length - addedCount),
    total,
  };
}

export async function findUserForManualLead(input: {
  email: string;
  fullName?: string | null;
  username?: string | null;
  userType?: string | null;
}): Promise<{ id: string; email: string } | null> {
  const db = createAdminClient();
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return null;

  let query = db.from("users").select("id, email").ilike("email", email);

  if (input.username?.trim()) {
    query = query.eq("username", input.username.trim());
  }
  if (input.userType?.trim()) {
    query = query.eq("user_type", input.userType.trim());
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function addManualLeadToBundle(
  bundleId: string,
  input: {
    email: string;
    fullName?: string | null;
    username?: string | null;
    userType?: string | null;
  },
): Promise<number> {
  const db = createAdminClient();
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new Error("Invalid email address");
  }

  const user = await findUserForManualLead(input);
  if (user) {
    return addUsersToBundle(bundleId, [user.id]);
  }

  const { data: existingByEmail } = await db
    .from("admin_email_lead_bundle_members")
    .select("id, user_id")
    .eq("bundle_id", bundleId)
    .ilike("email", email);

  if ((existingByEmail ?? []).length > 0) {
    return 0;
  }

  const { data: userByEmail } = await db
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (userByEmail) {
    return addUsersToBundle(bundleId, [userByEmail.id]);
  }

  const { error } = await db.from("admin_email_lead_bundle_members").insert({
    bundle_id: bundleId,
    user_id: null,
    email,
    full_name: input.fullName?.trim() || null,
    username: input.username?.trim() || null,
    user_type: input.userType?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") return 0;
    throw new Error(error.message);
  }

  await syncBundleMemberCounts(bundleId);
  return 1;
}

export async function addUsersToBundle(
  bundleId: string,
  userIds: string[],
): Promise<number> {
  const db = createAdminClient();
  const uniqueIds = Array.from(new Set(userIds));
  if (uniqueIds.length === 0) return 0;

  const { data: existing } = await db
    .from("admin_email_lead_bundle_members")
    .select("user_id")
    .eq("bundle_id", bundleId);

  const existingIds = new Set(
    (existing ?? [])
      .map((r) => r.user_id)
      .filter((id): id is string => Boolean(id)),
  );
  const rows = uniqueIds
    .filter((id) => !existingIds.has(id))
    .map((userId) => ({ bundle_id: bundleId, user_id: userId }));

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db
      .from("admin_email_lead_bundle_members")
      .insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
  }

  await syncBundleMemberCounts(bundleId);

  return rows.length;
}

export type BundleMemberForAttach = {
  userId: string | null;
  email: string;
  fullName: string | null;
  username: string | null;
  userType: string | null;
};

export async function getBundleMembersForAttach(
  bundleIds: string[],
): Promise<BundleMemberForAttach[]> {
  if (bundleIds.length === 0) return [];

  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_lead_bundle_members")
    .select(
      `
      user_id,
      email,
      full_name,
      username,
      user_type,
      users (
        id,
        email,
        full_name,
        username,
        user_type
      )
    `,
    )
    .in("bundle_id", bundleIds);

  if (error) throw new Error(error.message);

  const byKey = new Map<string, BundleMemberForAttach>();
  for (const row of data ?? []) {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const email = (user?.email ?? row.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;

    const member: BundleMemberForAttach = {
      userId: user?.id ?? row.user_id ?? null,
      email,
      fullName: user?.full_name ?? row.full_name ?? null,
      username: user?.username ?? row.username ?? null,
      userType: user?.user_type ?? row.user_type ?? null,
    };

    const key = member.userId ?? member.email;
    byKey.set(key, member);
  }

  return Array.from(byKey.values());
}

export async function getBundleMemberUserIds(bundleIds: string[]): Promise<string[]> {
  if (bundleIds.length === 0) return [];
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_lead_bundle_members")
    .select("user_id")
    .in("bundle_id", bundleIds)
    .not("user_id", "is", null);

  if (error) throw new Error(error.message);
  return Array.from(
    new Set((data ?? []).map((r) => r.user_id).filter((id): id is string => Boolean(id))),
  );
}

export async function listBundleMembers(
  bundleId: string,
  params?: { page?: number; limit?: number; search?: string },
): Promise<{ members: LeadBundleMember[]; total: number; totalPages: number }> {
  const db = createAdminClient();
  const page = Math.max(1, params?.page ?? 1);
  const limit = Math.min(200, Math.max(1, params?.limit ?? 50));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = db
    .from("admin_email_lead_bundle_members")
    .select(
      `
      id,
      user_id,
      email,
      full_name,
      username,
      user_type,
      users (
        id,
        email,
        full_name,
        username,
        user_type
      )
    `,
      { count: "exact" },
    )
    .eq("bundle_id", bundleId);

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  let members: LeadBundleMember[] = (data ?? []).map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      id: row.id,
      userId: user?.id ?? row.user_id ?? null,
      email: user?.email ?? row.email ?? "",
      fullName: user?.full_name ?? row.full_name ?? null,
      username: user?.username ?? row.username ?? null,
      userType: user?.user_type ?? row.user_type ?? "",
    };
  });

  const searchLower = params?.search?.trim().toLowerCase();
  if (searchLower) {
    members = members.filter(
      (m) =>
        m.email.toLowerCase().includes(searchLower) ||
        (m.fullName?.toLowerCase().includes(searchLower) ?? false) ||
        (m.username?.toLowerCase().includes(searchLower) ?? false),
    );
  }

  const total = searchLower ? members.length : (count ?? 0);
  return {
    members,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getLeadBundleStats(): Promise<{
  groupCount: number;
  totalLeadsInGroups: number;
}> {
  const db = createAdminClient();
  const [{ count: groupCount }, { count: memberCount }] = await Promise.all([
    db
      .from("admin_email_lead_bundles")
      .select("id", { count: "exact", head: true }),
    db
      .from("admin_email_lead_bundle_members")
      .select("id", { count: "exact", head: true }),
  ]);

  return {
    groupCount: groupCount ?? 0,
    totalLeadsInGroups: memberCount ?? 0,
  };
}
