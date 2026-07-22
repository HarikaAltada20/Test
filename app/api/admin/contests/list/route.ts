import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  listCampaignsPaginated,
  parseContestListSort,
  parseListLimit,
  parseListPage,
  type CampaignListTabId,
} from "@/lib/contest-list-query";

export const dynamic = "force-dynamic";

const TAB_IDS = new Set([
  "all",
  "draft",
  "pending_approval",
  "ready",
  "upcoming",
  "live",
  "ended",
  "rejected",
]);

export async function GET(request: NextRequest) {
  try {
    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: adminError || "Forbidden" },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const sp = request.nextUrl.searchParams;
    const tabRaw = sp.get("tab") || "all";
    const tab = (TAB_IDS.has(tabRaw) ? tabRaw : "all") as CampaignListTabId;

    const result = await listCampaignsPaginated({
      supabase,
      scope: "admin",
      tab,
      sort: parseContestListSort(sp.get("sort")),
      page: parseListPage(sp.get("page")),
      limit: parseListLimit(sp.get("limit")),
      platform: sp.get("platform") || "all",
      contestType: sp.get("contestType") || "all",
      contestFormat: sp.get("contestFormat") || "all",
      postContestPhase: sp.get("postContestPhase") || "all",
      search: sp.get("search") || "",
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch contests";
    console.error("[/api/admin/contests/list] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
