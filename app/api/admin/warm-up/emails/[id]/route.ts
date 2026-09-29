import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  getWarmUpAccount,
  updateWarmUpAccount,
  deleteWarmUpAccount,
} from "@/lib/admin-email/warm-up";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    const account = await getWarmUpAccount(id);
    return NextResponse.json({ account });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Account not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  let body: {
    firstName?: string | null;
    lastName?: string | null;
    campaignDailyLimit?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const account = await updateWarmUpAccount(id, body);
    return NextResponse.json({ account });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  try {
    await deleteWarmUpAccount(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
