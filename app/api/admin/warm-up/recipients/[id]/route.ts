import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  updateWarmUpRecipient,
  deleteWarmUpRecipient,
} from "@/lib/admin-email/warm-up-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  let body: {
    first_name?: string | null;
    last_name?: string | null;
    company?: string | null;
    is_active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const recipient = await updateWarmUpRecipient(id, {
      ...(body.first_name !== undefined && { first_name: body.first_name }),
      ...(body.last_name !== undefined && { last_name: body.last_name }),
      ...(body.company !== undefined && { company: body.company }),
      ...(body.is_active !== undefined && { is_active: body.is_active }),
    });
    return NextResponse.json({ recipient });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update recipient";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    await deleteWarmUpRecipient(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete recipient";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
