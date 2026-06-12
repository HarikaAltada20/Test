import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  deleteSequenceStep,
  updateSequenceStep,
} from "@/lib/admin-email/sequence-store";

type RouteContext = { params: Promise<{ id: string; stepId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id, stepId } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const step = await updateSequenceStep(id, stepId, {
      step_number: body.step_number as number | undefined,
      subject: body.subject as string | undefined,
      body: body.body as string | undefined,
      delay_days: body.delay_days as number | undefined,
    });
    return NextResponse.json({ step });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update step";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id, stepId } = await context.params;
  try {
    await deleteSequenceStep(id, stepId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete step";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
