import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { resolveRecipientUsers } from "@/lib/admin-notifications/recipients";
import type { AdminNotificationRecipientMode } from "@/lib/admin-notifications/types";
import type { UserManagementFilterSnapshot } from "@/lib/admin-notifications/types";
import {
  addManualLeadToBundle,
  addUsersToBundle,
  deleteBundleMembers,
  getLeadBundle,
} from "@/lib/admin-email/lead-bundles";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id: bundleId } = await context.params;
  let body: {
    userIds?: string[];
    recipientMode?: AdminNotificationRecipientMode;
    filters?: UserManagementFilterSnapshot;
    lead?: {
      email?: string;
      fullName?: string | null;
      username?: string | null;
      userType?: string | null;
    };
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bundle = await getLeadBundle(bundleId);
  if (!bundle) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }

  try {
    if (body.lead?.email?.trim()) {
      const addedCount = await addManualLeadToBundle(bundleId, {
        email: body.lead.email,
        fullName: body.lead.fullName,
        username: body.lead.username,
        userType: body.lead.userType,
      });
      const updated = await getLeadBundle(bundleId);
      return NextResponse.json({
        bundle: updated,
        addedCount,
        totalLeads: updated?.totalLeads ?? 0,
      });
    }

    const recipientMode = body.recipientMode ?? "selected_user_ids";
    const filterSnapshot: UserManagementFilterSnapshot = {
      ...(body.filters ?? {}),
      isActive: body.filters?.isActive !== false,
    };

    const { users, error: recipientError } = await resolveRecipientUsers({
      recipientMode,
      userIds: body.userIds,
      filters: filterSnapshot,
    });

    if (recipientError) {
      return NextResponse.json({ error: recipientError }, { status: 400 });
    }

    if (users.length === 0) {
      return NextResponse.json({ error: "No recipients to add" }, { status: 400 });
    }

    const addedCount = await addUsersToBundle(
      bundleId,
      users.map((u) => u.id),
    );
    const updated = await getLeadBundle(bundleId);
    return NextResponse.json({
      bundle: updated,
      addedCount,
      totalLeads: updated?.totalLeads ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add leads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id: bundleId } = await context.params;

  let body: { memberIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const memberIds = body.memberIds ?? [];
  if (memberIds.length === 0) {
    return NextResponse.json({ error: "memberIds required" }, { status: 400 });
  }

  const bundle = await getLeadBundle(bundleId);
  if (!bundle) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }

  try {
    const result = await deleteBundleMembers(bundleId, memberIds);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete leads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
