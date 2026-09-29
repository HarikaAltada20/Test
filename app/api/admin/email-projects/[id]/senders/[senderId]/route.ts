import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { syncWarmUpAccountsForProject } from "@/lib/admin-email/warm-up";
import {
  checkSesVerificationStatus,
  verifySenderEmailWithSes,
} from "@/lib/email/ses-identity";

type RouteContext = { params: Promise<{ id: string; senderId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id: projectId, senderId } = await context.params;
  let body: {
    email?: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    isDefault?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: project } = await db
    .from("admin_email_projects")
    .select("id, full_domain, use_platform_sender")
    .eq("id", projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.displayName === "string") {
    patch.display_name = body.displayName.trim() || null;
  }
  if (typeof body.firstName === "string") {
    patch.first_name = body.firstName.trim() || null;
  }
  if (typeof body.lastName === "string") {
    patch.last_name = body.lastName.trim() || null;
  }

  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    if (!project.use_platform_sender && project.full_domain) {
      if (!email.endsWith(`@${project.full_domain}`)) {
        return NextResponse.json(
          { error: `Sender must use @${project.full_domain}` },
          { status: 400 },
        );
      }
    }
    await verifySenderEmailWithSes(email);
    const statuses = await checkSesVerificationStatus([email]);
    patch.email = email;
    patch.ses_verified = statuses[email] === "verified";
  }

  if (body.isDefault) {
    await db
      .from("admin_email_project_senders")
      .update({ is_default: false })
      .eq("project_id", projectId);
    patch.is_default = true;
  }

  const { data: sender, error } = await db
    .from("admin_email_project_senders")
    .update(patch)
    .eq("project_id", projectId)
    .eq("id", senderId)
    .select(
      "id, email, is_default, ses_verified, display_name, first_name, last_name, created_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.isDefault && sender) {
    await db
      .from("admin_email_projects")
      .update({ default_sender_id: sender.id })
      .eq("id", projectId);
  }

  return NextResponse.json({ sender });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id: projectId, senderId } = await context.params;
  const db = createAdminClient();

  const { data: project } = await db
    .from("admin_email_projects")
    .select("default_sender_id")
    .eq("id", projectId)
    .single();

  const { error } = await db
    .from("admin_email_project_senders")
    .delete()
    .eq("project_id", projectId)
    .eq("id", senderId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (project?.default_sender_id === senderId) {
    await db
      .from("admin_email_projects")
      .update({ default_sender_id: null })
      .eq("id", projectId);
  }

  try {
    await syncWarmUpAccountsForProject(projectId);
  } catch {
    // best-effort cleanup
  }

  return NextResponse.json({ ok: true });
}
