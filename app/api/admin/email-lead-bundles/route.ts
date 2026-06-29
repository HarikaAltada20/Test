import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { resolveRecipientUsers } from "@/lib/admin-notifications/recipients";
import type { AdminNotificationRecipientMode } from "@/lib/admin-notifications/types";
import type { UserManagementFilterSnapshot } from "@/lib/admin-notifications/types";
import {
  addUsersToBundle,
  createLeadBundle,
  deleteLeadBundles,
  getLeadBundle,
  getLeadBundleStats,
  importLeadsToBundle,
  listLeadBundles,
  parseCsvEmails,
  parseCsvLeads,
  parseLeadsFromUpload,
} from "@/lib/admin-email/lead-bundles";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  if (sp.get("stats") === "1") {
    try {
      const stats = await getLeadBundleStats();
      return NextResponse.json(stats);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load stats";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    const result = await listLeadBundles({
      search: sp.get("search") ?? undefined,
      projectId: sp.get("projectId") ?? undefined,
      page: Number(sp.get("page") ?? 1),
      limit: Number(sp.get("limit") ?? 25),
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load bundles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const bundleId = String(form.get("bundleId") ?? "").trim() || null;
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim() || null;
    const projectId = String(form.get("projectId") ?? "").trim() || null;
    const file = form.get("file");

    if (!bundleId && !name) {
      return NextResponse.json(
        { error: "Bundle name is required when creating a new bundle" },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV or Excel file is required" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be 10MB or smaller" }, { status: 400 });
    }

    try {
      const buffer = await file.arrayBuffer();
      const leads = await parseLeadsFromUpload(file.name, buffer);
      if (leads.length === 0) {
        return NextResponse.json(
          { error: "No valid email addresses found in the file" },
          { status: 400 },
        );
      }

      if (bundleId) {
        const existing = await getLeadBundle(bundleId);
        if (!existing) {
          return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
        }
        if (projectId && existing.projectId && existing.projectId !== projectId) {
          return NextResponse.json(
            { error: "Selected bundle does not belong to this project" },
            { status: 400 },
          );
        }

        const importResult = await importLeadsToBundle(bundleId, leads);
        const updated = (await getLeadBundle(bundleId)) ?? existing;

        return NextResponse.json({
          bundle: updated,
          import: importResult,
        });
      }

      const bundle = await createLeadBundle({ name, description, projectId });
      const importResult = await importLeadsToBundle(bundle.id, leads);
      const created = (await getLeadBundle(bundle.id)) ?? bundle;

      return NextResponse.json({
        bundle: created,
        import: importResult,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Import failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  let body: {
    name?: string;
    description?: string;
    projectId?: string | null;
    sourceCampaignId?: string | null;
    emails?: string[];
    csvText?: string;
    userIds?: string[];
    recipientMode?: AdminNotificationRecipientMode;
    filters?: UserManagementFilterSnapshot;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Bundle name is required" }, { status: 400 });
  }

  try {
    const bundle = await createLeadBundle({
      name,
      description: body.description,
      projectId: body.projectId,
      sourceCampaignId: body.sourceCampaignId,
    });

    const leads =
      body.emails?.map((email) => ({
        email,
        fullName: null,
        username: null,
        userType: null,
      })) ?? (body.csvText ? parseCsvLeads(body.csvText) : []);

    let importResult = { matched: 0, failed: 0, total: 0 };
    if (leads.length > 0) {
      importResult = await importLeadsToBundle(bundle.id, leads);
    }

    let addedUserCount = 0;
    const recipientMode = body.recipientMode ?? "selected_user_ids";
    if (recipientMode === "select_all_filtered" || (body.userIds?.length ?? 0) > 0) {
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
      if (users.length > 0) {
        addedUserCount = await addUsersToBundle(
          bundle.id,
          users.map((u) => u.id),
        );
      }
    }

    const updatedBundle = await getLeadBundle(bundle.id);

    return NextResponse.json({
      bundle: updatedBundle ?? bundle,
      import: importResult,
      addedUserCount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create bundle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: { bundleIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bundleIds = body.bundleIds ?? [];
  if (bundleIds.length === 0) {
    return NextResponse.json({ error: "bundleIds required" }, { status: 400 });
  }

  try {
    const deletedCount = await deleteLeadBundles(bundleIds);
    return NextResponse.json({ deletedCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete bundles";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
