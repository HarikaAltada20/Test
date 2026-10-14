import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  fetchWithdrawalPayoutSeries,
  fetchWithdrawalStatusSummary,
  fetchWithdrawalsPage,
  parseOrder,
  parsePayoutMethod,
  parseSortKey,
  parseWithdrawalsTab,
} from "@/lib/admin-withdrawals-list";

const PAGE_SIZE = 20;

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
  const tab = parseWithdrawalsTab(searchParams.get("tab"));
  const method = parsePayoutMethod(searchParams.get("method"));
  const sort = parseSortKey(searchParams.get("sort"));
  const order = parseOrder(searchParams.get("order"));
  const createdFrom = searchParams.get("createdFrom") || undefined;
  const createdTo = searchParams.get("createdTo") || undefined;
  const includePayoutSeriesParam = (
    searchParams.get("includePayoutSeries") ?? "1"
  ).toLowerCase();
  const includePayoutSeries =
    includePayoutSeriesParam !== "0" && includePayoutSeriesParam !== "false";

  const supabase = createAdminClient();

  const [pageRes, summaryRes, payoutSeriesRes] = await Promise.all([
    fetchWithdrawalsPage(supabase, {
      page,
      pageSize,
      tab,
      method,
      createdFrom,
      createdTo,
      sort,
      order,
    }),
    fetchWithdrawalStatusSummary(supabase, method),
    includePayoutSeries
      ? // Chart uses processed_at; reuse the page date range as the paid window.
        fetchWithdrawalPayoutSeries(supabase, {
          processedFrom: createdFrom,
          processedTo: createdTo,
        })
      : Promise.resolve({
          error: null as string | null,
          data: [] as Awaited<
            ReturnType<typeof fetchWithdrawalPayoutSeries>
          >["data"],
          granularity: "day" as const,
          skipped: true as const,
        }),
  ]);

  const { error, data, total } = pageRes;

  if (error) {
    console.error("Withdrawals list error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }

  if (summaryRes.error) {
    console.error("Withdrawals summary error:", summaryRes.error);
    return NextResponse.json({ error: summaryRes.error }, { status: 500 });
  }

  // Chart is best-effort: never block the withdrawals list if series fails.
  const seriesSkipped =
    "skipped" in payoutSeriesRes && payoutSeriesRes.skipped === true;
  let payoutSeries = seriesSkipped ? undefined : payoutSeriesRes.data ?? [];
  let payoutSeriesGranularity = seriesSkipped
    ? undefined
    : payoutSeriesRes.granularity ?? "day";
  if (!seriesSkipped && payoutSeriesRes.error) {
    console.error("Withdrawals payout series error:", payoutSeriesRes.error);
    payoutSeries = [];
    payoutSeriesGranularity = "day";
  }

  return NextResponse.json({
    data: data ?? [],
    total: total ?? 0,
    page,
    pageSize,
    totals: summaryRes.totals,
    statusCounts: summaryRes.statusCounts,
    payoutSeriesIncluded: !seriesSkipped,
    payoutSeries: seriesSkipped ? null : payoutSeries,
    payoutSeriesGranularity: seriesSkipped ? null : payoutSeriesGranularity,
  });
}
