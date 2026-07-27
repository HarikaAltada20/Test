import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  isCampaignListForbiddenError,
  listCampaignsPaginated,
  parseListLimit,
  parseListPage,
  parseOpportunitiesMediaType,
  parseOpportunitiesSort,
  type OpportunitiesStatusTab,
} from "@/lib/contest-list-query";
import { getCreatorUserCountries } from "@/lib/opportunities-user-countries";
import { getCreatorRequirementsSnapshot } from "@/lib/creator-requirements";
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

const STATUS_TABS = new Set(["all", "live", "upcoming", "ended"]);

export async function GET(request: NextRequest) {
  const elapsed = startRequestTimer();
  let eligibleOnly = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      logCampaignListRequest({
        route: "/api/opportunities/list",
        durationMs: elapsed(),
        status: 401,
        cache: "N/A",
        scope: "opportunities",
        error: "Unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const tabRaw = sp.get("tab") || "all";
    const tab = (
      STATUS_TABS.has(tabRaw) ? tabRaw : "all"
    ) as OpportunitiesStatusTab;

    // Always resolve countries from the authenticated user — never trust
    // client-supplied ?countries=. Empty profile countries only unlock
    // unrestricted campaigns (contest_matches_user_countries).
    const userCountries = await getCreatorUserCountries(supabase, user.id);

    eligibleOnly =
      sp.get("eligibleOnly") === "1" || sp.get("eligibleOnly") === "true";

    let creatorEligibilitySnapshot;
    if (eligibleOnly) {
      creatorEligibilitySnapshot = await getCreatorRequirementsSnapshot(
        supabase,
        user.id,
      );
    }

    const sort = parseOpportunitiesSort(sp.get("sort"));
    const page = parseListPage(sp.get("page"));
    const limit = parseListLimit(sp.get("limit"));
    const platform = sp.get("platform") || "all";
    const contestType = sp.get("contestType") || "all";
    const contestFormat = sp.get("contestFormat") || "all";
    const search = sp.get("search") || "";
    const mediaType = parseOpportunitiesMediaType(sp.get("mediaType"));
    const countriesKey = [...(userCountries || [])].sort().join(",");

    // Skip Redis for eligibleOnly — results are user-gate specific and heavier.
    const cacheKey = eligibleOnly
      ? null
      : await buildCampaignListCacheKeyAsync({
          scope: "opportunities",
          ownerId: user.id,
          tab,
          sort,
          page,
          limit,
          platform,
          contestType,
          contestFormat,
          search,
          mediaType,
          eligibleOnly: false,
          countriesKey,
        });

    if (cacheKey) {
      const cached = await getCampaignListCache(cacheKey);
      if (cached) {
        logCampaignListRequest({
          route: "/api/opportunities/list",
          durationMs: elapsed(),
          status: 200,
          cache: "HIT",
          scope: "opportunities",
          eligibleOnly: false,
          total: Number((cached as { total?: number }).total) || 0,
        });
        return NextResponse.json(cached, {
          headers: { "X-Campaign-List-Cache": "HIT" },
        });
      }
    }

    const result = await listCampaignsPaginated({
      supabase,
      scope: "opportunities",
      tab,
      sort,
      page,
      limit,
      platform,
      contestType,
      contestFormat,
      search,
      mediaType,
      userCountries,
      eligibleOnly,
      creatorEligibilitySnapshot,
    });

    if (cacheKey) {
      await setCampaignListCache(
        cacheKey,
        result,
        "opportunities",
        user.id,
      );
    }

    const cacheHeader = cacheKey ? "MISS" : "BYPASS";
    logCampaignListRequest({
      route: "/api/opportunities/list",
      durationMs: elapsed(),
      status: 200,
      cache: cacheHeader,
      scope: "opportunities",
      eligibleOnly,
      total: result.total,
    });

    return NextResponse.json(result, {
      headers: {
        "X-Campaign-List-Cache": cacheHeader,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch opportunities";
    console.error("[/api/opportunities/list] Error:", err);
    const status = isCampaignListForbiddenError(err) ? 403 : 500;
    logCampaignListRequest({
      route: "/api/opportunities/list",
      durationMs: elapsed(),
      status,
      cache: "N/A",
      scope: "opportunities",
      eligibleOnly,
      error: message,
    });
    return NextResponse.json({ error: message }, { status });
  }
}
