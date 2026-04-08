import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  fetchWithdrawalsPage,
  parseOrder,
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
  const sort = parseSortKey(searchParams.get("sort"));
  const order = parseOrder(searchParams.get("order"));
  const createdFrom = searchParams.get("createdFrom") || undefined;
  const createdTo = searchParams.get("createdTo") || undefined;

  const supabase = createAdminClient();

  const { error, data, total } = await fetchWithdrawalsPage(supabase, {
    page,
    pageSize,
    tab,
    createdFrom,
    createdTo,
    sort,
    order,
  });

  if (error) {
    console.error("Withdrawals list error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }

  // Totals by status – full table (unchanged semantics: all-time, no date filter)
  const { data: allRows } = await supabase
    .from("withdrawal_requests")
    .select("amount, amount_type, status");

  const sumCash = (statuses: string[]) =>
    (allRows ?? []).reduce(
      (s, r) =>
        s +
        (r.amount_type === "cash" && statuses.includes(r.status)
          ? Number(r.amount)
          : 0),
      0,
    );

  const totals = {
    all: (allRows ?? []).reduce(
      (s, r) => s + (r.amount_type === "cash" ? Number(r.amount) : 0),
      0,
    ),
    pending: sumCash(["pending", "in_review"]),
    approved: sumCash(["approved"]),
    paid: sumCash(["processed"]),
    rejected: sumCash(["rejected", "cancelled"]),
    forfeited: sumCash(["forfeited"]),
    failed: sumCash(["failed"]),
  };

  const rows = allRows ?? [];
  const statusCounts = {
    all: rows.length,
    pending: rows.filter((r) => ["pending", "in_review"].includes(r.status))
      .length,
    approved: rows.filter((r) => r.status === "approved").length,
    paid: rows.filter((r) => r.status === "processed").length,
    rejected: rows.filter(
      (r) => r.status === "rejected" || r.status === "cancelled",
    ).length,
    forfeited: rows.filter((r) => r.status === "forfeited").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };

  return NextResponse.json({
    data: data ?? [],
    total: total ?? 0,
    page,
    pageSize,
    totals,
    statusCounts,
  });
}
