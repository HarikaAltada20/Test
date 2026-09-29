import type { SupportMessageRow } from "@/lib/support/threads";

/** Support chat messages are stored in the legacy `queries` table. */
export const SUPPORT_MESSAGES_TABLE = "queries" as const;

export type QueryMessageRow = {
  id: string;
  thread_id: string | null;
  user_id: string | null;
  user_type: string | null;
  query_text: string | null;
  created_at: string;
};

export function mapQueryRowToMessage(row: QueryMessageRow): SupportMessageRow {
  return {
    id: row.id,
    thread_id: row.thread_id ?? row.id,
    sender_role: row.user_type ?? "creator",
    sender_user_id: row.user_id ?? "",
    body: row.query_text ?? "",
    created_at: row.created_at,
  };
}

export function mapQueryRowsToMessages(
  rows: QueryMessageRow[] | null | undefined,
): SupportMessageRow[] {
  return (rows ?? []).map(mapQueryRowToMessage);
}

export function messageInsertPayload(input: {
  thread_id: string;
  sender_role: string;
  sender_user_id: string;
  body: string;
}) {
  return {
    thread_id: input.thread_id,
    user_id: input.sender_user_id,
    user_type: input.sender_role,
    query_text: input.body,
  };
}

export const MESSAGE_SELECT_COLUMNS =
  "id, thread_id, user_id, user_type, query_text, created_at" as const;
