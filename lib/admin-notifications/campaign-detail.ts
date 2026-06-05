import type { SupabaseClient } from "@supabase/supabase-js";
import {
  countCampaignStatsByIds,
  fetchAllPaginated,
  type CampaignReadSummary,
} from "./read-stats";
import { loadUserDisplayInfoByIds } from "./user-display";

const USER_TYPES = ["creator", "advertiser", "admin"] as const;

export type RecipientListParams = {
  page: number;
  limit: number;
  userType?: string | null;
  readStatus?: string | null;
  search?: string | null;
  sortColumn?: string | null;
  sortOrder?: "asc" | "desc" | null;
};

export type RecipientListRow = {
  userId: string;
  fullName: string;
  email: string;
  userTypeAtSend: string;
  deliveryStatus: string;
  isRead: boolean;
  readAt: string | null;
  sentAt: string | null;
};

export type RecipientListResult = {
  recipients: RecipientListRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type RecipientDbRow = {
  user_id: string;
  user_type_at_send: string;
  delivery_status: string;
};

type NotificationDbRow = {
  user_id: string;
  is_read: boolean | null;
  read_at: string | null;
  created_at: string | null;
};

async function countDeliveredByType(
  db: SupabaseClient,
  campaignId: string,
  userType: string,
): Promise<number> {
  const { count, error } = await db
    .from("admin_notification_campaign_recipients")
    .select("user_id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("delivery_status", "delivered")
    .eq("user_type_at_send", userType);
  if (error) return 0;
  return count ?? 0;
}

async function loadReadUserTypes(
  db: SupabaseClient,
  campaignId: string,
): Promise<Map<string, string>> {
  const readRows = await fetchAllPaginated<{ user_id: string }>(
    async (from, to) => {
      const { data, error } = await db
        .from("user_notifications")
        .select("user_id")
        .eq("campaign_id", campaignId)
        .eq("is_read", true)
        .order("user_id", { ascending: true })
        .range(from, to);
      return { data, error };
    },
  );

  const typeByUser = new Map<string, string>();
  if (readRows.length === 0) return typeByUser;

  const readUserIds = readRows.map((row) => row.user_id);
  const CHUNK = 200;
  for (let i = 0; i < readUserIds.length; i += CHUNK) {
    const chunk = readUserIds.slice(i, i + CHUNK);
    const { data } = await db
      .from("admin_notification_campaign_recipients")
      .select("user_id, user_type_at_send")
      .eq("campaign_id", campaignId)
      .in("user_id", chunk);
    for (const row of data ?? []) {
      typeByUser.set(row.user_id, row.user_type_at_send);
    }
  }

  return typeByUser;
}

export async function buildCampaignDetailSummary(
  db: SupabaseClient,
  campaignId: string,
): Promise<CampaignReadSummary> {
  const statsMap = await countCampaignStatsByIds(db, [campaignId]);
  const stats = statsMap.get(campaignId) ?? {
    recipientCount: 0,
    deliveredCount: 0,
    readCount: 0,
  };

  const byType = {
    creator: { sent: 0, read: 0 },
    advertiser: { sent: 0, read: 0 },
    admin: { sent: 0, read: 0 },
  };

  const [sentCounts, readTypeByUser] = await Promise.all([
    Promise.all(
      USER_TYPES.map(async (type) => ({
        type,
        sent: await countDeliveredByType(db, campaignId, type),
      })),
    ),
    loadReadUserTypes(db, campaignId),
  ]);

  for (const { type, sent } of sentCounts) {
    byType[type].sent = sent;
  }
  for (const type of readTypeByUser.values()) {
    const key = type as keyof typeof byType;
    if (key in byType) byType[key].read += 1;
  }

  const sent = stats.deliveredCount;
  const read = stats.readCount;

  return {
    sent,
    read,
    readPercent: sent > 0 ? Math.round((read / sent) * 1000) / 10 : 0,
    byType,
  };
}

function recipientOrderColumn(sortColumn?: string | null) {
  switch (sortColumn) {
    case "userTypeAtSend":
      return "user_type_at_send";
    case "deliveryStatus":
      return "delivery_status";
    default:
      return "user_id";
  }
}

async function searchMatchingUserIds(
  db: SupabaseClient,
  search: string,
): Promise<string[]> {
  const term = search.trim();
  if (!term) return [];

  const { data, error } = await db
    .from("users")
    .select("id")
    .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(500);

  if (error) return [];
  return (data ?? []).map((row) => row.id);
}

async function loadReadUserIdSet(
  db: SupabaseClient,
  campaignId: string,
): Promise<Set<string>> {
  const rows = await fetchAllPaginated<{ user_id: string }>(
    async (from, to) => {
      const { data, error } = await db
        .from("user_notifications")
        .select("user_id")
        .eq("campaign_id", campaignId)
        .eq("is_read", true)
        .order("user_id", { ascending: true })
        .range(from, to);
      return { data, error };
    },
  );
  return new Set(rows.map((row) => row.user_id));
}

/** Load every recipient for a campaign in a few bulk queries (for client-side sort/filter). */
export async function fetchAllCampaignRecipients(
  db: SupabaseClient,
  campaignId: string,
): Promise<RecipientListRow[]> {
  const [recipientRows, notifications] = await Promise.all([
    fetchAllPaginated<RecipientDbRow>(async (from, to) => {
      const { data, error } = await db
        .from("admin_notification_campaign_recipients")
        .select("user_id, user_type_at_send, delivery_status")
        .eq("campaign_id", campaignId)
        .order("user_id", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
    fetchAllPaginated<NotificationDbRow>(async (from, to) => {
      const { data, error } = await db
        .from("user_notifications")
        .select("user_id, is_read, read_at, created_at")
        .eq("campaign_id", campaignId)
        .order("user_id", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
  ]);

  if (recipientRows.length === 0) return [];

  const userIds = recipientRows.map((row) => row.user_id);
  const usersMap = await loadUserDisplayInfoByIds(userIds);
  const notifByUser = new Map(notifications.map((n) => [n.user_id, n]));

  return recipientRows.map((row) => {
    const user = usersMap.get(row.user_id);
    const notif = notifByUser.get(row.user_id);
    return {
      userId: row.user_id,
      fullName: user?.full_name ?? "",
      email: user?.email ?? "",
      userTypeAtSend: row.user_type_at_send,
      deliveryStatus: row.delivery_status,
      isRead: notif?.is_read ?? false,
      readAt: notif?.read_at ?? null,
      sentAt: notif?.created_at ?? null,
    };
  });
}

async function enrichRecipientRows(
  db: SupabaseClient,
  campaignId: string,
  rows: RecipientDbRow[],
): Promise<RecipientListRow[]> {
  if (rows.length === 0) return [];

  const userIds = rows.map((row) => row.user_id);
  const usersMapPromise = loadUserDisplayInfoByIds(userIds);
  const notifications: NotificationDbRow[] = [];
  const CHUNK = 200;

  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    const { data, error } = await db
      .from("user_notifications")
      .select("user_id, is_read, read_at, created_at")
      .eq("campaign_id", campaignId)
      .in("user_id", chunk);
    if (error) throw new Error(error.message);
    notifications.push(...((data ?? []) as NotificationDbRow[]));
  }

  const usersMap = await usersMapPromise;
  const notifByUser = new Map(notifications.map((n) => [n.user_id, n]));

  return rows.map((row) => {
    const user = usersMap.get(row.user_id);
    const notif = notifByUser.get(row.user_id);
    return {
      userId: row.user_id,
      fullName: user?.full_name ?? "",
      email: user?.email ?? "",
      userTypeAtSend: row.user_type_at_send,
      deliveryStatus: row.delivery_status,
      isRead: notif?.is_read ?? false,
      readAt: notif?.read_at ?? null,
      sentAt: notif?.created_at ?? null,
    };
  });
}

function compareRecipientListRows(
  a: RecipientListRow,
  b: RecipientListRow,
  sortColumn: string,
  sortOrder: "asc" | "desc",
): number {
  let cmp = 0;
  switch (sortColumn) {
    case "fullName":
      cmp = (a.fullName || "").localeCompare(b.fullName || "", undefined, {
        sensitivity: "base",
      });
      break;
    case "email":
      cmp = (a.email || "").localeCompare(b.email || "", undefined, {
        sensitivity: "base",
      });
      break;
    case "isRead":
      cmp = Number(a.isRead) - Number(b.isRead);
      break;
    case "readAt": {
      const aTime = a.readAt ? new Date(a.readAt).getTime() : null;
      const bTime = b.readAt ? new Date(b.readAt).getTime() : null;
      if (aTime === null && bTime === null) cmp = 0;
      else if (aTime === null) cmp = 1;
      else if (bTime === null) cmp = -1;
      else cmp = aTime - bTime;
      break;
    }
    case "userTypeAtSend":
      cmp = (a.userTypeAtSend || "").localeCompare(b.userTypeAtSend || "");
      break;
    case "deliveryStatus":
      cmp = (a.deliveryStatus || "").localeCompare(b.deliveryStatus || "");
      break;
    default:
      cmp = (a.userId || "").localeCompare(b.userId || "");
      break;
  }
  return sortOrder === "asc" ? cmp : -cmp;
}

function paginateRecipients(
  rows: RecipientListRow[],
  page: number,
  limit: number,
): RecipientListResult {
  const total = rows.length;
  const from = (page - 1) * limit;
  const recipients = rows.slice(from, from + limit);
  return {
    recipients,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function fetchRecipientsWithGlobalSort(
  db: SupabaseClient,
  campaignId: string,
  params: RecipientListParams,
  page: number,
  limit: number,
  readStatus: string,
  searchUserIds: string[] | null,
): Promise<RecipientListResult> {
  let rows: RecipientListRow[] = [];

  if (readStatus === "read") {
    const notifications = await fetchAllPaginated<NotificationDbRow>(
      async (from, to) => {
        let query = db
          .from("user_notifications")
          .select("user_id, is_read, read_at, created_at")
          .eq("campaign_id", campaignId)
          .eq("is_read", true)
          .order("user_id", { ascending: true })
          .range(from, to);
        if (searchUserIds) {
          query = query.in("user_id", searchUserIds);
        }
        const { data, error } = await query;
        return { data, error };
      },
    );

    const userIds = [...new Set(notifications.map((n) => n.user_id))];
    if (userIds.length === 0) {
      return paginateRecipients([], page, limit);
    }

    const recipientRows: RecipientDbRow[] = [];
    const CHUNK = 200;
    for (let i = 0; i < userIds.length; i += CHUNK) {
      const chunk = userIds.slice(i, i + CHUNK);
      let query = db
        .from("admin_notification_campaign_recipients")
        .select("user_id, user_type_at_send, delivery_status")
        .eq("campaign_id", campaignId)
        .in("user_id", chunk);
      if (params.userType && params.userType !== "all") {
        query = query.eq("user_type_at_send", params.userType);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      recipientRows.push(...((data ?? []) as RecipientDbRow[]));
    }

    const recipientByUserId = new Map(recipientRows.map((row) => [row.user_id, row]));
    const usersMap = await loadUserDisplayInfoByIds(userIds);
    const mappedRows: RecipientListRow[] = [];
    for (const notif of notifications) {
      const recipient = recipientByUserId.get(notif.user_id);
      if (!recipient) continue;
      const user = usersMap.get(notif.user_id);
      mappedRows.push({
        userId: notif.user_id,
        fullName: user?.full_name ?? "",
        email: user?.email ?? "",
        userTypeAtSend: recipient.user_type_at_send,
        deliveryStatus: recipient.delivery_status,
        isRead: true,
        readAt: notif.read_at,
        sentAt: notif.created_at,
      });
    }
    rows = mappedRows;
  } else if (readStatus === "unread") {
    const readUserIds = await loadReadUserIdSet(db, campaignId);
    const deliveredRows = await fetchAllPaginated<RecipientDbRow>(
      async (from, to) => {
        const { data, error } = await buildRecipientBaseQuery(
          db,
          campaignId,
          params,
          searchUserIds,
        ).range(from, to);
        return { data, error };
      },
    );

    const unreadRows = deliveredRows.filter((row) => !readUserIds.has(row.user_id));
    rows = await enrichRecipientRows(db, campaignId, unreadRows);
  } else {
    const allRows = await fetchAllPaginated<RecipientDbRow>(async (from, to) => {
      let query = db
        .from("admin_notification_campaign_recipients")
        .select("user_id, user_type_at_send, delivery_status")
        .eq("campaign_id", campaignId)
        .order("user_id", { ascending: true })
        .range(from, to);

      if (params.userType && params.userType !== "all") {
        query = query.eq("user_type_at_send", params.userType);
      }
      if (searchUserIds) {
        query = query.in("user_id", searchUserIds);
      }

      const { data, error } = await query;
      return { data, error };
    });

    rows = await enrichRecipientRows(db, campaignId, allRows);
  }

  const sortColumn = params.sortColumn ?? "userId";
  const sortOrder = params.sortOrder ?? "asc";
  rows.sort((a, b) => compareRecipientListRows(a, b, sortColumn, sortOrder));
  return paginateRecipients(rows, page, limit);
}

function buildRecipientBaseQuery(
  db: SupabaseClient,
  campaignId: string,
  params: RecipientListParams,
  searchUserIds: string[] | null,
) {
  let query = db
    .from("admin_notification_campaign_recipients")
    .select("user_id, user_type_at_send, delivery_status")
    .eq("campaign_id", campaignId)
    .eq("delivery_status", "delivered")
    .order("user_id", { ascending: true });

  if (params.userType && params.userType !== "all") {
    query = query.eq("user_type_at_send", params.userType);
  }
  if (searchUserIds) {
    query = query.in("user_id", searchUserIds);
  }

  return query;
}

async function fetchUnreadRecipientPage(
  db: SupabaseClient,
  campaignId: string,
  params: RecipientListParams,
  readUserIds: Set<string>,
  searchUserIds: string[] | null,
): Promise<RecipientListResult> {
  if (searchUserIds && searchUserIds.length === 0) {
    return {
      recipients: [],
      total: 0,
      page: params.page,
      limit: params.limit,
      totalPages: 1,
    };
  }

  const skip = (params.page - 1) * params.limit;
  const pageRows: RecipientDbRow[] = [];
  let matched = 0;
  let scanOffset = 0;
  const SCAN = 250;

  while (pageRows.length < params.limit) {
    const { data, error } = await buildRecipientBaseQuery(
      db,
      campaignId,
      params,
      searchUserIds,
    ).range(scanOffset, scanOffset + SCAN - 1);

    if (error) throw new Error(error.message);
    const batch = data ?? [];
    if (batch.length === 0) break;

    for (const row of batch) {
      if (readUserIds.has(row.user_id)) continue;
      if (matched >= skip && pageRows.length < params.limit) {
        pageRows.push(row);
      }
      matched += 1;
    }

    if (batch.length < SCAN) break;
    scanOffset += SCAN;
  }

  const recipients = await enrichRecipientRows(db, campaignId, pageRows);

  return {
    recipients,
    total: matched,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(matched / params.limit)),
  };
}

export async function fetchCampaignRecipientsPage(
  db: SupabaseClient,
  campaignId: string,
  params: RecipientListParams,
): Promise<RecipientListResult> {
  const page = Math.max(1, params.page);
  const limit = Math.min(100, Math.max(1, params.limit));
  const readStatus = params.readStatus ?? "all";
  const globalSortColumns = new Set(["fullName", "email", "isRead", "readAt"]);
  const searchUserIds = params.search?.trim()
    ? await searchMatchingUserIds(db, params.search)
    : null;

  if (params.sortColumn && globalSortColumns.has(params.sortColumn)) {
    return fetchRecipientsWithGlobalSort(
      db,
      campaignId,
      params,
      page,
      limit,
      readStatus,
      searchUserIds,
    );
  }

  if (readStatus === "read") {
    if (searchUserIds && searchUserIds.length === 0) {
      return { recipients: [], total: 0, page, limit, totalPages: 1 };
    }

    let query = db
      .from("user_notifications")
      .select("user_id, is_read, read_at, created_at", { count: "exact" })
      .eq("campaign_id", campaignId)
      .eq("is_read", true)
      .order("user_id", { ascending: true });

    if (searchUserIds) {
      query = query.in("user_id", searchUserIds);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data: notifications, count, error } = await query.range(from, to);
    if (error) throw new Error(error.message);

    const userIds = (notifications ?? []).map((n) => n.user_id);
    if (userIds.length === 0) {
      return {
        recipients: [],
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
      };
    }

    let recipQuery = db
      .from("admin_notification_campaign_recipients")
      .select("user_id, user_type_at_send, delivery_status")
      .eq("campaign_id", campaignId)
      .in("user_id", userIds);

    if (params.userType && params.userType !== "all") {
      recipQuery = recipQuery.eq("user_type_at_send", params.userType);
    }

    const { data: recipientRows, error: recipError } = await recipQuery;
    if (recipError) throw new Error(recipError.message);

    const recipByUser = new Map(
      (recipientRows ?? []).map((row) => [row.user_id, row]),
    );
    const usersMap = await loadUserDisplayInfoByIds(userIds);

    const recipients: RecipientListRow[] = [];
    for (const notif of notifications ?? []) {
      const recip = recipByUser.get(notif.user_id);
      if (!recip) continue;
      if (
        params.userType &&
        params.userType !== "all" &&
        recip.user_type_at_send !== params.userType
      ) {
        continue;
      }
      const user = usersMap.get(notif.user_id);
      recipients.push({
        userId: notif.user_id,
        fullName: user?.full_name ?? "",
        email: user?.email ?? "",
        userTypeAtSend: recip.user_type_at_send,
        deliveryStatus: recip.delivery_status,
        isRead: true,
        readAt: notif.read_at,
        sentAt: notif.created_at,
      });
    }

    const total = count ?? recipients.length;
    return {
      recipients,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  if (readStatus === "unread") {
    const readUserIds = await loadReadUserIdSet(db, campaignId);
    return fetchUnreadRecipientPage(
      db,
      campaignId,
      { ...params, page, limit },
      readUserIds,
      searchUserIds,
    );
  }

  if (searchUserIds && searchUserIds.length === 0) {
    return { recipients: [], total: 0, page, limit, totalPages: 1 };
  }

  const orderColumn = recipientOrderColumn(params.sortColumn);
  const ascending = params.sortOrder !== "desc";

  let query = db
    .from("admin_notification_campaign_recipients")
    .select("user_id, user_type_at_send, delivery_status", { count: "exact" })
    .eq("campaign_id", campaignId)
    .order(orderColumn, { ascending });

  if (params.userType && params.userType !== "all") {
    query = query.eq("user_type_at_send", params.userType);
  }
  if (searchUserIds) {
    query = query.in("user_id", searchUserIds);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const recipients = await enrichRecipientRows(db, campaignId, data ?? []);
  const total = count ?? recipients.length;

  return {
    recipients,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
