import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { syncWarmUpAccountsForProject } from "@/lib/admin-email/warm-up";
import {
  checkSesVerificationStatus,
  verifySenderEmailWithSes,
} from "@/lib/email/ses-identity";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_project_senders")
    .select("id, email, is_default, ses_verified, display_name, first_name, last_name, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ senders: data ?? [] });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: {
    email?: string;
    isDefault?: boolean;
    displayName?: string;
    firstName?: string;
    lastName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: project } = await db
    .from("admin_email_projects")
    .select("id, full_domain, use_platform_sender")
    .eq("id", id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.use_platform_sender && project.full_domain) {
    if (!email.endsWith(`@${project.full_domain}`)) {
      return NextResponse.json(
        { error: `Sender must use @${project.full_domain}` },
        { status: 400 },
      );
    }
  }

  const sesResult = await verifySenderEmailWithSes(email);
  const statuses = await checkSesVerificationStatus([email]);
  const verified = statuses[email] === "verified";

  if (body.isDefault) {
    await db
      .from("admin_email_project_senders")
      .update({ is_default: false })
      .eq("project_id", id);
  }

  const { data: sender, error } = await db
    .from("admin_email_project_senders")
    .insert({
      project_id: id,
      email,
      is_default: !!body.isDefault,
      ses_verified: verified,
      display_name: body.displayName?.trim() || null,
      first_name: body.firstName?.trim() || null,
      last_name: body.lastName?.trim() || null,
    })
    .select(
      "id, email, is_default, ses_verified, display_name, first_name, last_name",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.isDefault && sender) {
    await db
      .from("admin_email_projects")
      .update({ default_sender_id: sender.id })
      .eq("id", id);
  }

  try {
    await syncWarmUpAccountsForProject(id);
  } catch {
    // warm-up sync is best-effort; sender was saved
  }

  return NextResponse.json({
    sender,
    sesError: sesResult.error ?? null,
  });
}
