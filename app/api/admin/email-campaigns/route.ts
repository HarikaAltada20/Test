import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { listEmailCampaigns, listEmailCampaignsMinimal, listEmailCampaignsPaginated } from "@/lib/admin-email/campaign-list";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const projectId = req.nextUrl.searchParams.get("projectId");
  const minimal = req.nextUrl.searchParams.get("minimal") === "1";
  const pageParam = req.nextUrl.searchParams.get("page");

  try {
    if (minimal) {
      const campaigns = await listEmailCampaignsMinimal(projectId);
      return NextResponse.json({ campaigns });
    }

    if (pageParam) {
      const status = req.nextUrl.searchParams.get("status");
      const search = req.nextUrl.searchParams.get("search");
      const page = parseInt(pageParam, 10);
      const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "25", 10);
      const result = await listEmailCampaignsPaginated({
        projectId,
        status,
        search,
        page,
        limit,
      });
      return NextResponse.json(result);
    }

    const campaigns = await listEmailCampaigns(projectId);
    return NextResponse.json({ campaigns });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load campaigns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: { projectId?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId?.trim();
  const name = body.name?.trim();
  if (!projectId || !name) {
    return NextResponse.json(
      { error: "projectId and name are required" },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const { data: project } = await db
    .from("admin_email_projects")
    .select("id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: campaign, error } = await db
    .from("admin_email_campaigns")
    .insert({
      project_id: projectId,
      name,
      status: "draft",
      created_by: auth.user!.id,
    })
    .select("id, name, status, recipient_count, project_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaign });
}
