import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { addSequenceVariant } from "@/lib/admin-email/sequence-store";

type RouteContext = { params: Promise<{ id: string; stepId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id, stepId } = await context.params;
  let body: {
    variant_name?: string;
    subject?: string;
    body?: string;
    variant_letter?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await addSequenceVariant(id, stepId, {
      variant_name: body.variant_name ?? "Variant",
      subject: body.subject ?? "",
      body: body.body ?? "",
      variant_letter: body.variant_letter ?? "A",
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add variant";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
