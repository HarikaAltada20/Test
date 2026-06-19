import { createAdminClient } from "@/utils/supabase/admin";

export type WarmUpStatus =
  | "pending"
  | "active"
  | "paused"
  | "completed"
  | "failed";
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

function clampHealthScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function utcTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isWarmUpDayClosed(): boolean {
  const now = new Date();
  return now.getUTCHours() === 23 && now.getUTCMinutes() >= 59;
}

export type WarmUpMetricSnapshot = {
  latest: { health_score: number; date: string } | null;
  priorToToday: { health_score: number; date: string } | null;
};

/**
 * Health % during the day is computed live from send records (pre-today only).
 * Tonight's 23:59 job (closeOutDay) finalizes today's score in metrics.
 */
export function resolveDisplayHealthScore(opts: {
  preTodaySendCount: number;
  metrics: WarmUpMetricSnapshot;
  liveScore?: number | null;
}): number {
  const today = utcTodayDate();

  if (
    isWarmUpDayClosed() &&
    opts.metrics.latest?.date === today
  ) {
    return clampHealthScore(opts.metrics.latest.health_score);
  }

  if (opts.preTodaySendCount === 0) {
    return 0;
  }

  if (opts.liveScore != null) {
    return clampHealthScore(opts.liveScore);
  }

  if (opts.metrics.priorToToday) {
    return clampHealthScore(opts.metrics.priorToToday.health_score);
  }

  return 0;
}

export function isHealthyAccount(
  row: WarmUpAccountRow,
  displayHealthScore?: number,
): boolean {
  const health =
    displayHealthScore ??
    resolveDisplayHealthScore({
      preTodaySendCount: 0,
      metrics: { latest: null, priorToToday: null },
    });
  return (
    health >= 80 ||
    (row.warm_up_status === "completed" && row.is_ready_for_sending)
  );
}

export function mapWarmUpAccount(
  row: WarmUpAccountRow,
  context?: {
    metrics?: WarmUpMetricSnapshot;
    preTodaySendCount?: number;
    liveScore?: number | null;
  },
): WarmUpAccountListItem {
  const healthScore = resolveDisplayHealthScore({
    preTodaySendCount: context?.preTodaySendCount ?? 0,
    metrics: context?.metrics ?? { latest: null, priorToToday: null },
    liveScore: context?.liveScore,
  });
  return {
    ...row,
    current_health_score: healthScore,
    display_name: displayName(row),
    status_label: statusLabel(row.warm_up_status, healthScore),
  };
}

export function computeWarmUpOverview(
  accounts: WarmUpAccountListItem[],
): WarmUpOverview {
  const healthy = accounts.filter((a) =>
    isHealthyAccount(a, a.current_health_score),
  ).length;
  const warmingUp = accounts.filter(
    (a) => a.warm_up_status === "active",
  ).length;
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

async function fetchMetricsSnapshotsByAccountId(
  accountIds: string[],
): Promise<Map<string, WarmUpMetricSnapshot>> {
  const map = new Map<string, WarmUpMetricSnapshot>();
  if (accountIds.length === 0) return map;

  const today = utcTodayDate();
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_metrics")
    .select("account_id, health_score, date")
    .in("account_id", accountIds)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const existing = map.get(row.account_id) ?? {
      latest: null,
      priorToToday: null,
    };

    if (!existing.latest) {
      existing.latest = {
        health_score: row.health_score,
        date: row.date,
      };
    }

    if (!existing.priorToToday && row.date < today) {
      existing.priorToToday = {
        health_score: row.health_score,
        date: row.date,
      };
    }

    map.set(row.account_id, existing);
  }

  return map;
}

async function fetchPreTodaySendCounts(
  accountIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (accountIds.length === 0) return counts;

  const today = utcTodayDate();
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_sends")
    .select("account_id")
    .in("account_id", accountIds)
    .lt("sent_at", `${today}T00:00:00.000Z`);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    counts.set(row.account_id, (counts.get(row.account_id) ?? 0) + 1);
  }

  return counts;
}

async function mapWarmUpAccountsWithMetrics(
  rows: WarmUpAccountRow[],
): Promise<WarmUpAccountListItem[]> {
  const accountIds = rows.map((row) => row.id);
  const { computeDisplayHealthScoresByAccountId } = await import(
    "./warm-up-service"
  );
  const [metricsByAccount, preTodayCounts, liveScores] = await Promise.all([
    fetchMetricsSnapshotsByAccountId(accountIds),
    fetchPreTodaySendCounts(accountIds),
    computeDisplayHealthScoresByAccountId(accountIds, { closeOutDay: false }),
  ]);

  return rows.map((row) =>
    mapWarmUpAccount(row, {
      metrics: metricsByAccount.get(row.id) ?? {
        latest: null,
        priorToToday: null,
      },
      preTodaySendCount: preTodayCounts.get(row.id) ?? 0,
      liveScore: liveScores.get(row.id) ?? null,
    }),
  );
}

async function fetchAccountDisplayContext(accountId: string) {
  const { computeDisplayHealthScoresByAccountId } = await import(
    "./warm-up-service"
  );
  const [metricsByAccount, preTodayCounts, liveScores] = await Promise.all([
    fetchMetricsSnapshotsByAccountId([accountId]),
    fetchPreTodaySendCounts([accountId]),
    computeDisplayHealthScoresByAccountId([accountId], { closeOutDay: false }),
  ]);
  return {
    metrics: metricsByAccount.get(accountId) ?? {
      latest: null,
      priorToToday: null,
    },
    preTodaySendCount: preTodayCounts.get(accountId) ?? 0,
    liveScore: liveScores.get(accountId) ?? null,
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
      first_name:
        sender.first_name ?? sender.display_name?.split(" ")[0] ?? null,
      last_name: sender.last_name ?? null,
      warm_up_status: "paused",
      current_health_score: 0,
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
  if (projectId) {
    await syncWarmUpAccountsForProject(projectId);
  }
  const rows = await queryWarmUpAccountRows(projectId);
  return mapWarmUpAccountsWithMetrics(rows);
}

async function queryWarmUpAccountRows(projectId?: string | null) {
  const db = createAdminClient();
  let query = db
    .from("admin_email_warm_up_accounts")
    .select("*")
    .order("email", { ascending: true });

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as WarmUpAccountRow[];
}

/** Single round-trip: optional background sender sync, one DB read, accounts + overview. */
export async function getWarmUpDashboard(
  projectId?: string | null,
  options?: { sync?: boolean },
) {
  if (projectId) {
    if (options?.sync) {
      await syncWarmUpAccountsForProject(projectId);
    } else {
      void syncWarmUpAccountsForProject(projectId).catch((err) => {
        console.warn("[warm-up] background sender sync failed:", err);
      });
    }
  }
  const rows = await queryWarmUpAccountRows(projectId);
  const accounts = await mapWarmUpAccountsWithMetrics(rows);
  return {
    accounts,
    overview: computeWarmUpOverview(accounts),
  };
}

export async function getWarmUpOverview(projectId?: string | null) {
  const accounts = await listWarmUpAccounts(projectId);
  return computeWarmUpOverview(accounts);
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

  return mapWarmUpAccount(
    data as WarmUpAccountRow,
    await fetchAccountDisplayContext(accountId),
  );
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
  return mapWarmUpAccount(
    data as WarmUpAccountRow,
    await fetchAccountDisplayContext(accountId),
  );
}

export async function getWarmUpAccount(accountId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (error || !data) throw new Error("Warm-up account not found");
  return mapWarmUpAccount(
    data as WarmUpAccountRow,
    await fetchAccountDisplayContext(accountId),
  );
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
  return mapWarmUpAccount(
    data as WarmUpAccountRow,
    await fetchAccountDisplayContext(accountId),
  );
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
  return mapWarmUpAccount(
    data as WarmUpAccountRow,
    await fetchAccountDisplayContext(accountId),
  );
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
  return mapWarmUpAccount(
    data as WarmUpAccountRow,
    await fetchAccountDisplayContext(accountId),
  );
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
  return mapWarmUpAccount(
    data as WarmUpAccountRow,
    await fetchAccountDisplayContext(accountId),
  );
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
  return mapWarmUpAccountsWithMetrics((data ?? []) as WarmUpAccountRow[]);
}

export async function createWarmUpAccountFromSender(senderId: string) {
  const db = createAdminClient();
  const { data: sender } = await db
    .from("admin_email_project_senders")
    .select(
      "id, project_id, email, first_name, last_name, display_name, ses_verified",
    )
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
      current_health_score: 0,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const { seedDefaultTemplates } = await import("./warm-up-service");
  await seedDefaultTemplates(input.projectId);

  return mapWarmUpAccount(data as WarmUpAccountRow, {
    metrics: { latest: null, priorToToday: null },
    preTodaySendCount: 0,
  });
}
