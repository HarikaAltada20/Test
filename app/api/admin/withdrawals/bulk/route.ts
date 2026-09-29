import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

const MAX_BULK_IDS = 200;
/** Keep DB/API load steady instead of 200 parallel RPC calls. */
const CONCURRENCY = 8;

const BULK_ALLOWED_STATUSES = ["approved"] as const;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => run(),
  );
  await Promise.all(runners);
  return results;
}

export async function POST(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ids, status } = (body || {}) as {
    ids?: unknown;
    status?: unknown;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "ids must be a non-empty array" },
      { status: 400 },
    );
  }
  if (ids.length > MAX_BULK_IDS) {
    return NextResponse.json(
      { error: `Too many ids (max ${MAX_BULK_IDS})` },
      { status: 400 },
    );
  }

  const uniqueIds = [
    ...new Set(
      ids.filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  if (uniqueIds.length === 0) {
    return NextResponse.json(
      { error: "No valid ids provided" },
      { status: 400 },
    );
  }

  if (typeof status !== "string" || !BULK_ALLOWED_STATUSES.includes(status as (typeof BULK_ALLOWED_STATUSES)[number])) {
    return NextResponse.json(
      {
        error: `Invalid status. Bulk supports: ${BULK_ALLOWED_STATUSES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Only approve rows that are still pending/in_review (skip already moved)
  const { data: eligible, error: fetchError } = await supabase
    .from("withdrawal_requests")
    .select("id, status")
    .in("id", uniqueIds)
    .in("status", ["pending", "in_review"]);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const eligibleIds = (eligible || []).map((r) => r.id as string);
  const eligibleSet = new Set(eligibleIds);
  const skipped = uniqueIds.filter((id) => !eligibleSet.has(id));

  const outcomes = await mapPool(eligibleIds, CONCURRENCY, async (id) => {
    const { error } = await supabase.rpc("admin_set_withdrawal_status", {
      p_request_id: id,
      p_new_status: status,
      p_transaction_reference: null,
      p_admin_notes: null,
      p_in_review_reason: null,
    });
    if (error) {
      return { id, ok: false as const, error: error.message || "RPC failed" };
    }
    return { id, ok: true as const };
  });

  const succeeded = outcomes.filter((o) => o.ok).map((o) => o.id);
  const failed = outcomes
    .filter((o) => !o.ok)
    .map((o) => ({ id: o.id, error: "error" in o ? o.error : "Unknown error" }));

  return NextResponse.json({
    ok: failed.length === 0,
    status,
    requested: uniqueIds.length,
    succeeded: succeeded.length,
    failed: failed.length,
    skipped: skipped.length,
    succeededIds: succeeded,
    failedItems: failed,
    skippedIds: skipped,
  });
}
