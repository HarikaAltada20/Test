import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  AdminPayoutMethodFilters,
  AdminPayoutMethodRow,
  AdminPayoutMethodsSummary,
  buildAdminPayoutQuery,
  getPayoutIdentifier,
  isMissingColumnError,
  normalizeAdminPayoutRow,
  parseAdminPayoutFilters,
} from "@/lib/admin-payout-methods";
import { SKYDO_STATUS_LABELS, isSkydoStatus } from "@/lib/skydo-payout";

const DEFAULT_PAGE_SIZE = 25;
const CSV_MAX_ROWS = 5000;
const EMAILS_MAX_ROWS = 2000;
const IDS_MAX_ROWS = 200;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: AdminPayoutMethodRow[]): string {
  const header = [
    "User name",
    "Email",
    "Username",
    "Role",
    "Country",
    "Method type",
    "Friendly name",
    "Payout identifier",
    "Account holder",
    "Skydo status",
    "Default",
    "Added at",
    "Status updated at",
    "Status updated by",
    "Withdrawable balance (USD)",
    "Withdrawal count",
    "Last withdrawal at",
    "Admin notes",
  ];
  const lines = rows.map((r) => {
    const d = (r.details ?? {}) as Record<string, unknown>;
    return [
      r.full_name,
      r.email,
      r.username,
      r.user_type,
      r.country,
      r.method_type,
      r.friendly_name,
      getPayoutIdentifier(r.method_type, d),
      d.account_holder_name ?? "",
      isSkydoStatus(r.skydo_status) ? SKYDO_STATUS_LABELS[r.skydo_status] : "",
      r.is_default ? "Yes" : "No",
      r.created_at,
      r.skydo_status_updated_at,
      r.status_updated_by_name,
      ((r.withdrawable_balance ?? 0) / 100).toFixed(2),
      r.withdrawal_count ?? 0,
      r.last_withdrawal_at,
      r.admin_notes,
    ]
      .map(csvCell)
      .join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

/** Runs a view query, retrying with the legacy column set if the v2 migration is missing. */
async function runQuery(
  supabase: SupabaseClient,
  filters: AdminPayoutMethodFilters,
  from: number,
  to: number,
  options: { count?: boolean; select?: string } = {}
) {
  const first = await buildAdminPayoutQuery(supabase, filters, options).range(from, to);
  if (!isMissingColumnError(first.error)) return first;
  return buildAdminPayoutQuery(supabase, filters, { ...options, legacy: true }).range(from, to);
}

export async function GET(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filters = parseAdminPayoutFilters(searchParams);
  const format = searchParams.get("format");
  const supabase = createAdminClient();

  if (format === "csv") {
    const { data, error } = await runQuery(supabase, filters, 0, CSV_MAX_ROWS - 1);
    if (error) {
      console.error("Admin payout methods CSV error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map(
      normalizeAdminPayoutRow
    );
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payout-methods-${stamp}.csv"`,
      },
    });
  }

  if (format === "emails") {
    const { data, error } = await runQuery(
      supabase,
      { ...filters, methodType: "skydo" },
      0,
      EMAILS_MAX_ROWS - 1,
      { select: "id, details" }
    );
    if (error) {
      console.error("Admin payout methods emails error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as unknown as { id: string; details: Record<string, unknown> | null }[];
    const emails: string[] = [];
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const email = getPayoutIdentifier("skydo", r.details);
      ids.push(r.id);
      if (email && !seen.has(email)) {
        seen.add(email);
        emails.push(email);
      }
    }
    return NextResponse.json({ emails, ids, truncated: rows.length >= EMAILS_MAX_ROWS });
  }

  if (format === "ids") {
    const { data, error } = await runQuery(supabase, filters, 0, IDS_MAX_ROWS - 1, {
      select: "id, method_type",
    });
    if (error) {
      console.error("Admin payout methods ids error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as unknown as { id: string; method_type: string }[];
    return NextResponse.json({
      ids: rows.map((r) => r.id),
      skydoIds: rows.filter((r) => r.method_type === "skydo").map((r) => r.id),
      truncated: rows.length >= IDS_MAX_ROWS,
    });
  }

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(
      1,
      parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) ||
        DEFAULT_PAGE_SIZE
    )
  );
  const from = (page - 1) * pageSize;

  const [listRes, summaryRes] = await Promise.all([
    runQuery(supabase, filters, from, from + pageSize - 1, { count: true }),
    supabase.rpc("admin_payout_methods_summary"),
  ]);

  if (listRes.error) {
    console.error("Admin payout methods list error:", listRes.error);
    return NextResponse.json({ error: listRes.error.message }, { status: 500 });
  }
  if (summaryRes.error) {
    console.error("Admin payout methods summary error:", summaryRes.error);
  }

  const summary: AdminPayoutMethodsSummary = {
    total: 0,
    by_method_type: {},
    by_skydo_status: {},
    skydo_overdue: 0,
    added_last_24h: 0,
    added_last_7d: 0,
    ...((summaryRes.data as Partial<AdminPayoutMethodsSummary> | null) ?? {}),
  };

  return NextResponse.json({
    data: ((listRes.data ?? []) as unknown as Record<string, unknown>[]).map(
      normalizeAdminPayoutRow
    ),
    total: listRes.count ?? 0,
    page,
    pageSize,
    summary,
  });
}
