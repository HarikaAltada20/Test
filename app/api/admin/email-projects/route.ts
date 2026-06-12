import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { EMAIL_PROJECT_WITH_SENDERS_SELECT } from "@/lib/admin-email/project-options";

const PLATFORM_SENDER = process.env.SES_FROM_EMAIL?.trim() || "noreply@gameofcreators.com";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const db = createAdminClient();
  let projects: Record<string, unknown>[] | null = null;
  let fetchError: { message: string } | null = null;

  const withSenders = await db
    .from("admin_email_projects")
    .select(EMAIL_PROJECT_WITH_SENDERS_SELECT)
    .order("created_at", { ascending: false });

  if (withSenders.error) {
    console.warn("[email-projects] GET with senders failed:", withSenders.error.message);
    const plain = await db
      .from("admin_email_projects")
      .select("*")
      .order("created_at", { ascending: false });
    projects = plain.data;
    fetchError = plain.error;
  } else {
    projects = withSenders.data;
  }

  if (fetchError) {
    console.error("[email-projects] GET failed:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!projects?.length) {
    const { data: seeded } = await db
      .from("admin_email_projects")
      .insert({
        name: "General announcements",
        description: "Default platform sender for admin bulk email",
        use_platform_sender: true,
        ses_verification_status: "verified",
        created_by: auth.user!.id,
      })
      .select("id")
      .single();

    if (seeded) {
      await db.from("admin_email_project_senders").insert({
        project_id: seeded.id,
        email: PLATFORM_SENDER,
        is_default: true,
        ses_verified: true,
      });
    }

    const { data: refreshed } = await db
      .from("admin_email_projects")
      .select(EMAIL_PROJECT_WITH_SENDERS_SELECT)
      .order("created_at", { ascending: false });
    return NextResponse.json({
      projects: await attachProjectStats(db, refreshed ?? []),
    });
  }

  return NextResponse.json({
    projects: await attachProjectStats(db, projects ?? []),
  });
}

async function attachProjectStats(
  db: ReturnType<typeof createAdminClient>,
  projects: Array<{ id: string }>,
) {
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);
  const { data: campaigns, error: campaignsError } = await db
    .from("admin_email_campaigns")
    .select("project_id, recipient_count, sent_count")
    .in("project_id", projectIds);

  if (campaignsError) {
    console.warn("[email-projects] campaign stats skipped:", campaignsError.message);
    return projects.map((p) => ({
      ...p,
      stats: { campaignCount: 0, recipientTotal: 0, sentTotal: 0 },
    }));
  }

  const statsByProject = new Map<
    string,
    { campaignCount: number; recipientTotal: number; sentTotal: number }
  >();
  for (const id of projectIds) {
    statsByProject.set(id, {
      campaignCount: 0,
      recipientTotal: 0,
      sentTotal: 0,
    });
  }
  for (const c of campaigns ?? []) {
    const s = statsByProject.get(c.project_id);
    if (!s) continue;
    s.campaignCount += 1;
    s.recipientTotal += c.recipient_count ?? 0;
    s.sentTotal += c.sent_count ?? 0;
  }

  return projects.map((p) => ({
    ...p,
    stats: statsByProject.get(p.id) ?? {
      campaignCount: 0,
      recipientTotal: 0,
      sentTotal: 0,
    },
  }));
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: {
    name?: string;
    description?: string;
    websiteUrl?: string | null;
    targetAudience?: string | null;
    usePlatformSender?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const description = body.description?.trim() || null;
  if (description && description.length > 1000) {
    return NextResponse.json(
      { error: "Description max 1000 characters" },
      { status: 400 },
    );
  }

  const usePlatformSender = !!body.usePlatformSender;
  const db = createAdminClient();

  const { data: project, error } = await db
    .from("admin_email_projects")
    .insert({
      name,
      description,
      website_url: body.websiteUrl?.trim() || null,
      target_audience: body.targetAudience?.trim() || null,
      use_platform_sender: usePlatformSender,
      ses_verification_status: usePlatformSender ? "verified" : "pending",
      created_by: auth.user!.id,
    })
    .select(
      "id, name, use_platform_sender, ses_verification_status",
    )
    .single();

  if (error || !project) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create project" },
      { status: 500 },
    );
  }

  if (usePlatformSender) {
    await db.from("admin_email_project_senders").insert({
      project_id: project.id,
      email: PLATFORM_SENDER,
      is_default: true,
      ses_verified: true,
    });
  }

  return NextResponse.json({ project });
}
