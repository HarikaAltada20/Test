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
  buildCampaignListCacheKey,
  getCampaignListCache,
  setCampaignListCache,
} from "@/lib/campaign-list-cache";

export const dynamic = "force-dynamic";

const STATUS_TABS = new Set(["all", "live", "upcoming", "ended"]);

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

    const sp = request.nextUrl.searchParams;
    const tabRaw = sp.get("tab") || "all";
    const tab = (
      STATUS_TABS.has(tabRaw) ? tabRaw : "all"
    ) as OpportunitiesStatusTab;

    // Always resolve countries from the authenticated user — never trust
    // client-supplied ?countries=. Empty profile countries only unlock
    // unrestricted campaigns (contest_matches_user_countries).
    const userCountries = await getCreatorUserCountries(supabase, user.id);

    const eligibleOnly =
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
    const cacheKey =
      eligibleOnly
        ? null
        : buildCampaignListCacheKey({
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
      await setCampaignListCache(cacheKey, result, "opportunities");
    }

    return NextResponse.json(result, {
      headers: {
        "X-Campaign-List-Cache": cacheKey ? "MISS" : "BYPASS",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch opportunities";
    console.error("[/api/opportunities/list] Error:", err);
    const status = isCampaignListForbiddenError(err) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
