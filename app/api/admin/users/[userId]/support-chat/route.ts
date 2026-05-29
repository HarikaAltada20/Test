import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { isAdmin, user: admin } = await verifyAdminAccess();
  if (!isAdmin || !admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await context.params;
  const { enabled, reason } = await req.json();

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled boolean is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const update: Record<string, unknown> = {
    support_chat_enabled: enabled,
  };

  if (enabled) {
    update.support_chat_disabled_at = null;
    update.support_chat_disabled_by = null;
    update.support_chat_disable_reason = null;
  } else {
    update.support_chat_disabled_at = new Date().toISOString();
    update.support_chat_disabled_by = admin.id;
    update.support_chat_disable_reason =
      typeof reason === "string" ? reason.trim() || null : null;
  }

  const { data, error } = await supabase
    .from("users")
    .update(update)
    .eq("id", userId)
    .select(
      "id, email, username, support_chat_enabled, support_chat_disabled_at, support_chat_disable_reason",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: data });
}
