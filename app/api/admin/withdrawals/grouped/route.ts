import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  fetchWithdrawalPayeeGroupsPage,
  fetchWithdrawalPayoutSeries,
  fetchWithdrawalStatusSummary,
  parsePayoutMethod,
  parseWithdrawalsTab,
} from "@/lib/admin-withdrawals-list";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? String(PAGE_SIZE), 10)),
  );
  const filters = {
    tab: parseWithdrawalsTab(searchParams.get("tab")),
    method: parsePayoutMethod(searchParams.get("method")),
    createdFrom: searchParams.get("createdFrom") || undefined,
    createdTo: searchParams.get("createdTo") || undefined,
  };

  const includePayoutSeries = ["1", "true"].includes(
    (searchParams.get("includePayoutSeries") ?? "0").toLowerCase(),
  );

  const supabase = createAdminClient();
  const [groupsRes, summaryRes, seriesRes] = await Promise.all([
    fetchWithdrawalPayeeGroupsPage(supabase, filters, page, pageSize),
    fetchWithdrawalStatusSummary(supabase, filters.method),
    includePayoutSeries
      ? fetchWithdrawalPayoutSeries(supabase, {
          processedFrom: filters.createdFrom,
          processedTo: filters.createdTo,
        })
      : Promise.resolve(null),
  ]);

  if (groupsRes.error) {
    return NextResponse.json(
      { error: groupsRes.error },
      { status: groupsRes.status ?? 500 },
    );
  }
  if (summaryRes.error) {
    return NextResponse.json({ error: summaryRes.error }, { status: 500 });
  }

  return NextResponse.json({
    groups: groupsRes.groups,
    totalGroups: groupsRes.totalGroups,
    totalRequests: groupsRes.totalRequests,
    page,
    pageSize,
    totals: summaryRes.totals,
    statusCounts: summaryRes.statusCounts,
    payoutSeriesIncluded: seriesRes !== null,
    payoutSeries: seriesRes ? (seriesRes.error ? [] : seriesRes.data) : null,
    payoutSeriesGranularity: seriesRes
      ? seriesRes.error
        ? "day"
        : seriesRes.granularity
      : null,
  });
}
