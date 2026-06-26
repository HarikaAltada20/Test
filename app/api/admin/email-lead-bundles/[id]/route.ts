import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  deleteLeadBundle,
  getLeadBundle,
  listBundleMemberIds,
  listBundleMembers,
} from "@/lib/admin-email/lead-bundles";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const sp = _req.nextUrl.searchParams;

  try {
    if (sp.get("members") === "1") {
      const result = await listBundleMembers(id, {
        page: Number(sp.get("page") ?? 1),
        limit: Number(sp.get("limit") ?? 50),
        search: sp.get("search") ?? undefined,
      });
      return NextResponse.json(result);
    }

    if (sp.get("memberIds") === "1") {
      const ids = await listBundleMemberIds(id);
      return NextResponse.json({ ids, total: ids.length });
    }

    const bundle = await getLeadBundle(id);
    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }
    return NextResponse.json({ bundle });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load bundle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  try {
    await deleteLeadBundle(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete bundle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
