import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  getUniboxUnreadCount,
  listUniboxThreads,
  type UniboxFolder,
  type UniboxReadFilter,
} from "@/lib/admin-email/unibox";
import { syncRecentInboundEmails } from "@/lib/email/inbound-s3";

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const folder = (sp.get("folder") ?? "all") as UniboxFolder;
  const readFilter = (sp.get("status") ?? "all") as UniboxReadFilter;
  const campaignId = sp.get("campaignId");
  const search = sp.get("search");
  const limit = Math.min(parseInt(sp.get("limit") ?? "50", 10) || 50, 100);
  const offset = parseInt(sp.get("offset") ?? "0", 10) || 0;
  const shouldSync = sp.get("sync") === "1";
  const includeUnread = sp.get("includeUnread") === "1";

  try {
    const sync = shouldSync
      ? await syncRecentInboundEmails()
      : { processed: 0, skipped: 0, errors: 0, scanned: 0 };

    const threadsPromise = listUniboxThreads({
      folder,
      readFilter,
      campaignId,
      search,
      limit,
      offset,
    });
    const unreadPromise = includeUnread
      ? getUniboxUnreadCount()
      : Promise.resolve(null);

    const [threadsResult, unreadCount] = await Promise.all([
      threadsPromise,
      unreadPromise,
    ]);

    return NextResponse.json({
      ok: true,
      processed: sync.processed,
      scanned: sync.scanned,
      threads: threadsResult.threads,
      total: threadsResult.total,
      ...(unreadCount !== null ? { unreadCount } : {}),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to poll inbound emails";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
