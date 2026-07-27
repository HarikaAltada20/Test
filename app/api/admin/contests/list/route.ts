import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
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
    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin) {
      logCampaignListRequest({
        route: "/api/admin/contests/list",
        durationMs: elapsed(),
        status: 403,
        cache: "N/A",
        scope: "admin",
        error: adminError || "Forbidden",
      });
      return NextResponse.json(
        { error: adminError || "Forbidden" },
        { status: 403 },
      );
    }

    const supabase = await createClient();
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
      scope: "admin",
      ownerId: "shared",
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
        route: "/api/admin/contests/list",
        durationMs: elapsed(),
        status: 200,
        cache: "HIT",
        scope: "admin",
        total: Number((cached as { total?: number }).total) || 0,
      });
      return NextResponse.json(cached, {
        headers: { "X-Campaign-List-Cache": "HIT" },
      });
    }

    const result = await listCampaignsPaginated({
      supabase,
      scope: "admin",
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

    await setCampaignListCache(cacheKey, result, "admin", "shared");

    logCampaignListRequest({
      route: "/api/admin/contests/list",
      durationMs: elapsed(),
      status: 200,
      cache: "MISS",
      scope: "admin",
      total: result.total,
    });

    return NextResponse.json(result, {
      headers: { "X-Campaign-List-Cache": "MISS" },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch contests";
    console.error("[/api/admin/contests/list] Error:", err);
    const status = isCampaignListForbiddenError(err) ? 403 : 500;
    logCampaignListRequest({
      route: "/api/admin/contests/list",
      durationMs: elapsed(),
      status,
      cache: "N/A",
      scope: "admin",
      error: message,
    });
    return NextResponse.json({ error: message }, { status });
  }
}
