import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_PAGE_SIZE = 1000;
const MAX_RETRIES = 2;

export type PageResult<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

function isRetryableFetchError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  return (
    message.includes("fetch failed") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("network")
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function countWithRetry(
  runCount: () => PromiseLike<{ count: number | null; error: PostgrestError | null }>,
): Promise<number> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { count, error } = await runCount();
    if (!error) return count ?? 0;
    if (attempt < MAX_RETRIES && isRetryableFetchError(error)) {
      await sleep(250 * (attempt + 1));
      continue;
    }
    throw new Error(error.message);
  }
  return 0;
}

export type CampaignCountStats = {
  recipientCount: number;
  deliveredCount: number;
  failureCount: number;
  readCount: number;
};

/** Accurate per-campaign counts (no 1000-row fetch cap). */
export async function countCampaignStatsByIds(
  db: SupabaseClient,
  campaignIds: string[],
): Promise<Map<string, CampaignCountStats>> {
  const stats = new Map<string, CampaignCountStats>();
  if (campaignIds.length === 0) return stats;

  const BATCH = 8;
  for (let i = 0; i < campaignIds.length; i += BATCH) {
    const batch = campaignIds.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (campaignId) => {
        const [recipientCount, deliveredCount, failureCount, readCount] = await Promise.all([
          countWithRetry(() =>
            db
              .from("admin_notification_campaign_recipients")
              .select("user_id", { count: "exact", head: true })
              .eq("campaign_id", campaignId),
          ),
          countWithRetry(() =>
            db
              .from("admin_notification_campaign_recipients")
              .select("user_id", { count: "exact", head: true })
              .eq("campaign_id", campaignId)
              .eq("delivery_status", "delivered"),
          ),
          countWithRetry(() =>
            db
              .from("admin_notification_campaign_recipients")
              .select("user_id", { count: "exact", head: true })
              .eq("campaign_id", campaignId)
              .eq("delivery_status", "failed"),
          ),
          countWithRetry(() =>
            db
              .from("user_notifications")
              .select("user_id", { count: "exact", head: true })
              .eq("campaign_id", campaignId)
              .eq("is_read", true),
          ),
        ]);

        stats.set(campaignId, {
          recipientCount,
          deliveredCount,
          failureCount,
          readCount,
        });
      }),
    );
  }

  return stats;
}

export type CampaignRecipientRow = {
  user_id: string;
  user_type_at_send: string;
  delivery_status: string;
};

export type CampaignNotificationRow = {
  user_id: string;
  is_read: boolean | null;
  read_at: string | null;
  created_at: string | null;
};

export type CampaignRecipientKeyRow = {
  campaign_id: string;
  user_id: string;
};

/** Fetch all rows from a Supabase query that may exceed the 1000-row default limit. */
export async function fetchAllPaginated<T>(
  runQuery: (from: number, to: number) => Promise<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    let page: T[] = [];
    let lastError: PostgrestError | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const { data, error } = await runQuery(from, to);
      if (!error) {
        page = data ?? [];
        lastError = null;
        break;
      }
      lastError = error;
      if (attempt < MAX_RETRIES && isRetryableFetchError(error)) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      throw new Error(error.message);
    }

    if (lastError) {
      throw new Error(lastError.message);
    }

    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }

  return rows;
}

export function computeReadCountByCampaign(
  deliveredRecipients: CampaignRecipientKeyRow[],
  readRows: CampaignRecipientKeyRow[],
): Map<string, number> {
  const readSet = new Set(
    readRows.map((row) => `${row.campaign_id}:${row.user_id}`),
  );
  const counts = new Map<string, number>();

  for (const row of deliveredRecipients) {
    if (!readSet.has(`${row.campaign_id}:${row.user_id}`)) continue;
    counts.set(row.campaign_id, (counts.get(row.campaign_id) ?? 0) + 1);
  }

  return counts;
}

export type CampaignReadSummary = {
  sent: number;
  read: number;
  readPercent: number;
  byType: Record<string, { sent: number; read: number }>;
};

export function computeCampaignReadSummary(
  recipientRows: CampaignRecipientRow[],
  notifByUser: Map<string, Pick<CampaignNotificationRow, "is_read">>,
): CampaignReadSummary {
  const delivered = recipientRows.filter(
    (row) => row.delivery_status === "delivered",
  );
  const readCount = delivered.filter(
    (row) => notifByUser.get(row.user_id)?.is_read,
  ).length;

  const byType = {
    creator: { sent: 0, read: 0 },
    advertiser: { sent: 0, read: 0 },
    admin: { sent: 0, read: 0 },
  };

  for (const row of delivered) {
    const key = row.user_type_at_send as keyof typeof byType;
    if (!(key in byType)) continue;
    byType[key].sent += 1;
    if (notifByUser.get(row.user_id)?.is_read) {
      byType[key].read += 1;
    }
  }

  return {
    sent: delivered.length,
    read: readCount,
    readPercent:
      delivered.length > 0
        ? Math.round((readCount / delivered.length) * 1000) / 10
        : 0,
    byType,
  };
}
