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
    const sort = parseContestListSort(sp.get("sort"));
    const page = parseListPage(sp.get("page"));
    const limit = parseListLimit(sp.get("limit"));
    const platform = sp.get("platform") || "all";
    const contestType = sp.get("contestType") || "all";
    const contestFormat = sp.get("contestFormat") || "all";
    const postContestPhase = sp.get("postContestPhase") || "all";
    const search = sp.get("search") || "";

    const cacheKey = buildCampaignListCacheKey({
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

    await setCampaignListCache(cacheKey, result, "admin");

    return NextResponse.json(result, {
      headers: { "X-Campaign-List-Cache": "MISS" },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch contests";
    console.error("[/api/admin/contests/list] Error:", err);
    const status = isCampaignListForbiddenError(err) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
