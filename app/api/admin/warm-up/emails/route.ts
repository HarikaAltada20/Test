import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  createWarmUpAccount,
  listWarmUpAccounts,
} from "@/lib/admin-email/warm-up";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const projectId = req.nextUrl.searchParams.get("project_id");

  try {
    const accounts = await listWarmUpAccounts(projectId);
    return NextResponse.json({ accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load accounts";
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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.projectId || !body.email?.trim()) {
    return NextResponse.json(
      { error: "projectId and email are required" },
      { status: 400 },
    );
  }

  try {
    const account = await createWarmUpAccount({
      projectId: body.projectId,
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
    });
    return NextResponse.json({ account });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
