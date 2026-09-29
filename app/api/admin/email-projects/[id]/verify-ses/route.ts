import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { checkSesVerificationStatus } from "@/lib/email/ses-identity";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const db = createAdminClient();

  const { data: project } = await db
    .from("admin_email_projects")
    .select("id, full_domain, use_platform_sender")
    .eq("id", id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.use_platform_sender) {
    return NextResponse.json({
      status: "verified",
      message: "Platform sender is pre-verified",
    });
  }

  if (!project.full_domain) {
    return NextResponse.json(
      { error: "Configure domain first" },
      { status: 400 },
    );
  }

  const statuses = await checkSesVerificationStatus([project.full_domain]);
  const status = statuses[project.full_domain] ?? "pending";

  await db
    .from("admin_email_projects")
    .update({ ses_verification_status: status })
    .eq("id", id);

  return NextResponse.json({ status });
}
