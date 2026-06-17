import { createAdminClient } from "@/utils/supabase/admin";

export type WarmUpStatus = "pending" | "active" | "paused" | "completed" | "failed";
export type WarmUpStage = "foundation" | "growth" | "expansion" | "ready";

export type WarmUpAccountRow = {
  id: string;
  project_id: string;
  sender_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  warm_up_status: WarmUpStatus;
  current_stage: WarmUpStage;
  daily_limit: number;
  emails_sent_today: number;
  total_emails_sent: number;
  campaign_daily_limit: number;
  campaign_sent_today: number;
  current_health_score: number;
  best_health_score: number;
  is_ready_for_sending: boolean;
  start_date: string | null;
  target_completion_date: string | null;
  last_send_date: string | null;
  created_at: string;
  updated_at: string;
};

export type WarmUpAccountListItem = WarmUpAccountRow & {
  display_name: string;
  status_label: string;
};

export type WarmUpOverview = {
  totalAccounts: number;
  healthy: number;
  warmingUp: number;
  paused: number;
  emailsSentToday: number;
  avgHealthScore: number;
};

const STAGE_DAILY_LIMITS: Record<WarmUpStage, number> = {
  foundation: 10,
  growth: 25,
  expansion: 45,
  ready: 100,
};

function statusLabel(status: WarmUpStatus, healthScore: number): string {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "completed" && healthScore >= 80) return "Healthy";
  if (status === "pending") return "Paused";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function displayName(row: WarmUpAccountRow): string {
  const parts = [row.first_name, row.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  const local = row.email.split("@")[0] ?? row.email;
  return local.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isHealthyAccount(row: WarmUpAccountRow): boolean {
  return (
    row.current_health_score >= 80 ||
    (row.warm_up_status === "completed" && row.is_ready_for_sending)
  );
}

export function mapWarmUpAccount(row: WarmUpAccountRow): WarmUpAccountListItem {
  return {
    ...row,
    display_name: displayName(row),
    status_label: statusLabel(row.warm_up_status, row.current_health_score),
  };
}

export function computeWarmUpOverview(
  accounts: WarmUpAccountRow[],
): WarmUpOverview {
  const healthy = accounts.filter(isHealthyAccount).length;
  const warmingUp = accounts.filter((a) => a.warm_up_status === "active").length;
  const paused = accounts.filter(
    (a) => a.warm_up_status === "paused" || a.warm_up_status === "pending",
  ).length;
  const emailsSentToday = accounts.reduce(
    (sum, a) => sum + a.emails_sent_today + a.campaign_sent_today,
    0,
  );
  const avgHealthScore =
    accounts.length > 0
      ? Math.round(
          accounts.reduce((sum, a) => sum + a.current_health_score, 0) /
            accounts.length,
        )
      : 0;

  return {
    totalAccounts: accounts.length,
    healthy,
    warmingUp,
    paused,
    emailsSentToday,
    avgHealthScore,
  };
}

export async function syncWarmUpAccountsForProject(projectId: string) {
  const db = createAdminClient();

  const { data: project } = await db
    .from("admin_email_projects")
    .select("id")
    .eq("id", projectId)
    .single();

  if (!project) return;

  const { data: senders } = await db
    .from("admin_email_project_senders")
    .select("id, email, first_name, last_name, display_name")
    .eq("project_id", projectId);

  const { data: existing } = await db
    .from("admin_email_warm_up_accounts")
    .select("id, email, sender_id, first_name, last_name")
    .eq("project_id", projectId);

  const existingEmails = new Set((existing ?? []).map((r) => r.email));
  const senderEmails = new Set((senders ?? []).map((s) => s.email));

  const toInsert: {
    project_id: string;
    sender_id: string | null;
    email: string;
    first_name: string | null;
    last_name: string | null;
    warm_up_status: WarmUpStatus;
    current_health_score: number;
  }[] = [];

  for (const sender of senders ?? []) {
    if (existingEmails.has(sender.email)) continue;
    toInsert.push({
      project_id: projectId,
      sender_id: sender.id,
      email: sender.email,
      first_name: sender.first_name ?? sender.display_name?.split(" ")[0] ?? null,
      last_name: sender.last_name ?? null,
      warm_up_status: "paused",
      current_health_score: 30,
    });
  }

  if (toInsert.length > 0) {
    await db.from("admin_email_warm_up_accounts").insert(toInsert);
  }

  const orphanIds = (existing ?? [])
    .filter((row) => !senderEmails.has(row.email))
    .map((row) => row.id);
  if (orphanIds.length > 0) {
    await db.from("admin_email_warm_up_accounts").delete().in("id", orphanIds);
  }

  for (const row of existing ?? []) {
    if (!senderEmails.has(row.email)) continue;
    const sender = (senders ?? []).find((s) => s.email === row.email);
    if (!sender) continue;
    if (row.sender_id !== sender.id) {
      await db
        .from("admin_email_warm_up_accounts")
        .update({
          sender_id: sender.id,
          first_name: sender.first_name ?? row.first_name,
          last_name: sender.last_name ?? row.last_name,
        })
        .eq("id", row.id);
    }
  }
}

export async function listWarmUpAccounts(projectId?: string | null) {
  const db = createAdminClient();

  if (projectId) {
    await syncWarmUpAccountsForProject(projectId);
  }

  let query = db
    .from("admin_email_warm_up_accounts")
    .select("*")
    .order("email", { ascending: true });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapWarmUpAccount(row as WarmUpAccountRow));
}

export async function getWarmUpOverview(projectId?: string | null) {
  const db = createAdminClient();

  if (projectId) {
    await syncWarmUpAccountsForProject(projectId);
  }

  let query = db.from("admin_email_warm_up_accounts").select("*");
  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return computeWarmUpOverview((data ?? []) as WarmUpAccountRow[]);
}

export async function startWarmUpAccount(accountId: string) {
  const db = createAdminClient();
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() + 21);

  const { data, error } = await db
    .from("admin_email_warm_up_accounts")
    .update({
      warm_up_status: "active",
      current_stage: "foundation",
      daily_limit: STAGE_DAILY_LIMITS.foundation,
      start_date: now.toISOString(),
      target_completion_date: target.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", accountId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await db
    .from("admin_email_projects")
    .update({
      warm_up_enabled: true,
      updated_at: now.toISOString(),
    })
    .eq("id", data.project_id);

  return mapWarmUpAccount(data as WarmUpAccountRow);
}

export async function pauseWarmUpAccount(accountId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_accounts")
    .update({
      warm_up_status: "paused",
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapWarmUpAccount(data as WarmUpAccountRow);
}

export async function getWarmUpAccount(accountId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (error || !data) throw new Error("Warm-up account not found");
  return mapWarmUpAccount(data as WarmUpAccountRow);
}

export async function updateWarmUpAccount(
  accountId: string,
  updates: {
    firstName?: string | null;
    lastName?: string | null;
    campaignDailyLimit?: number;
  },
) {
  const db = createAdminClient();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.firstName !== undefined) patch.first_name = updates.firstName;
  if (updates.lastName !== undefined) patch.last_name = updates.lastName;
  if (updates.campaignDailyLimit !== undefined) {
    patch.campaign_daily_limit = updates.campaignDailyLimit;
  }

  const { data, error } = await db
    .from("admin_email_warm_up_accounts")
    .update(patch)
    .eq("id", accountId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapWarmUpAccount(data as WarmUpAccountRow);
}

export async function deleteWarmUpAccount(accountId: string) {
  const db = createAdminClient();
  const { error } = await db
    .from("admin_email_warm_up_accounts")
    .delete()
    .eq("id", accountId);
  if (error) throw new Error(error.message);
}

export async function resumeWarmUpAccount(accountId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_accounts")
    .update({
      warm_up_status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapWarmUpAccount(data as WarmUpAccountRow);
}

export async function markReadyForSending(accountId: string) {
  const db = createAdminClient();
  const { data: existing } = await db
    .from("admin_email_warm_up_accounts")
    .select("warm_up_status, current_stage")
    .eq("id", accountId)
    .single();
  if (!existing) throw new Error("Warm-up account not found");
  if (
    existing.warm_up_status !== "completed" &&
    existing.current_stage !== "ready"
  ) {
    throw new Error("Account must complete warm-up before marking ready");
  }

  const { data, error } = await db
    .from("admin_email_warm_up_accounts")
    .update({
      is_ready_for_sending: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapWarmUpAccount(data as WarmUpAccountRow);
}

export async function markNotReadyForSending(accountId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_accounts")
    .update({
      is_ready_for_sending: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapWarmUpAccount(data as WarmUpAccountRow);
}

export async function listReadyForSendingAccounts(projectId?: string | null) {
  const db = createAdminClient();
  let query = db
    .from("admin_email_warm_up_accounts")
    .select("*")
    .eq("is_ready_for_sending", true)
    .in("warm_up_status", ["completed", "active"]);
  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query.order("email", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapWarmUpAccount(row as WarmUpAccountRow));
}

export async function createWarmUpAccountFromSender(senderId: string) {
  const db = createAdminClient();
  const { data: sender } = await db
    .from("admin_email_project_senders")
    .select("id, project_id, email, first_name, last_name, display_name, ses_verified")
    .eq("id", senderId)
    .single();
  if (!sender) throw new Error("Verified sender not found");

  const { data: existing } = await db
    .from("admin_email_warm_up_accounts")
    .select("id")
    .eq("project_id", sender.project_id)
    .eq("email", sender.email)
    .maybeSingle();
  if (existing) {
    return getWarmUpAccount(existing.id);
  }

  return createWarmUpAccount({
    projectId: sender.project_id,
    email: sender.email,
    firstName: sender.first_name ?? sender.display_name?.split(" ")[0],
    lastName: sender.last_name ?? undefined,
  });
}

export type ProjectWarmUpStatus = {
  warmUpEnabled: boolean;
  totalAccounts: number;
  activeAccounts: number;
  completedAccounts: number;
  readyForSending: number;
};

export async function getProjectWarmUpStatus(
  projectId: string,
): Promise<ProjectWarmUpStatus> {
  const db = createAdminClient();
  const [{ data: project }, { data: accounts }] = await Promise.all([
    db
      .from("admin_email_projects")
      .select("warm_up_enabled")
      .eq("id", projectId)
      .single(),
    db
      .from("admin_email_warm_up_accounts")
      .select("warm_up_status, is_ready_for_sending")
      .eq("project_id", projectId),
  ]);

  const rows = accounts ?? [];
  return {
    warmUpEnabled: project?.warm_up_enabled ?? false,
    totalAccounts: rows.length,
    activeAccounts: rows.filter((a) => a.warm_up_status === "active").length,
    completedAccounts: rows.filter((a) => a.warm_up_status === "completed")
      .length,
    readyForSending: rows.filter((a) => a.is_ready_for_sending).length,
  };
}

export async function setProjectWarmUpEnabled(
  projectId: string,
  enabled: boolean,
) {
  const db = createAdminClient();
  const { error } = await db
    .from("admin_email_projects")
    .update({
      warm_up_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  return getProjectWarmUpStatus(projectId);
}

export async function createWarmUpAccount(input: {
  projectId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}) {
  const db = createAdminClient();
  const email = input.email.trim().toLowerCase();

  const { data: project } = await db
    .from("admin_email_projects")
    .select("id, full_domain, use_platform_sender")
    .eq("id", input.projectId)
    .single();

  if (!project) throw new Error("Project not found");

  if (!project.use_platform_sender && project.full_domain) {
    if (!email.endsWith(`@${project.full_domain}`)) {
      throw new Error(`Email must use @${project.full_domain}`);
    }
  }

  const { data: sender } = await db
    .from("admin_email_project_senders")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("email", email)
    .maybeSingle();

  const { data, error } = await db
    .from("admin_email_warm_up_accounts")
    .insert({
      project_id: input.projectId,
      sender_id: sender?.id ?? null,
      email,
      first_name: input.firstName?.trim() || null,
      last_name: input.lastName?.trim() || null,
      warm_up_status: "paused",
      current_health_score: 30,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const { seedDefaultTemplates } = await import("./warm-up-service");
  await seedDefaultTemplates(input.projectId);

  return mapWarmUpAccount(data as WarmUpAccountRow);
}
