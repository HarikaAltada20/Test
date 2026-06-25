import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  listWarmUpTemplates,
  createWarmUpTemplate,
  seedDefaultTemplates,
} from "@/lib/admin-email/warm-up-service";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  try {
    // Seed defaults if none exist
    await seedDefaultTemplates(projectId);
    const templates = await listWarmUpTemplates(projectId);
    return NextResponse.json({ templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load templates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: { projectId?: string; name?: string; subject?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.projectId || !body.name?.trim() || !body.subject?.trim() || !body.body?.trim()) {
    return NextResponse.json(
      { error: "projectId, name, subject, and body are required" },
      { status: 400 },
    );
  }

  try {
    const template = await createWarmUpTemplate({
      projectId: body.projectId,
      name: body.name,
      subject: body.subject,
      body: body.body,
    });
    return NextResponse.json({ template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create template";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
