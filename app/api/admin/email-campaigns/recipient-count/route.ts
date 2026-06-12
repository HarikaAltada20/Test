import { NextRequest, NextResponse } from "next/server";
import { resolveRecipientUsers } from "@/lib/admin-notifications/recipients";
import { countRecipientsByType } from "@/lib/admin-notifications/recipients";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import type { AdminNotificationRecipientMode } from "@/lib/admin-notifications/types";
import type { UserManagementFilterSnapshot } from "@/lib/admin-notifications/types";

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: {
    recipientMode?: AdminNotificationRecipientMode;
    userIds?: string[];
    filters?: UserManagementFilterSnapshot;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { users, error } = await resolveRecipientUsers({
    recipientMode: body.recipientMode ?? "selected_user_ids",
    userIds: body.userIds,
    filters: body.filters,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({
    count: users.length,
    byType: countRecipientsByType(users),
  });
}
