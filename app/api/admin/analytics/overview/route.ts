import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  ADMIN_ANALYTICS_CACHE_SECONDS,
  getCachedAdminAnalyticsOverview,
  parseContestTypesParam,
  parseIdListParam,
  parsePlatformsParam,
  parseStatusesParam,
} from "@/lib/admin-analytics-cache";

export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const platforms = parsePlatformsParam(searchParams.get("platforms"));
    const contestTypes = parseContestTypesParam(searchParams.get("types"));
    const statuses = parseStatusesParam(searchParams.get("statuses"));
    const contestIds = parseIdListParam(searchParams.get("contestIds"));
    const advertiserIds = parseIdListParam(searchParams.get("advertiserIds"));

    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);

    const from = fromParam ? new Date(fromParam) : defaultFrom;
    const to = toParam ? new Date(toParam) : now;

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Invalid date range" },
        { status: 400 },
      );
    }
    if (from.getTime() > to.getTime()) {
      return NextResponse.json(
        { error: "Invalid date range: from must be before to" },
        { status: 400 },
      );
    }

    const result = await getCachedAdminAnalyticsOverview({
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      platforms,
      contestTypes,
      statuses,
      contestIds,
      advertiserIds,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": `private, max-age=0, s-maxage=${ADMIN_ANALYTICS_CACHE_SECONDS}, stale-while-revalidate=60`,
        "X-Admin-Analytics-Cache-TTL": String(ADMIN_ANALYTICS_CACHE_SECONDS),
      },
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load analytics",
      },
      { status: 500 },
    );
  }
}
