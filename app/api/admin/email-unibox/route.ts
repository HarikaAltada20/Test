import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  getUniboxUnreadCount,
  listUniboxThreads,
  type UniboxFolder,
  type UniboxReadFilter,
} from "@/lib/admin-email/unibox";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;

  if (sp.get("unreadCount") === "1") {
    try {
      const count = await getUniboxUnreadCount();
      return NextResponse.json({ unreadCount: count });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load unread count";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const folder = (sp.get("folder") ?? "all") as UniboxFolder;
  const readFilter = (sp.get("status") ?? "all") as UniboxReadFilter;
  const campaignId = sp.get("campaignId");
  const search = sp.get("search");
  const limit = Math.min(parseInt(sp.get("limit") ?? "50", 10) || 50, 100);
  const offset = parseInt(sp.get("offset") ?? "0", 10) || 0;

  try {
    const result = await listUniboxThreads({
      folder,
      readFilter,
      campaignId,
      search,
      limit,
      offset,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load unibox";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
