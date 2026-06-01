import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupportUser } from "@/lib/support/auth";
import { supportDbForUser } from "@/lib/support/supabase-for-user";

export const dynamic = "force-dynamic";

const NOTIFICATION_SELECT =
  "id, notification_type, title, message_resolved, is_read, read_at, created_at, support_thread_id";

function isAdminUser(userType: string): boolean {
  return userType === "admin";
}

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

  let listQuery = supabase
    .from("user_notifications")
    .select(NOTIFICATION_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (isAdminUser(user.user_type)) {
    listQuery = listQuery.or(
      `notification_type.eq.support_user_message,user_id.eq.${user.id}`,
    );
  } else {
    listQuery = listQuery.eq("user_id", user.id);
  }

  const { data, error: listError } = await listQuery;

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  let unreadQuery = supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  if (isAdminUser(user.user_type)) {
    unreadQuery = unreadQuery.or(
      `notification_type.eq.support_user_message,user_id.eq.${user.id}`,
    );
  } else {
    unreadQuery = unreadQuery.eq("user_id", user.id);
  }

  const { count: unreadCount } = await unreadQuery;

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

  const { notification_ids, mark_all_read, support_thread_id } =
    await req.json();
  const supabase = supportDbForUser(user);
  const now = new Date().toISOString();

  if (support_thread_id && typeof support_thread_id === "string") {
    let updateQuery = supabase
      .from("user_notifications")
      .update({ is_read: true, read_at: now })
      .eq("support_thread_id", support_thread_id)
      .eq("is_read", false);

    if (isAdminUser(user.user_type)) {
      updateQuery = updateQuery.eq("notification_type", "support_user_message");
    } else {
      updateQuery = updateQuery.eq("user_id", user.id);
    }

    const { error: updateError } = await updateQuery;

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (mark_all_read) {
    let updateQuery = supabase
      .from("user_notifications")
      .update({ is_read: true, read_at: now })
      .eq("is_read", false);

    if (isAdminUser(user.user_type)) {
      updateQuery = updateQuery.or(
        `notification_type.eq.support_user_message,user_id.eq.${user.id}`,
      );
    } else {
      updateQuery = updateQuery.eq("user_id", user.id);
    }

    const { error: updateError } = await updateQuery;

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

  let updateQuery = supabase
    .from("user_notifications")
    .update({ is_read: true, read_at: now })
    .in("id", notification_ids);

  if (!isAdminUser(user.user_type)) {
    updateQuery = updateQuery.eq("user_id", user.id);
  }

  const { error: updateError } = await updateQuery;

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
