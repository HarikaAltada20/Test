import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  listCampaignsPaginated,
  parseListLimit,
  parseListPage,
  parseOpportunitiesSort,
  type OpportunitiesStatusTab,
} from "@/lib/contest-list-query";
import { getCreatorUserCountries } from "@/lib/opportunities-user-countries";

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
    // client-supplied ?countries= (geo spoof / empty bypass).
    const userCountries = await getCreatorUserCountries(supabase, user.id);

    const result = await listCampaignsPaginated({
      supabase,
      scope: "opportunities",
      tab,
      sort: parseOpportunitiesSort(sp.get("sort")),
      page: parseListPage(sp.get("page")),
      limit: parseListLimit(sp.get("limit")),
      platform: sp.get("platform") || "all",
      contestType: sp.get("contestType") || "all",
      contestFormat: sp.get("contestFormat") || "all",
      search: sp.get("search") || "",
      mediaType: (sp.get("mediaType") as "all" | "text" | "media") || "all",
      userCountries,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch opportunities";
    console.error("[/api/opportunities/list] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
