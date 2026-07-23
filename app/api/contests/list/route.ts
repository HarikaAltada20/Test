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
import {
  buildCampaignListCacheKey,
  getCampaignListCache,
  setCampaignListCache,
} from "@/lib/campaign-list-cache";

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
    const sort = parseContestListSort(sp.get("sort"));
    const page = parseListPage(sp.get("page"));
    const limit = parseListLimit(sp.get("limit"));
    const platform = sp.get("platform") || "all";
    const contestType = sp.get("contestType") || "all";
    const contestFormat = sp.get("contestFormat") || "all";
    const postContestPhase = sp.get("postContestPhase") || "all";
    const search = sp.get("search") || "";

    const cacheKey = buildCampaignListCacheKey({
      scope: "advertiser",
      ownerId: user.id,
      tab,
      sort,
      page,
      limit,
      platform,
      contestType,
      contestFormat,
      postContestPhase,
      search,
    });

    const cached = await getCampaignListCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "X-Campaign-List-Cache": "HIT" },
      });
    }

    const result = await listCampaignsPaginated({
      supabase,
      scope: "advertiser",
      advertiserId: user.id,
      tab,
      sort,
      page,
      limit,
      platform,
      contestType,
      contestFormat,
      postContestPhase,
      search,
    });

    await setCampaignListCache(cacheKey, result, "advertiser");

    return NextResponse.json(result, {
      headers: { "X-Campaign-List-Cache": "MISS" },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch contests";
    console.error("[/api/contests/list] Error:", err);
    const status = isCampaignListForbiddenError(err) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
