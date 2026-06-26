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
  await deleteLeadBundles([bundleId]);
}

export async function deleteLeadBundles(bundleIds: string[]): Promise<number> {
  const db = createAdminClient();
  const uniqueIds = Array.from(new Set(bundleIds.filter(Boolean)));
  if (uniqueIds.length === 0) return 0;

  const { error } = await db
    .from("admin_email_lead_bundles")
    .delete()
    .in("id", uniqueIds);

  if (error) throw new Error(error.message);
  return uniqueIds.length;
}

export type ParsedImportLead = {
  email: string;
  fullName: string | null;
  username: string | null;
  userType: string | null;
};

/** Canonical headers for lead bundle CSV/Excel imports. */
export const LEAD_IMPORT_CSV_HEADERS = [
  "email",
  "full name",
  "username",
  "user type",
] as const;

export function buildLeadImportCsvTemplate(): string {
  const header = LEAD_IMPORT_CSV_HEADERS.join(",");
  const rows = [
    "john.doe@example.com,John Doe,john_doe,creator",
    "jane.smith@example.com,Jane Smith,jane_smith,advertiser",
    "alex.admin@example.com,Alex Admin,alex_admin,admin",
  ];
  return [header, ...rows].join("\n");
}

const EMAIL_HEADER_ALIASES = ["email", "e-mail", "email address", "mail"];
const FIRST_NAME_HEADER_ALIASES = [
  "first name",
  "firstname",
  "first_name",
  "first",
  "given name",
  "givenname",
];
const LAST_NAME_HEADER_ALIASES = [
  "last name",
  "lastname",
  "last_name",
  "last",
  "surname",
  "family name",
  "familyname",
];
const FULL_NAME_HEADER_ALIASES = [
  "full name",
  "fullname",
  "full_name",
  "name",
  "contact",
  "contact name",
];
const USERNAME_HEADER_ALIASES = ["username", "user name", "user_name"];
const USER_TYPE_HEADER_ALIASES = ["user type", "usertype", "user_type", "type"];

function normalizeImportHeader(value: string): string {
  return value.toLowerCase().trim();
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) =>
    aliases.includes(normalizeImportHeader(header)),
  );
}

function findHeaderKey(keys: string[], aliases: string[]): string | undefined {
  return keys.find((key) => aliases.includes(normalizeImportHeader(key)));
}

function cleanImportCell(value: unknown): string {
  return String(value ?? "").trim();
}

function buildImportContactName(input: {
  firstName?: string;
  lastName?: string;
  fullName?: string;
}): string | null {
  const fullName = input.fullName?.trim();
  if (fullName) return fullName;

  const combined = [input.firstName?.trim(), input.lastName?.trim()]
    .filter(Boolean)
    .join(" ");
  return combined || null;
}

function dedupeImportLeads(leads: ParsedImportLead[]): ParsedImportLead[] {
  const byEmail = new Map<string, ParsedImportLead>();
  for (const lead of leads) {
    const email = lead.email.trim().toLowerCase();
    if (!email.includes("@")) continue;
    byEmail.set(email, { ...lead, email });
  }
  return Array.from(byEmail.values());
}

export function parseCsvLeads(csvText: string): ParsedImportLead[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headerCells = splitCsvLine(lines[0]).map((c) => c.trim());
  const normalizedHeaders = headerCells.map(normalizeImportHeader);
  const emailColIndex = findHeaderIndex(normalizedHeaders, EMAIL_HEADER_ALIASES);
  const firstNameColIndex = findHeaderIndex(
    normalizedHeaders,
    FIRST_NAME_HEADER_ALIASES,
  );
  const lastNameColIndex = findHeaderIndex(
    normalizedHeaders,
    LAST_NAME_HEADER_ALIASES,
  );
  const fullNameColIndex = findHeaderIndex(
    normalizedHeaders,
    FULL_NAME_HEADER_ALIASES,
  );
  const usernameColIndex = findHeaderIndex(
    normalizedHeaders,
    USERNAME_HEADER_ALIASES,
  );
  const userTypeColIndex = findHeaderIndex(
    normalizedHeaders,
    USER_TYPE_HEADER_ALIASES,
  );

  const hasHeader = emailColIndex >= 0;
  const startRow = hasHeader ? 1 : 0;
  const emailIndex = hasHeader ? emailColIndex : 0;

  const leads: ParsedImportLead[] = [];
  for (let i = startRow; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const email = cleanImportCell(cells[emailIndex] ?? cells[0]).toLowerCase();
    if (!email.includes("@")) continue;

    const firstName =
      firstNameColIndex >= 0 ? cleanImportCell(cells[firstNameColIndex]) : "";
    const lastName =
      lastNameColIndex >= 0 ? cleanImportCell(cells[lastNameColIndex]) : "";
    const fullName =
      fullNameColIndex >= 0 ? cleanImportCell(cells[fullNameColIndex]) : "";

    leads.push({
      email,
      fullName: buildImportContactName({ firstName, lastName, fullName }),
      username:
        usernameColIndex >= 0
          ? cleanImportCell(cells[usernameColIndex]) || null
          : null,
      userType:
        userTypeColIndex >= 0
          ? cleanImportCell(cells[userTypeColIndex]) || null
          : null,
    });
  }

  return dedupeImportLeads(leads);
}

export function parseCsvEmails(csvText: string): string[] {
  return parseCsvLeads(csvText).map((lead) => lead.email);
}

export async function parseLeadsFromUpload(
  fileName: string,
  content: ArrayBuffer,
): Promise<ParsedImportLead[]> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(content, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    if (rows.length === 0) return [];

    const keys = Object.keys(rows[0]);
    const emailKey = findHeaderKey(keys, EMAIL_HEADER_ALIASES);
    const firstNameKey = findHeaderKey(keys, FIRST_NAME_HEADER_ALIASES);
    const lastNameKey = findHeaderKey(keys, LAST_NAME_HEADER_ALIASES);
    const fullNameKey = findHeaderKey(keys, FULL_NAME_HEADER_ALIASES);
    const usernameKey = findHeaderKey(keys, USERNAME_HEADER_ALIASES);
    const userTypeKey = findHeaderKey(keys, USER_TYPE_HEADER_ALIASES);

    const leads: ParsedImportLead[] = [];
    for (const row of rows) {
      const rawEmail = emailKey ? row[emailKey] : Object.values(row)[0];
      const email = cleanImportCell(rawEmail).toLowerCase();
      if (!email.includes("@")) continue;

      leads.push({
        email,
        fullName: buildImportContactName({
          firstName: firstNameKey ? cleanImportCell(row[firstNameKey]) : "",
          lastName: lastNameKey ? cleanImportCell(row[lastNameKey]) : "",
          fullName: fullNameKey ? cleanImportCell(row[fullNameKey]) : "",
        }),
        username: usernameKey ? cleanImportCell(row[usernameKey]) || null : null,
        userType: userTypeKey ? cleanImportCell(row[userTypeKey]) || null : null,
      });
    }

    return dedupeImportLeads(leads);
  }

  const text = new TextDecoder().decode(content);
  return parseCsvLeads(text);
}

export async function parseEmailsFromUpload(
  fileName: string,
  content: ArrayBuffer,
): Promise<string[]> {
  const leads = await parseLeadsFromUpload(fileName, content);
  return leads.map((lead) => lead.email);
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

export async function importLeadsToBundle(
  bundleId: string,
  leads: ParsedImportLead[],
): Promise<{ matched: number; failed: number; total: number }> {
  const db = createAdminClient();
  const uniqueLeads = dedupeImportLeads(leads);

  if (uniqueLeads.length === 0) {
    return { matched: 0, failed: 0, total: 0 };
  }

  const leadByEmail = new Map(
    uniqueLeads.map((lead) => [lead.email.toLowerCase(), lead]),
  );
  const uniqueEmails = uniqueLeads.map((lead) => lead.email);

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
  const unmatchedLeads = uniqueLeads.filter(
    (lead) => !matchedEmailSet.has(lead.email.toLowerCase()),
  );

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
      .map((u) => {
        const lead = leadByEmail.get(u.email.toLowerCase());
        return {
          bundle_id: bundleId,
          user_id: u.id,
          email: u.email.toLowerCase(),
          full_name: lead?.fullName ?? null,
          username: lead?.username ?? null,
          user_type: lead?.userType ?? null,
        };
      });

    const MEMBER_CHUNK = 500;
    for (let i = 0; i < newMembers.length; i += MEMBER_CHUNK) {
      const { error } = await db
        .from("admin_email_lead_bundle_members")
        .insert(newMembers.slice(i, i + MEMBER_CHUNK));
      if (error) throw new Error(error.message);
    }
  }

  const externalLeads = unmatchedLeads.filter(
    (lead) => !existingEmails.has(lead.email.toLowerCase()),
  );
  if (externalLeads.length > 0) {
    const externalRows = externalLeads.map((lead) => ({
      bundle_id: bundleId,
      user_id: null,
      email: lead.email,
      full_name: lead.fullName,
      username: lead.username,
      user_type: lead.userType,
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
  const addedExternalCount = externalLeads.length;
  const addedCount = addedUserCount + addedExternalCount;
  const failedCount = Math.max(0, uniqueLeads.length - addedCount);

  const { error: updateError } = await db
    .from("admin_email_lead_bundles")
    .update({
      failed_count: failedCount,
      processed_count: total,
      total_leads: total,
      status: "completed",
    })
    .eq("id", bundleId);

  if (updateError) throw new Error(updateError.message);

  return {
    matched: addedCount,
    failed: failedCount,
    total,
  };
}

export async function importEmailsToBundle(
  bundleId: string,
  emails: string[],
): Promise<{ matched: number; failed: number; total: number }> {
  return importLeadsToBundle(
    bundleId,
    emails.map((email) => ({
      email,
      fullName: null,
      username: null,
      userType: null,
    })),
  );
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
    await syncBundleMemberCounts(bundleId);
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

  if (rows.length === 0) {
    await syncBundleMemberCounts(bundleId);
    return 0;
  }

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
      fullName: row.full_name ?? user?.full_name ?? null,
      username: row.username ?? user?.username ?? null,
      userType: row.user_type ?? user?.user_type ?? null,
    };

    const key = member.userId ?? member.email;
    byKey.set(key, member);
  }

  return Array.from(byKey.values());
}

export function manualLeadToAttachMember(input: {
  email: string;
  fullName?: string | null;
  username?: string | null;
  userType?: string | null;
  userId?: string | null;
}): BundleMemberForAttach {
  return {
    userId: input.userId ?? null,
    email: input.email.trim().toLowerCase(),
    fullName: input.fullName?.trim() || null,
    username: input.username?.trim() || null,
    userType: input.userType?.trim() || null,
  };
}

export async function resolveManualLeadForAttach(input: {
  email: string;
  fullName?: string | null;
  username?: string | null;
  userType?: string | null;
}): Promise<BundleMemberForAttach> {
  const user = await findUserForManualLead(input);
  if (user) {
    return manualLeadToAttachMember({
      ...input,
      userId: user.id,
      email: user.email,
    });
  }

  const db = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const { data: userByEmail } = await db
    .from("users")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  if (userByEmail) {
    return manualLeadToAttachMember({
      ...input,
      userId: userByEmail.id,
      email: userByEmail.email,
    });
  }

  return manualLeadToAttachMember(input);
}

async function rollbackAttachedRecipients(
  campaignId: string,
  recipientIds: string[],
): Promise<void> {
  if (recipientIds.length === 0) return;
  const db = createAdminClient();
  const CHUNK = 500;
  for (let i = 0; i < recipientIds.length; i += CHUNK) {
    await db
      .from("admin_email_campaign_recipients")
      .delete()
      .eq("campaign_id", campaignId)
      .in("id", recipientIds.slice(i, i + CHUNK));
  }
}

export async function attachLeadsToCampaign(
  campaignId: string,
  members: BundleMemberForAttach[],
): Promise<{
  attachedCount: number;
  skippedCount: number;
  recipientCount: number;
  status: string;
}> {
  const db = createAdminClient();
  const { data: campaign, error: campaignError } = await db
    .from("admin_email_campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    throw new Error("Campaign not found");
  }

  const attachableStatuses = [
    "draft",
    "configured",
    "scheduled",
    "active",
    "paused",
    "completed",
    "partial",
  ];
  if (!attachableStatuses.includes(campaign.status)) {
    throw new Error(`Cannot attach leads to campaign in status: ${campaign.status}`);
  }

  if (members.length === 0) {
    const { count } = await db
      .from("admin_email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);
    return {
      attachedCount: 0,
      skippedCount: 0,
      recipientCount: count ?? 0,
      status: campaign.status,
    };
  }

  const { data: existingRecipients } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id, recipient_email")
    .eq("campaign_id", campaignId);

  const existingUserIds = new Set(
    (existingRecipients ?? [])
      .map((row) => row.user_id)
      .filter((id): id is string => Boolean(id)),
  );
  const existingEmails = new Set(
    (existingRecipients ?? [])
      .map((row) => row.recipient_email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  );

  if (existingUserIds.size > 0) {
    const { data: existingUsers } = await db
      .from("users")
      .select("email")
      .in("id", Array.from(existingUserIds));

    for (const user of existingUsers ?? []) {
      const email = user.email?.trim().toLowerCase();
      if (email) existingEmails.add(email);
    }
  }

  const platformUserIds = Array.from(
    new Set(members.map((m) => m.userId).filter((id): id is string => Boolean(id))),
  );

  const { data: users } =
    platformUserIds.length > 0
      ? await db.from("users").select("id, user_type").in("id", platformUserIds)
      : { data: [] as Array<{ id: string; user_type: string }> };

  const usersById = new Map((users ?? []).map((user) => [user.id, user]));

  const now = new Date().toISOString();
  const recipientRows: Array<Record<string, unknown>> = [];

  for (const member of members) {
    if (member.userId) {
      if (existingUserIds.has(member.userId)) continue;
      const user = usersById.get(member.userId);
      if (!user) continue;

      recipientRows.push({
        campaign_id: campaignId,
        user_id: member.userId,
        user_type_at_send: user.user_type,
        email_delivery_status: "pending",
        created_at: now,
        updated_at: now,
      });
      continue;
    }

    if (existingEmails.has(member.email)) continue;

    recipientRows.push({
      campaign_id: campaignId,
      user_id: null,
      recipient_email: member.email,
      full_name: member.fullName,
      username: member.username,
      user_type_at_send: member.userType?.trim() || null,
      email_delivery_status: "pending",
      created_at: now,
      updated_at: now,
    });
  }

  const insertedRecipientIds: string[] = [];
  const CHUNK = 500;
  for (let i = 0; i < recipientRows.length; i += CHUNK) {
    const chunk = recipientRows.slice(i, i + CHUNK);
    const { data: inserted, error: recipError } = await db
      .from("admin_email_campaign_recipients")
      .insert(chunk)
      .select("id");

    if (recipError) {
      await rollbackAttachedRecipients(campaignId, insertedRecipientIds);
      throw new Error(recipError.message);
    }

    insertedRecipientIds.push(
      ...(inserted ?? []).map((row) => row.id).filter(Boolean),
    );
  }

  const { count: totalRecipientCount } = await db
    .from("admin_email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const campaignUpdates: {
    recipient_count: number;
    status?: string;
    completed_at?: string | null;
  } = {
    recipient_count: totalRecipientCount ?? 0,
  };

  if (campaign.status === "draft") {
    campaignUpdates.status = "configured";
  } else if (campaign.status === "completed" || campaign.status === "partial") {
    campaignUpdates.status = "configured";
    campaignUpdates.completed_at = null;
  }

  if (recipientRows.length > 0) {
    const { error: campaignUpdateError } = await db
      .from("admin_email_campaigns")
      .update(campaignUpdates)
      .eq("id", campaignId);

    if (campaignUpdateError) {
      await rollbackAttachedRecipients(campaignId, insertedRecipientIds);
      throw new Error(campaignUpdateError.message);
    }
  }

  return {
    attachedCount: recipientRows.length,
    skippedCount: members.length - recipientRows.length,
    recipientCount: totalRecipientCount ?? 0,
    status: campaignUpdates.status ?? campaign.status,
  };
}

export type CampaignAttachedBundle = {
  id: string;
  name: string;
  totalLeads: number;
};

export async function recordCampaignBundleAttachments(
  campaignId: string,
  bundleIds: string[],
): Promise<void> {
  if (bundleIds.length === 0) return;

  const db = createAdminClient();
  const now = new Date().toISOString();
  const rows = bundleIds.map((bundleId) => ({
    campaign_id: campaignId,
    bundle_id: bundleId,
    created_at: now,
  }));

  const { error } = await db
    .from("admin_email_campaign_bundles")
    .upsert(rows, { onConflict: "campaign_id,bundle_id" });

  if (error) throw new Error(error.message);
}

export async function listCampaignAttachedBundles(
  campaignId: string,
): Promise<CampaignAttachedBundle[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_campaign_bundles")
    .select(
      `
      bundle_id,
      admin_email_lead_bundles (
        id,
        name,
        total_leads
      )
    `,
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const bundle = Array.isArray(row.admin_email_lead_bundles)
        ? row.admin_email_lead_bundles[0]
        : row.admin_email_lead_bundles;
      if (!bundle) return null;
      return {
        id: bundle.id as string,
        name: bundle.name as string,
        totalLeads: (bundle.total_leads as number) ?? 0,
      };
    })
    .filter((bundle): bundle is CampaignAttachedBundle => Boolean(bundle));
}

export async function detachBundleFromCampaign(
  campaignId: string,
  bundleId: string,
): Promise<{ deletedCount: number; recipientCount: number }> {
  const db = createAdminClient();
  const { data: campaign } = await db
    .from("admin_email_campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .single();

  if (!campaign) throw new Error("Campaign not found");

  if (campaign.status === "completed" || campaign.status === "partial") {
    throw new Error("Cannot remove bundles from a completed campaign");
  }

  const members = await getBundleMembersForAttach([bundleId]);
  const memberUserIds = new Set(
    members.map((member) => member.userId).filter((id): id is string => Boolean(id)),
  );
  const memberEmails = new Set(members.map((member) => member.email));

  const { data: recipients, error: recipientsError } = await db
    .from("admin_email_campaign_recipients")
    .select("id, user_id, recipient_email, email_delivery_status")
    .eq("campaign_id", campaignId);

  if (recipientsError) throw new Error(recipientsError.message);

  let recipientsToDelete = (recipients ?? []).filter((recipient) => {
    if (recipient.user_id && memberUserIds.has(recipient.user_id)) return true;
    const email = recipient.recipient_email?.trim().toLowerCase();
    return Boolean(email && memberEmails.has(email));
  });

  if (campaign.status === "active") {
    recipientsToDelete = recipientsToDelete.filter(
      (recipient) => recipient.email_delivery_status === "pending",
    );
  }

  if (recipientsToDelete.length === 0) {
    await db
      .from("admin_email_campaign_bundles")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("bundle_id", bundleId);

    const { count } = await db
      .from("admin_email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    return { deletedCount: 0, recipientCount: count ?? 0 };
  }

  const recipientIds = recipientsToDelete.map((recipient) => recipient.id);
  const userIdsForTracking = recipientsToDelete
    .map((recipient) => recipient.user_id)
    .filter((id): id is string => Boolean(id));

  if (userIdsForTracking.length > 0) {
    await db
      .from("admin_email_tracking")
      .delete()
      .eq("campaign_id", campaignId)
      .in("user_id", userIdsForTracking);
  }

  const CHUNK = 100;
  let deletedTotal = 0;
  for (let i = 0; i < recipientIds.length; i += CHUNK) {
    const chunk = recipientIds.slice(i, i + CHUNK);
    const { error: deleteError, count } = await db
      .from("admin_email_campaign_recipients")
      .delete({ count: "exact" })
      .eq("campaign_id", campaignId)
      .in("id", chunk);

    if (deleteError) throw new Error(deleteError.message);
    deletedTotal += count ?? chunk.length;
  }

  await db
    .from("admin_email_campaign_bundles")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("bundle_id", bundleId);

  const { count: remainingCount } = await db
    .from("admin_email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const recipientCount = remainingCount ?? 0;
  const updates: { recipient_count: number; status?: string } = {
    recipient_count: recipientCount,
  };
  if (recipientCount === 0 && campaign.status === "configured") {
    updates.status = "draft";
  }

  await db.from("admin_email_campaigns").update(updates).eq("id", campaignId);

  return { deletedCount: deletedTotal, recipientCount };
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

  let members: LeadBundleMember[] = (data ?? []).map((row) =>
    mapBundleMemberRow(row),
  );

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

export async function listBundleMemberIds(bundleId: string): Promise<string[]> {
  const db = createAdminClient();
  const POSTGREST_MAX = 1000;
  const ids: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await db
      .from("admin_email_lead_bundle_members")
      .select("id")
      .eq("bundle_id", bundleId)
      .range(offset, offset + POSTGREST_MAX - 1);

    if (error) throw new Error(error.message);

    const chunk = (data ?? []).map((row) => String(row.id));
    ids.push(...chunk);
    if (chunk.length < POSTGREST_MAX) break;
    offset += POSTGREST_MAX;
  }

  return ids;
}

function mapBundleMemberRow(row: {
  id: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  username: string | null;
  user_type: string | null;
  users?:
    | {
        id: string;
        email: string;
        full_name: string | null;
        username: string | null;
        user_type: string;
      }
    | {
        id: string;
        email: string;
        full_name: string | null;
        username: string | null;
        user_type: string;
      }[]
    | null;
}): LeadBundleMember {
  const user = Array.isArray(row.users) ? row.users[0] : row.users;
  return {
    id: row.id,
    userId: user?.id ?? row.user_id ?? null,
    email: user?.email ?? row.email ?? "",
    fullName: row.full_name ?? user?.full_name ?? null,
    username: row.username ?? user?.username ?? null,
    userType: row.user_type ?? user?.user_type ?? "",
  };
}

export async function getBundleMember(
  bundleId: string,
  memberId: string,
): Promise<LeadBundleMember | null> {
  const db = createAdminClient();
  const { data, error } = await db
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
    )
    .eq("bundle_id", bundleId)
    .eq("id", memberId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapBundleMemberRow(data);
}

export async function updateBundleMember(
  bundleId: string,
  memberId: string,
  input: {
    email?: string;
    fullName?: string | null;
    username?: string | null;
    userType?: string | null;
  },
): Promise<LeadBundleMember> {
  const db = createAdminClient();

  const { data: existing, error: fetchError } = await db
    .from("admin_email_lead_bundle_members")
    .select("id, bundle_id, user_id, email")
    .eq("id", memberId)
    .eq("bundle_id", bundleId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new Error("Lead not found");

  const updates: Record<string, string | null> = {};

  if (input.fullName !== undefined) {
    updates.full_name = input.fullName?.trim() || null;
  }
  if (input.username !== undefined) {
    updates.username = input.username?.trim() || null;
  }
  if (input.userType !== undefined) {
    updates.user_type = input.userType?.trim() || null;
  }

  if (input.email !== undefined) {
    if (existing.user_id) {
      throw new Error("Email cannot be changed for platform users");
    }
    const email = input.email.trim().toLowerCase();
    if (!email.includes("@")) {
      throw new Error("Invalid email address");
    }
    updates.email = email;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No fields to update");
  }

  const { error: updateError } = await db
    .from("admin_email_lead_bundle_members")
    .update(updates)
    .eq("id", memberId)
    .eq("bundle_id", bundleId);

  if (updateError) {
    if (updateError.code === "23505") {
      throw new Error("A lead with this email already exists in the bundle");
    }
    throw new Error(updateError.message);
  }

  const updated = await getBundleMember(bundleId, memberId);
  if (!updated) throw new Error("Lead not found after update");
  return updated;
}

export async function deleteBundleMember(
  bundleId: string,
  memberId: string,
): Promise<{ deleted: boolean; totalLeads: number }> {
  const db = createAdminClient();

  const { data: existing, error: fetchError } = await db
    .from("admin_email_lead_bundle_members")
    .select("id")
    .eq("id", memberId)
    .eq("bundle_id", bundleId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!existing) throw new Error("Lead not found");

  const { error: deleteError } = await db
    .from("admin_email_lead_bundle_members")
    .delete()
    .eq("id", memberId)
    .eq("bundle_id", bundleId);

  if (deleteError) throw new Error(deleteError.message);

  const totalLeads = await syncBundleMemberCounts(bundleId);
  return { deleted: true, totalLeads };
}

export async function deleteBundleMembers(
  bundleId: string,
  memberIds: string[],
): Promise<{ deletedCount: number; totalLeads: number }> {
  const db = createAdminClient();
  const uniqueIds = Array.from(new Set(memberIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    const totalLeads = await syncBundleMemberCounts(bundleId);
    return { deletedCount: 0, totalLeads };
  }

  const { error } = await db
    .from("admin_email_lead_bundle_members")
    .delete()
    .eq("bundle_id", bundleId)
    .in("id", uniqueIds);

  if (error) throw new Error(error.message);

  const totalLeads = await syncBundleMemberCounts(bundleId);
  return { deletedCount: uniqueIds.length, totalLeads };
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
