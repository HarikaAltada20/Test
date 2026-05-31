import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPPORT_RETENTION_DAYS } from "@/lib/constants/support";
import { SUPPORT_ADMIN_SENDER_ROLE } from "@/lib/support/sender-role";

export type SupportThreadRow = {
  id: string;
  user_id: string;
  user_type: string | null;
  status: string;
  subject: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
};

export type SupportMessageRow = {
  id: string;
  thread_id: string;
  sender_role: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

export async function findActiveThreadForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<SupportThreadRow | null> {
  const { data } = await supabase
    .from("support_threads")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["open", "replied"])
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as SupportThreadRow | null;
}

export async function countUserThreadsToday(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("support_threads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());

  return count ?? 0;
}

export async function countUserMessagesInThreadToday(
  supabase: SupabaseClient,
  threadId: string,
  userId: string,
): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_id", threadId)
    .eq("sender_user_id", userId)
    .neq("sender_role", SUPPORT_ADMIN_SENDER_ROLE)
    .gte("created_at", start.toISOString());

  return count ?? 0;
}

export function retentionCutoffDate(beforeDays = SUPPORT_RETENTION_DAYS): Date {
  const d = new Date();
  d.setDate(d.getDate() - beforeDays);
  return d;
}

export async function deleteThreads(
  supabase: SupabaseClient,
  threadIds: string[],
): Promise<number> {
  if (threadIds.length === 0) return 0;

  const { data, error } = await supabase
    .from("support_threads")
    .delete()
    .in("id", threadIds)
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

export async function countThreadsBeforeDate(
  supabase: SupabaseClient,
  before: Date,
): Promise<number> {
  const { count } = await supabase
    .from("support_threads")
    .select("id", { count: "exact", head: true })
    .lt("last_message_at", before.toISOString());

  return count ?? 0;
}

export async function deleteThreadsBeforeDate(
  supabase: SupabaseClient,
  before: Date,
): Promise<number> {
  const { data, error } = await supabase
    .from("support_threads")
    .delete()
    .lt("last_message_at", before.toISOString())
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}
