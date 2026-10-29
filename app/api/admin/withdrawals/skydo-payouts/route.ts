import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { fetchAllFilteredWithdrawals } from "@/lib/admin-withdrawals-list";
import {
  buildPayoutDetails,
  matchSkydoPayouts,
  normalizeEmail,
  parseCreditDate,
  parseMoneyMinor,
  parseSkydoPayouts,
  type MatchRow,
  type MatchableRequest,
  type SkydoPayout,
} from "@/lib/skydo-payout-import";

/**
 * Record Skydo payouts on approved withdrawal requests and mark them paid.
 *
 *   mode "preview": parse the pasted Skydo table/JSON and match it to approved Skydo
 *                   requests in the current filters (or the selected ids). Writes nothing.
 *   mode "apply":   re-runs the same match server-side and records the ticked payouts.
 *   mode "manual":  one set of payout details for the given request ids.
 */

const MAX_REQUESTS_PER_APPLY = 200;
const CONCURRENCY = 8;
const MAX_TEXT_LENGTH = 200_000;

type Body = {
  mode?: unknown;
  text?: unknown;
  createdFrom?: unknown;
  createdTo?: unknown;
  scopeIds?: unknown;
  payoutIds?: unknown;
  ids?: unknown;
  details?: unknown;
  markPaid?: unknown;
};

type RequestSummary = {
  id: string;
  username: string | null;
  fullName: string | null;
  sendCents: number;
  createdAt: string;
};

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );
  return results;
}

function stringIds(v: unknown, max = 1000): string[] | null {
  if (!Array.isArray(v)) return null;
  return [
    ...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0)),
  ].slice(0, max);
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

function skydoEmailOf(row: Record<string, unknown>): string {
  const d = row.payout_method_details_snapshot as Record<string, unknown> | null;
  return typeof d?.email === "string" ? normalizeEmail(d.email) : "";
}

function sendCentsOf(row: Record<string, unknown>): number {
  const net = Number(row.net_amount_cents);
  if (Number.isFinite(net) && row.net_amount_cents != null) return net;
  return Number(row.amount) || 0;
}

function friendlyRpcError(message: string): string {
  if (/admin_record_withdrawal_payout|could not find the function|payout_details/i.test(message)) {
    return "The payout_details database migration hasn't been run yet.";
  }
  return message;
}

async function buildPreview(
  supabase: SupabaseClient,
  text: string,
  opts: { createdFrom: string | null; createdTo: string | null; scopeIds: string[] | null },
) {
  const parsed = parseSkydoPayouts(text);

  // Candidates: approved Skydo cash requests in the page's filters (or the selection).
  const all = await fetchAllFilteredWithdrawals(supabase, {
    tab: "approved",
    method: "skydo",
    createdFrom: opts.scopeIds ? null : opts.createdFrom,
    createdTo: opts.scopeIds ? null : opts.createdTo,
  });
  if (all.error) {
    return { error: all.error, status: all.status ?? 500 } as const;
  }
  const scope = opts.scopeIds ? new Set(opts.scopeIds) : null;
  const candidates = all.data.filter(
    (r) => r.amount_type === "cash" && (!scope || scope.has(String(r.id))),
  );
  const summaries = new Map<string, RequestSummary>();
  const matchable: MatchableRequest[] = candidates.map((r) => {
    const users = r.users as { username?: string | null; full_name?: string | null } | null;
    const id = String(r.id);
    summaries.set(id, {
      id,
      username: users?.username ?? null,
      fullName: users?.full_name ?? null,
      sendCents: sendCentsOf(r),
      createdAt: String(r.created_at ?? ""),
    });
    return {
      id,
      email: skydoEmailOf(r),
      sendCents: sendCentsOf(r),
      status: String(r.status),
      username: users?.username ?? null,
      fullName: users?.full_name ?? null,
    };
  });

  // Approved Skydo requests for the same emails that the filters leave out.
  const candidateIds = new Set(matchable.map((r) => r.id));
  const outsideCounts = new Map<string, number>();
  const { data: approvedAll } = await supabase
    .from("withdrawal_requests")
    .select("id, payout_method_details_snapshot")
    .eq("status", "approved")
    .ilike("payout_method_type_snapshot", "skydo")
    .limit(5000);
  for (const r of (approvedAll ?? []) as Record<string, unknown>[]) {
    if (candidateIds.has(String(r.id))) continue;
    const email = skydoEmailOf(r);
    if (email) outsideCounts.set(email, (outsideCounts.get(email) ?? 0) + 1);
  }

  // Payout IDs already recorded on a paid request (safe re-import).
  const recordedPayoutIds = new Set<string>();
  const ids = parsed.payouts.map((p) => p.payoutId);
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("payout_details")
      .eq("status", "processed")
      .in("payout_details->>payout_id", ids.slice(i, i + 100));
    if (error) break; // column not there yet; apply will explain
    for (const r of (data ?? []) as { payout_details: { payout_id?: string } | null }[]) {
      if (r.payout_details?.payout_id) recordedPayoutIds.add(r.payout_details.payout_id);
    }
  }

  const rows = matchSkydoPayouts(parsed.payouts, matchable, {
    recordedPayoutIds,
    outsideCounts,
  });
  return { parsed, rows, summaries } as const;
}

function serializeRow(row: MatchRow, summaries: Map<string, RequestSummary>) {
  return {
    ...row,
    requests: row.requestIds
      .map((id) => summaries.get(id))
      .filter((x): x is RequestSummary => Boolean(x)),
  };
}

export async function POST(req: NextRequest) {
  const { isAdmin, user } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const mode = body.mode;

  if (mode === "manual") {
    return applyManual(supabase, body, user?.id ?? null);
  }

  if (mode !== "preview" && mode !== "apply") {
    return NextResponse.json({ error: "mode must be preview, apply or manual" }, { status: 400 });
  }
  if (typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json({ error: "Paste the Skydo payouts first" }, { status: 400 });
  }
  if (body.text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "That paste is too long" }, { status: 400 });
  }

  const preview = await buildPreview(supabase, body.text, {
    createdFrom: isoOrNull(body.createdFrom),
    createdTo: isoOrNull(body.createdTo),
    scopeIds: stringIds(body.scopeIds),
  });
  if ("error" in preview) {
    return NextResponse.json({ error: preview.error }, { status: preview.status });
  }
  const { parsed, rows, summaries } = preview;

  if (mode === "preview") {
    return NextResponse.json({
      format: parsed.format,
      errors: parsed.errors,
      warnings: parsed.warnings,
      rows: rows.map((r) => serializeRow(r, summaries)),
    });
  }

  // apply
  const ticked = new Set(stringIds(body.payoutIds) ?? []);
  const toApply = rows.filter((r) => r.state === "ready" && ticked.has(r.payout.payoutId));
  const notReady = [...ticked].filter((id) => !toApply.some((r) => r.payout.payoutId === id));
  const jobs = toApply.flatMap((row) =>
    row.requestIds.map((requestId) => ({ row, requestId })),
  );
  if (jobs.length === 0) {
    return NextResponse.json(
      { error: "Nothing ready to mark paid. Preview again; something may have changed." },
      { status: 409 },
    );
  }
  if (jobs.length > MAX_REQUESTS_PER_APPLY) {
    return NextResponse.json(
      { error: `Too many requests at once (max ${MAX_REQUESTS_PER_APPLY}). Tick fewer payouts.` },
      { status: 400 },
    );
  }

  const now = new Date();
  const outcomes = await mapPool(jobs, CONCURRENCY, async ({ row, requestId }) => {
    const details = buildPayoutDetails(row.payout, {
      groupRequestCount: row.requestIds.length,
      source: "import",
      recordedBy: user?.id ?? null,
      now,
    });
    const { error } = await supabase.rpc("admin_record_withdrawal_payout", {
      p_request_id: requestId,
      p_payout_details: details,
      p_transaction_reference: row.payout.payoutId,
      p_mark_paid: true,
    });
    return {
      payoutId: row.payout.payoutId,
      requestId,
      error: error ? friendlyRpcError(error.message || "Failed") : null,
    };
  });

  return NextResponse.json(summarizeOutcomes(outcomes, { skippedPayoutIds: notReady }));
}

function summarizeOutcomes(
  outcomes: { payoutId: string; requestId: string; error: string | null }[],
  extra: Record<string, unknown> = {},
) {
  const failed = outcomes.filter((o) => o.error);
  const succeeded = outcomes.filter((o) => !o.error);
  return {
    ok: failed.length === 0,
    succeeded: succeeded.length,
    failed: failed.length,
    payoutsPaid: new Set(succeeded.map((o) => o.payoutId)).size,
    succeededIds: succeeded.map((o) => o.requestId),
    failedItems: failed.map((o) => ({ id: o.requestId, payoutId: o.payoutId, error: o.error })),
    ...extra,
  };
}

async function applyManual(supabase: SupabaseClient, body: Body, recordedBy: string | null) {
  const ids = stringIds(body.ids, MAX_REQUESTS_PER_APPLY + 1);
  if (!ids || ids.length === 0) {
    return NextResponse.json({ error: "Select at least one request" }, { status: 400 });
  }
  if (ids.length > MAX_REQUESTS_PER_APPLY) {
    return NextResponse.json(
      { error: `Too many requests at once (max ${MAX_REQUESTS_PER_APPLY})` },
      { status: 400 },
    );
  }
  const d = (body.details ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const payoutId = str(d.payout_id, 200);
  const utr = str(d.utr, 100);
  const payoutCents = parseMoneyMinor(d.payout_amount_usd);
  const settledPaise = parseMoneyMinor(d.amount_settled_inr);
  const dateOfCredit = parseCreditDate(d.date_of_credit);
  if (!payoutId && !utr) {
    return NextResponse.json({ error: "Enter a payout ID or a UTR" }, { status: 400 });
  }
  if (d.date_of_credit && !dateOfCredit) {
    return NextResponse.json({ error: "Date of credit isn't a valid date" }, { status: 400 });
  }
  const markPaid = body.markPaid === true;

  const { data: rows, error } = await supabase
    .from("withdrawal_requests")
    .select("id, status, payout_method_type_snapshot, payout_method_details_snapshot")
    .in("id", ids);
  if (error) {
    return NextResponse.json({ error: friendlyRpcError(error.message) }, { status: 500 });
  }
  const found = (rows ?? []) as Record<string, unknown>[];
  const allSkydo =
    found.length > 0 &&
    found.every((r) => String(r.payout_method_type_snapshot ?? "").toLowerCase() === "skydo");
  const emails = [...new Set(found.map(skydoEmailOf).filter(Boolean))];

  const payout: SkydoPayout = {
    payoutId: payoutId ?? "",
    name: str(d.payee_name, 200) ?? "",
    email: emails.length === 1 ? emails[0] : "",
    status: str(d.status, 50) ?? "Completed",
    statusKey: "completed",
    payoutAmountCents: payoutCents ?? 0,
    settledInrPaise: settledPaise,
    dateOfCredit,
    utr,
  };
  const now = new Date();
  const details = {
    ...buildPayoutDetails(payout, {
      // An edit of one request keeps the group size it was recorded with.
      groupRequestCount:
        Number.isInteger(d.group_request_count) && Number(d.group_request_count) > 0
          ? Math.min(Number(d.group_request_count), 1000)
          : ids.length,
      source: "manual",
      recordedBy,
      now,
      provider: allSkydo ? "skydo" : "manual",
    }),
    payout_amount_usd: payoutCents === null ? null : payoutCents / 100,
  };

  const missing = ids.filter((id) => !found.some((r) => String(r.id) === id));
  const outcomes = await mapPool(
    ids.filter((id) => !missing.includes(id)),
    CONCURRENCY,
    async (requestId) => {
      const { error: rpcError } = await supabase.rpc("admin_record_withdrawal_payout", {
        p_request_id: requestId,
        p_payout_details: details,
        p_transaction_reference: payoutId,
        p_mark_paid: markPaid,
      });
      return {
        payoutId: payoutId ?? "",
        requestId,
        error: rpcError ? friendlyRpcError(rpcError.message || "Failed") : null,
      };
    },
  );
  for (const id of missing) {
    outcomes.push({ payoutId: payoutId ?? "", requestId: id, error: "Request not found" });
  }
  return NextResponse.json({ ...summarizeOutcomes(outcomes), markPaid, details });
}
