import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  isCampaignListForbiddenError,
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
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userType = (user.user_metadata || {})?.user_type;
    if (userType === "creator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const tabRaw = sp.get("tab") || "all";
    const tab = (TAB_IDS.has(tabRaw) ? tabRaw : "all") as CampaignListTabId;

    const result = await listCampaignsPaginated({
      supabase,
      scope: "advertiser",
      advertiserId: user.id,
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
    console.error("[/api/contests/list] Error:", err);
    const status = isCampaignListForbiddenError(err) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
