import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  deleteSequenceVariant,
  updateSequenceVariant,
} from "@/lib/admin-email/sequence-store";

type RouteContext = { params: Promise<{ id: string; variantId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id, variantId } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const variant = await updateSequenceVariant(id, variantId, {
      variant_name: body.variant_name as string | undefined,
      subject: body.subject as string | undefined,
      body: body.body as string | undefined,
      is_active: body.is_active as boolean | undefined,
    });
    return NextResponse.json({ variant });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update variant";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id, variantId } = await context.params;
  try {
    await deleteSequenceVariant(id, variantId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete variant";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
