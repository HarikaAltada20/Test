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

type StatusSummaryRow = {
  status: string;
  request_count: number | string;
  cash_amount_cents: number | string;
};

function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

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

  const [{ error, data, total }, summaryRes] = await Promise.all([
    fetchWithdrawalsPage(supabase, {
      page,
      pageSize,
      tab,
      createdFrom,
      createdTo,
      sort,
      order,
    }),
    supabase.rpc("admin_withdrawal_status_summary"),
  ]);

  if (error) {
    console.error("Withdrawals list error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }

  if (summaryRes.error) {
    console.error("Withdrawals summary error:", summaryRes.error);
    return NextResponse.json(
      { error: summaryRes.error.message || "Failed to load withdrawal totals" },
      { status: 500 },
    );
  }

  const summaryRows = (summaryRes.data ?? []) as StatusSummaryRow[];
  const byStatus = new Map(
    summaryRows.map((row) => [
      row.status,
      {
        count: toNumber(row.request_count),
        cash: toNumber(row.cash_amount_cents),
      },
    ]),
  );

  const cashFor = (...statuses: string[]) =>
    statuses.reduce((sum, status) => sum + (byStatus.get(status)?.cash ?? 0), 0);
  const countFor = (...statuses: string[]) =>
    statuses.reduce(
      (sum, status) => sum + (byStatus.get(status)?.count ?? 0),
      0,
    );

  const totals = {
    all: cashFor(
      "pending",
      "in_review",
      "approved",
      "processed",
      "rejected",
      "cancelled",
      "forfeited",
      "failed",
    ),
    pending: cashFor("pending"),
    in_review: cashFor("in_review"),
    approved: cashFor("approved"),
    paid: cashFor("processed"),
    rejected: cashFor("rejected", "cancelled"),
    forfeited: cashFor("forfeited"),
    failed: cashFor("failed"),
  };

  const statusCounts = {
    all: countFor(
      "pending",
      "in_review",
      "approved",
      "processed",
      "rejected",
      "cancelled",
      "forfeited",
      "failed",
    ),
    pending: countFor("pending"),
    in_review: countFor("in_review"),
    approved: countFor("approved"),
    paid: countFor("processed"),
    rejected: countFor("rejected", "cancelled"),
    forfeited: countFor("forfeited"),
    failed: countFor("failed"),
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
