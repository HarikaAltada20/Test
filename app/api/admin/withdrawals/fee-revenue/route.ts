import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

export type FeeRevenueRow = {
  method: string;
  payerType: "creator" | "brand";
  paidCount: number;
  paidGrossCents: number;
  paidFeeCents: number;
  expectedCount: number;
  expectedFeeCents: number;
};

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** GET ?from=ISO&to=ISO — processing fees earned (paid) and expected (open), by method and payer. */
export async function GET(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("admin_withdrawal_fee_revenue", {
    p_from: parseDate(sp.get("from")),
    p_to: parseDate(sp.get("to")),
  });

  if (error) {
    console.error("admin fee-revenue error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: FeeRevenueRow[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    method: String(r.method ?? "unknown"),
    payerType: r.payer_type === "brand" ? "brand" : "creator",
    paidCount: Number(r.paid_count ?? 0),
    paidGrossCents: Number(r.paid_gross_cents ?? 0),
    paidFeeCents: Number(r.paid_fee_cents ?? 0),
    expectedCount: Number(r.expected_count ?? 0),
    expectedFeeCents: Number(r.expected_fee_cents ?? 0),
  }));

  return NextResponse.json({ rows });
}
