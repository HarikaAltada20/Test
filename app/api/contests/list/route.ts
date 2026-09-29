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
  buildCampaignListCacheKeyAsync,
  getCampaignListCache,
  setCampaignListCache,
} from "@/lib/campaign-list-cache";
import {
  logCampaignListRequest,
  startRequestTimer,
} from "@/lib/campaign-list-observability";

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
  const elapsed = startRequestTimer();
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      logCampaignListRequest({
        route: "/api/contests/list",
        durationMs: elapsed(),
        status: 401,
        cache: "N/A",
        scope: "advertiser",
        error: "Unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userType = (user.user_metadata || {})?.user_type;
    if (userType === "creator") {
      logCampaignListRequest({
        route: "/api/contests/list",
        durationMs: elapsed(),
        status: 403,
        cache: "N/A",
        scope: "advertiser",
        error: "Forbidden",
      });
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

    const cacheKey = await buildCampaignListCacheKeyAsync({
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
      logCampaignListRequest({
        route: "/api/contests/list",
        durationMs: elapsed(),
        status: 200,
        cache: "HIT",
        scope: "advertiser",
        total: Number((cached as { total?: number }).total) || 0,
      });
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

    await setCampaignListCache(cacheKey, result, "advertiser", user.id);

    logCampaignListRequest({
      route: "/api/contests/list",
      durationMs: elapsed(),
      status: 200,
      cache: "MISS",
      scope: "advertiser",
      total: result.total,
    });

    return NextResponse.json(result, {
      headers: { "X-Campaign-List-Cache": "MISS" },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch contests";
    console.error("[/api/contests/list] Error:", err);
    const status = isCampaignListForbiddenError(err) ? 403 : 500;
    logCampaignListRequest({
      route: "/api/contests/list",
      durationMs: elapsed(),
      status,
      cache: "N/A",
      scope: "advertiser",
      error: message,
    });
    return NextResponse.json({ error: message }, { status });
  }
}
