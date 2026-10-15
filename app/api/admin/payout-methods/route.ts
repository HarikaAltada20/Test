import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  AdminPayoutMethodRow,
  AdminPayoutMethodsSummary,
  fetchAdminPayoutEmailGroups,
  getPayoutIdentifier,
  normalizeAdminPayoutRow,
  parseAdminPayoutFilters,
  runAdminPayoutQuery,
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
    "Same email verified on",
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
      r.email_verified_peers.map((peer) => peer.name || peer.username || peer.user_id).join("; "),
    ]
      .map(csvCell)
      .join(",");
  });
  return [header.join(","), ...lines].join("\n");
}

export async function GET(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filters = parseAdminPayoutFilters(searchParams);
  const format = searchParams.get("format");
  const supabase = createAdminClient();

  if (format === "csv") {
    const { data, error } = await runAdminPayoutQuery(supabase, filters, 0, CSV_MAX_ROWS - 1);
    if (error) {
      console.error("Admin payout methods CSV error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map(normalizeAdminPayoutRow);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payout-methods-${stamp}.csv"`,
      },
    });
  }

  if (format === "emails") {
    // excludeKnown=1 drops emails that are already verified on another account:
    // Skydo has finished KYC for them, so they must not be re-invited.
    const excludeKnown = searchParams.get("excludeKnown") === "1";
    const { data, error, tier } = await runAdminPayoutQuery(
      supabase,
      { ...filters, methodType: "skydo" },
      0,
      EMAILS_MAX_ROWS - 1,
      {
        select: "id, details, known_verified",
        selectByTier: { v2: "id, details", legacy: "id, details" },
      }
    );
    if (error) {
      console.error("Admin payout methods emails error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as unknown as {
      id: string;
      details: Record<string, unknown> | null;
      known_verified?: boolean;
    }[];
    const emails: string[] = [];
    const ids: string[] = [];
    const seen = new Set<string>();
    let skippedKnown = 0;
    for (const r of rows) {
      if (excludeKnown && tier === "v3" && r.known_verified) {
        skippedKnown += 1;
        continue;
      }
      const email = getPayoutIdentifier("skydo", r.details);
      ids.push(r.id);
      if (email && !seen.has(email)) {
        seen.add(email);
        emails.push(email);
      }
    }
    return NextResponse.json({
      emails,
      ids,
      skippedKnown,
      truncated: rows.length >= EMAILS_MAX_ROWS,
    });
  }

  if (format === "ids") {
    const { data, error } = await runAdminPayoutQuery(supabase, filters, 0, IDS_MAX_ROWS - 1, {
      select: "id, method_type, skydo_status",
    });
    if (error) {
      console.error("Admin payout methods ids error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const rows = (data ?? []) as unknown as {
      id: string;
      method_type: string;
      skydo_status: string | null;
    }[];
    return NextResponse.json({
      ids: rows.map((r) => r.id),
      skydoIds: rows.filter((r) => r.method_type === "skydo").map((r) => r.id),
      statuses: Object.fromEntries(rows.filter((r) => r.method_type === "skydo").map((r) => [r.id, r.skydo_status])),
      truncated: rows.length >= IDS_MAX_ROWS,
    });
  }

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  );
  const from = (page - 1) * pageSize;

  const summaryPromise = supabase.rpc("admin_payout_methods_summary");

  if (searchParams.get("group") === "email") {
    const [groupsRes, summaryRes] = await Promise.all([
      fetchAdminPayoutEmailGroups(supabase, { ...filters, methodType: "skydo" }, page, pageSize),
      summaryPromise,
    ]);
    if (groupsRes.missing) {
      return NextResponse.json(
        {
          error: "Grouping by email needs the latest database migration (20261015150000_skydo_known_email.sql).",
        },
        { status: 409 }
      );
    }
    if (groupsRes.error) {
      console.error("Admin payout methods groups error:", groupsRes.error);
      return NextResponse.json({ error: groupsRes.error }, { status: 500 });
    }
    return NextResponse.json({
      groups: groupsRes.groups,
      data: groupsRes.groups.flatMap((g) => g.members),
      total: groupsRes.totalGroups,
      totalMethods: groupsRes.totalMethods,
      page,
      pageSize,
      summary: buildSummary(summaryRes),
    });
  }

  const [listRes, summaryRes] = await Promise.all([
    runAdminPayoutQuery(supabase, filters, from, from + pageSize - 1, {
      count: true,
    }),
    summaryPromise,
  ]);

  if (listRes.error) {
    console.error("Admin payout methods list error:", listRes.error);
    return NextResponse.json({ error: listRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: ((listRes.data ?? []) as unknown as Record<string, unknown>[]).map(normalizeAdminPayoutRow),
    total: listRes.count ?? 0,
    page,
    pageSize,
    summary: buildSummary(summaryRes),
  });
}

function buildSummary(res: { data: unknown; error: { message?: string } | null }): AdminPayoutMethodsSummary {
  if (res.error) console.error("Admin payout methods summary error:", res.error);
  return {
    total: 0,
    by_method_type: {},
    by_skydo_status: {},
    skydo_overdue: 0,
    skydo_known_verified: 0,
    skydo_known_pending: 0,
    added_last_24h: 0,
    added_last_7d: 0,
    ...((res.data as Partial<AdminPayoutMethodsSummary> | null) ?? {}),
  };
}
