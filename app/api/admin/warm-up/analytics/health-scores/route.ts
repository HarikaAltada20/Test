import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import { getHealthScoresList } from "@/lib/admin-email/warm-up-service";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const projectId = req.nextUrl.searchParams.get("project_id") ?? undefined;

  try {
    const scores = await getHealthScoresList(projectId ?? undefined);
    return NextResponse.json({ scores });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load health scores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
