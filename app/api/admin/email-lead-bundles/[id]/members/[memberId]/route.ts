import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  deleteBundleMember,
  updateBundleMember,
} from "@/lib/admin-email/lead-bundles";

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id: bundleId, memberId } = await context.params;

  let body: {
    email?: string;
    fullName?: string | null;
    username?: string | null;
    userType?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const member = await updateBundleMember(bundleId, memberId, body);
    return NextResponse.json({ member });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update lead";
    const status = message === "Lead not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id: bundleId, memberId } = await context.params;

  try {
    const result = await deleteBundleMember(bundleId, memberId);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete lead";
    const status = message === "Lead not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
