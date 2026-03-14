import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") ?? String(PAGE_SIZE), 10)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = createAdminClient();

  // Paginated list with user info and total count
  const { data: list, error: listError, count: total } = await supabase
    .from("withdrawal_requests")
    .select("*, users(full_name, email, username)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (listError) {
    console.error("Withdrawals list error:", listError);
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  // Totals by status (sum of cash amount per status) – fetch minimal fields
  const { data: allRows } = await supabase
    .from("withdrawal_requests")
    .select("amount, amount_type, status");

  const sumCash = (statuses: string[]) =>
    (allRows ?? []).reduce(
      (s, r) => s + (r.amount_type === "cash" && statuses.includes(r.status) ? Number(r.amount) : 0),
      0
    );

  const totals = {
    all: (allRows ?? []).reduce((s, r) => s + (r.amount_type === "cash" ? Number(r.amount) : 0), 0),
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
    pending: rows.filter((r) => ["pending", "in_review"].includes(r.status)).length,
    approved: rows.filter((r) => r.status === "approved").length,
    paid: rows.filter((r) => r.status === "processed").length,
    rejected: rows.filter((r) => r.status === "rejected" || r.status === "cancelled").length,
    forfeited: rows.filter((r) => r.status === "forfeited").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };

  return NextResponse.json({
    data: list ?? [],
    total: total ?? 0,
    page,
    pageSize,
    totals,
    statusCounts,
  });
}
