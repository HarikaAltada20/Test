import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  fetchAllFilteredWithdrawals,
  groupWithdrawalsByPayee,
  parseOrder,
  parsePayoutMethod,
  parseSortKey,
  parseWithdrawalsTab,
  payoutDestination,
  type WithdrawalPayeeGroup,
  type WithdrawalsFilters,
  type WithdrawalsSortKey,
} from "@/lib/admin-withdrawals-list";
import {
  WITHDRAWAL_EXPORT_COLUMN_IDS,
  WITHDRAWAL_EXPORT_COLUMN_LABELS,
  type WithdrawalExportColumnId,
  type WithdrawalExportColumnSpec,
} from "@/lib/withdrawal-export-columns";

type ExportCurrency = { code: string; rate: number };

type ExportOptions = {
  filters: WithdrawalsFilters;
  sort: WithdrawalsSortKey;
  order: "asc" | "desc";
  columns: WithdrawalExportColumnSpec[];
  currency: ExportCurrency;
  groupByPayee: boolean;
};

const DEFAULT_CURRENCY: ExportCurrency = { code: "USD", rate: 1 };

/** Plain decimal numbers (e.g. "-12.50") are safe and must stay numeric for Skydo/Excel. */
const SAFE_NUMBER = /^-?\d+(\.\d+)?$/;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Spreadsheet apps execute cells starting with these characters as formulas.
  if (/^[=+\-@\t\r]/.test(s) && !SAFE_NUMBER.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function convertCents(cents: number, rate: number): string {
  return (Math.round(cents * rate) / 100).toFixed(2);
}

function describe(usernames: string[]): string {
  return usernames.length > 0
    ? `GoViral payout: ${usernames.map((u) => `@${u}`).join(", ")}`
    : "GoViral payout";
}

function rowValues(
  m: Record<string, unknown>,
  currency: ExportCurrency,
): Record<WithdrawalExportColumnId, string> {
  const users = m.users as {
    full_name?: string | null;
    email?: string | null;
    username?: string | null;
  } | null;
  const type = String(m.payout_method_type_snapshot || "").toLowerCase();
  const d = (m.payout_method_details_snapshot || {}) as Record<string, unknown>;
  const accountNumber = d.account_number ? String(d.account_number) : "";
  const isCash = String(m.amount_type || "cash") === "cash";
  const cents = Number(m.amount ?? 0);
  const username = users?.username ?? "";

  return {
    payee_email: payoutDestination(m).destination,
    payout_currency: isCash ? currency.code : "",
    payout_amount:
      isCash && Number.isFinite(cents) ? convertCents(cents, currency.rate) : "",
    description: describe(username ? [username] : []),
    request_count: "1",
    usernames: username,
    id: String(m.id ?? ""),
    created_at: m.created_at ? String(m.created_at) : "",
    processed_at: m.processed_at ? String(m.processed_at) : "",
    status: String(m.status ?? ""),
    amount: String(m.amount ?? ""),
    amount_type: String(m.amount_type ?? ""),
    currency: String(m.currency ?? ""),
    full_name: users?.full_name ?? "",
    username,
    email: users?.email ?? "",
    payout_method_type: type,
    upi_id: String(d.upi_id || ""),
    account_holder_name: String(d.account_holder_name || ""),
    wallet_address: String(d.wallet_address || ""),
    bank_account_last4: accountNumber ? accountNumber.slice(-4) : "",
    ifsc_or_swift: String(d.ifsc_code || d.swift_bic_code || ""),
    bank_name: String(d.bank_name || ""),
    skydo_email: type === "skydo" ? String(d.email || "") : "",
    transaction_reference: String(m.transaction_reference ?? ""),
    admin_notes: String(m.admin_notes ?? ""),
    user_notes: String(m.user_notes ?? ""),
    payment_proof_link: String(m.payment_proof_link ?? ""),
    payment_proof_storage_path: String(m.payment_proof_storage_path ?? ""),
    payout_details_json: JSON.stringify(d),
  };
}

/** One CSV row per payee: totals are summed, other columns list distinct values. */
function groupValues(
  g: WithdrawalPayeeGroup,
  currency: ExportCurrency,
): Record<WithdrawalExportColumnId, string> {
  const perRow = g.requests.map((r) => rowValues(r, currency));
  const distinct = (id: WithdrawalExportColumnId) =>
    [...new Set(perRow.map((v) => v[id]).filter(Boolean))].join("; ");
  const merged = Object.fromEntries(
    WITHDRAWAL_EXPORT_COLUMN_IDS.map((id) => [id, distinct(id)]),
  ) as Record<WithdrawalExportColumnId, string>;
  const isCash = g.amountType === "cash";

  return {
    ...merged,
    payee_email: g.destination,
    payout_currency: isCash ? currency.code : "",
    payout_amount: isCash ? convertCents(g.totalCents, currency.rate) : "",
    description: describe(g.usernames),
    request_count: String(g.count),
    usernames: g.usernames.join(", "),
    amount: String(g.totalCents),
    amount_type: g.amountType,
    currency: g.currency,
    payout_method_type: g.method,
  };
}

function normaliseColumns(raw: unknown): WithdrawalExportColumnSpec[] {
  const allowed = new Set<string>(WITHDRAWAL_EXPORT_COLUMN_IDS);
  const out: WithdrawalExportColumnSpec[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const id =
        typeof item === "string"
          ? item.trim()
          : typeof item?.id === "string"
            ? item.id.trim()
            : "";
      if (!allowed.has(id) || seen.has(id)) continue;
      seen.add(id);
      const header =
        typeof item === "object" &&
        typeof item?.header === "string" &&
        item.header.trim()
          ? item.header.trim()
          : WITHDRAWAL_EXPORT_COLUMN_LABELS[id as WithdrawalExportColumnId];
      out.push({ id: id as WithdrawalExportColumnId, header });
    }
  }
  if (out.length === 0) {
    return WITHDRAWAL_EXPORT_COLUMN_IDS.map((id) => ({
      id,
      header: WITHDRAWAL_EXPORT_COLUMN_LABELS[id],
    }));
  }
  return out;
}

function parseCurrency(raw: unknown): ExportCurrency | { error: string } {
  if (!raw || typeof raw !== "object") return DEFAULT_CURRENCY;
  const r = raw as { code?: unknown; rate?: unknown };
  const code = String(r.code ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return { error: "Invalid currency code" };
  if (code === "USD") return DEFAULT_CURRENCY;
  const rate = Number(r.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    return { error: `Enter a conversion rate greater than 0 for ${code}` };
  }
  return { code, rate };
}

async function buildCsv(opts: ExportOptions): Promise<NextResponse> {
  const supabase = createAdminClient();
  const res = await fetchAllFilteredWithdrawals(
    supabase,
    opts.filters,
    opts.sort,
    opts.order,
  );
  if (res.error) {
    return NextResponse.json(
      { error: res.error },
      { status: res.status ?? 500 },
    );
  }

  const records = opts.groupByPayee
    ? groupWithdrawalsByPayee(res.data).map((g) => groupValues(g, opts.currency))
    : res.data.map((r) => rowValues(r, opts.currency));

  const header = opts.columns.map((c) => csvCell(c.header)).join(",");
  const lines = records.map((v) =>
    opts.columns.map((c) => csvCell(v[c.id])).join(","),
  );
  const body = [header, ...lines].join("\r\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="withdrawals-export.csv"`,
    },
  });
}

export async function GET(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawCols = searchParams.get("columns");

  return buildCsv({
    filters: {
      tab: parseWithdrawalsTab(searchParams.get("tab")),
      method: parsePayoutMethod(searchParams.get("method")),
      createdFrom: searchParams.get("createdFrom") || undefined,
      createdTo: searchParams.get("createdTo") || undefined,
    },
    sort: parseSortKey(searchParams.get("sort")),
    order: parseOrder(searchParams.get("order")),
    columns: normaliseColumns(rawCols ? rawCols.split(",") : []),
    currency: DEFAULT_CURRENCY,
    groupByPayee: false,
  });
}

export async function POST(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const currency = parseCurrency(body.currency);
  if ("error" in currency) {
    return NextResponse.json({ error: currency.error }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const tab = parseWithdrawalsTab(str(body.tab));
  const groupByPayee = body.groupByPayee === true;

  // Summing a payee's requests across every status would add already-paid and
  // rejected amounts to the payout total.
  if (groupByPayee && tab === "all") {
    return NextResponse.json(
      {
        error:
          "Pick a status tab (e.g. Approved) before exporting grouped by payee.",
      },
      { status: 400 },
    );
  }

  return buildCsv({
    filters: {
      tab,
      method: parsePayoutMethod(str(body.method)),
      createdFrom: str(body.createdFrom) ?? undefined,
      createdTo: str(body.createdTo) ?? undefined,
    },
    sort: parseSortKey(str(body.sort)),
    order: parseOrder(str(body.order)),
    columns: normaliseColumns(body.columns),
    currency,
    groupByPayee,
  });
}
