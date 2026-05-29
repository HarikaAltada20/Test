import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10)),
  );
  const status = searchParams.get("status");
  const userType = searchParams.get("user_type");
  const search = searchParams.get("search")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = createAdminClient();
  let query = supabase
    .from("support_threads")
    .select(
      `
      id,
      user_id,
      user_type,
      status,
      subject,
      created_at,
      updated_at,
      last_message_at,
      users!user_id ( id, email, username, support_chat_enabled )
    `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("last_message_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (userType && userType !== "all") {
    query = query.eq("user_type", userType);
  }
  if (from) {
    query = query.gte("last_message_at", from);
  }
  if (to) {
    query = query.lte("last_message_at", to);
  }

  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  const { data, error, count } = await query.range(fromIdx, toIdx);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let threads = data ?? [];

  if (search) {
    const q = search.toLowerCase();
    threads = threads.filter((t: Record<string, unknown>) => {
      const u = t.users as { email?: string; username?: string } | null;
      const subject = String(t.subject || "").toLowerCase();
      return (
        u?.email?.toLowerCase().includes(q) ||
        u?.username?.toLowerCase().includes(q) ||
        subject.includes(q)
      );
    });
  }

  const threadIds = threads.map((t: { id: string }) => t.id);
  let lastMessages: Record<string, string> = {};
  if (threadIds.length > 0) {
    const { data: msgs } = await supabase
      .from("support_messages")
      .select("thread_id, body, created_at, sender_role")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false });

    for (const m of msgs ?? []) {
      // Show the latest customer message (creator/advertiser), not support/admin reply.
      if (!lastMessages[m.thread_id] && m.sender_role !== "admin") {
        lastMessages[m.thread_id] = m.body;
      }
    }
  }

  const enriched = threads.map((t: Record<string, unknown>) => ({
    ...t,
    last_message_preview: lastMessages[t.id as string] || t.subject || "",
  }));

  return NextResponse.json({
    threads: enriched,
    total: count ?? enriched.length,
    page,
    pageSize,
  });
}
