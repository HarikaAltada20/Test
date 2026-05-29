import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupportUser } from "@/lib/support/auth";
import { supportDbForUser } from "@/lib/support/supabase-for-user";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user, error, status } = await getAuthenticatedSupportUser();
  if (!user) {
    return NextResponse.json({ error }, { status });
  }

  const limit = Math.min(
    50,
    Math.max(1, parseInt(new URL(req.url).searchParams.get("limit") ?? "20", 10)),
  );

  const supabase = supportDbForUser(user);
  const { data, error: listError } = await supabase
    .from("user_notifications")
    .select(
      "id, notification_type, title, message_resolved, is_read, read_at, created_at, support_thread_id",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const { count: unreadCount } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return NextResponse.json({
    notifications: data ?? [],
    unread_count: unreadCount ?? 0,
  });
}

export async function PATCH(req: NextRequest) {
  const { user, error, status } = await getAuthenticatedSupportUser();
  if (!user) {
    return NextResponse.json({ error }, { status });
  }

  const { notification_ids, mark_all_read } = await req.json();
  const supabase = supportDbForUser(user);
  const now = new Date().toISOString();

  if (mark_all_read) {
    const { error: updateError } = await supabase
      .from("user_notifications")
      .update({ is_read: true, read_at: now })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (!Array.isArray(notification_ids) || notification_ids.length === 0) {
    return NextResponse.json(
      { error: "notification_ids required" },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("user_notifications")
    .update({ is_read: true, read_at: now })
    .eq("user_id", user.id)
    .in("id", notification_ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
