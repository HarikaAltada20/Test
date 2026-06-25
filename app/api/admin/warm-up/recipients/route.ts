import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  listWarmUpRecipients,
  addWarmUpRecipient,
  bulkAddWarmUpRecipients,
} from "@/lib/admin-email/warm-up-service";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  try {
    const recipients = await listWarmUpRecipients(projectId);
    return NextResponse.json({ recipients });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load recipients";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: {
    projectId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    bulk?: { email: string; firstName?: string; lastName?: string; company?: string }[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    if (body.bulk?.length) {
      const recipients = await bulkAddWarmUpRecipients(body.projectId, body.bulk);
      return NextResponse.json({ recipients });
    }

    if (!body.email?.trim()) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const recipient = await addWarmUpRecipient({
      projectId: body.projectId,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      company: body.company,
    });
    return NextResponse.json({ recipient });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add recipient";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
