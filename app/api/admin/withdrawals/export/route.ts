import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  applyWithdrawalsTabFilter,
  mapWithdrawalListRow,
  parseOrder,
  parseSortKey,
  parseWithdrawalsTab,
  type WithdrawalsSortKey,
} from "@/lib/admin-withdrawals-list";
import { WITHDRAWAL_EXPORT_COLUMN_IDS } from "@/lib/withdrawal-export-columns";

const MAX_EXPORT = 50_000;

type WithdrawalExportRow = Record<string, unknown> & {
  id?: string | number | null;
  created_at?: string | null;
  processed_at?: string | null;
  status?: string | null;
  amount?: number | string | null;
  amount_type?: string | null;
  currency?: string | null;
  transaction_reference?: string | null;
  admin_notes?: string | null;
  user_notes?: string | null;
  payment_proof_link?: string | null;
  payment_proof_storage_path?: string | null;
  users?: {
    full_name?: string | null;
    email?: string | null;
    username?: string | null;
  } | null;
};

const SORT_COLUMN: Record<WithdrawalsSortKey, string> = {
  created_at: "created_at",
  amount: "amount",
  user_full_name: "user_full_name",
  username: "user_username",
  email: "user_email",
};

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function payoutExtras(r: Record<string, unknown>) {
  const type = String(r.payout_method_type_snapshot || "").toLowerCase();
  const d = (r.payout_method_details_snapshot || {}) as Record<
    string,
    unknown
  >;
  const accountNumber = d.account_number
    ? String(d.account_number)
    : "";
  return {
    payout_method_type: type,
    upi_id: String(d.upi_id || ""),
    account_holder_name: String(d.account_holder_name || ""),
    wallet_address: String(d.wallet_address || ""),
    bank_account_last4: accountNumber
      ? accountNumber.slice(-4)
      : "",
    ifsc_or_swift: String(
      (d.ifsc_code || d.swift_bic_code || "") as string,
    ),
    bank_name: String(d.bank_name || ""),
    payout_details_json: JSON.stringify(d),
  };
}

function rowToExport(
  r: Record<string, unknown>,
  columns: Set<string>,
): string[] {
  const m = mapWithdrawalListRow(r) as WithdrawalExportRow;
  const users = m.users as {
    full_name?: string | null;
    email?: string | null;
    username?: string | null;
  } | null;
  const pe = payoutExtras(m as Record<string, unknown>);
  const values: Record<string, string> = {
    id: String(m.id ?? ""),
    created_at: m.created_at ? String(m.created_at) : "",
    processed_at: m.processed_at ? String(m.processed_at) : "",
    status: String(m.status ?? ""),
    amount: String(m.amount ?? ""),
    amount_type: String(m.amount_type ?? ""),
    currency: String(m.currency ?? ""),
    full_name: users?.full_name ?? "",
    username: users?.username ?? "",
    email: users?.email ?? "",
    payout_method_type: pe.payout_method_type,
    upi_id: pe.upi_id,
    account_holder_name: pe.account_holder_name,
    wallet_address: pe.wallet_address,
    bank_account_last4: pe.bank_account_last4,
    ifsc_or_swift: pe.ifsc_or_swift,
    bank_name: pe.bank_name,
    transaction_reference: String(m.transaction_reference ?? ""),
    admin_notes: String(m.admin_notes ?? ""),
    user_notes: String(m.user_notes ?? ""),
    payment_proof_link: String(
      (m as { payment_proof_link?: string }).payment_proof_link ?? "",
    ),
    payment_proof_storage_path: String(
      (m as { payment_proof_storage_path?: string })
        .payment_proof_storage_path ?? "",
    ),
    payout_details_json: pe.payout_details_json,
  };

  return [...columns].map((c) => csvCell(values[c] ?? ""));
}

export async function GET(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tab = parseWithdrawalsTab(searchParams.get("tab"));
  const sort = parseSortKey(searchParams.get("sort"));
  const order = parseOrder(searchParams.get("order"));
  const createdFrom = searchParams.get("createdFrom") || undefined;
  const createdTo = searchParams.get("createdTo") || undefined;

  const rawCols = searchParams.get("columns");
  const requested = rawCols
    ? rawCols.split(",").map((c) => c.trim()).filter(Boolean)
    : [...WITHDRAWAL_EXPORT_COLUMN_IDS];

  const allowed = new Set<string>(WITHDRAWAL_EXPORT_COLUMN_IDS);
  const columns = new Set<string>();
  for (const c of requested) {
    if (allowed.has(c)) columns.add(c);
  }
  if (columns.size === 0) {
    WITHDRAWAL_EXPORT_COLUMN_IDS.forEach((c) => columns.add(c));
  }

  const supabase = createAdminClient();

  let countQ = supabase
    .from("admin_withdrawal_requests_list")
    .select("*", { count: "exact", head: true });
  countQ = applyWithdrawalsTabFilter(countQ, tab);
  if (createdFrom) countQ = countQ.gte("created_at", createdFrom);
  if (createdTo) countQ = countQ.lte("created_at", createdTo);
  const { count: totalMatch, error: countErr } = await countQ;

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }
  if ((totalMatch ?? 0) > MAX_EXPORT) {
    return NextResponse.json(
      {
        error: `Too many rows (${totalMatch}). Narrow the date range or status filter (max ${MAX_EXPORT}).`,
      },
      { status: 400 },
    );
  }

  const ascending = order === "asc";
  const col = SORT_COLUMN[sort];

  let dataQ = supabase.from("admin_withdrawal_requests_list").select("*");
  dataQ = applyWithdrawalsTabFilter(dataQ, tab);
  if (createdFrom) dataQ = dataQ.gte("created_at", createdFrom);
  if (createdTo) dataQ = dataQ.lte("created_at", createdTo);
  dataQ = dataQ.order(col, { ascending });
  dataQ = dataQ.order("id", { ascending: true });
  dataQ = dataQ.limit(MAX_EXPORT);

  const { data: rows, error: dataErr } = await dataQ;

  if (dataErr) {
    return NextResponse.json({ error: dataErr.message }, { status: 500 });
  }

  const header = [...columns].map(csvCell).join(",");
  const lines = (rows || []).map((row) =>
    rowToExport(row as Record<string, unknown>, columns),
  );
  const body = [header, ...lines.map((cells) => cells.join(","))].join("\r\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="withdrawals-export.csv"`,
    },
  });
}
