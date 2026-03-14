import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status, transaction_reference, admin_notes, action, user_id, in_review_reason } = body || {};
  if (!status && action !== 'cancel') return NextResponse.json({ error: "Missing status or action" }, { status: 400 });

  const supabase = createAdminClient();

  const ALLOWED_STATUSES = [
    "pending",
    "in_review",
    "approved",
    "processed",
    "rejected",
    "cancelled",
    "failed",
    "forfeited",
  ] as const;
  
  // Admin-triggered cancel with refund
  if (action === 'cancel') {
    if (!user_id) return NextResponse.json({ error: 'Missing user_id for cancel' }, { status: 400 });

    const { error } = await supabase.rpc("admin_cancel_withdrawal_request", {
      p_request_id: id,
    });

    if (error) {
      // If function raises "Cannot cancel request with status: X", treat as 400
      const msg = error.message || "Failed to cancel request";
      const isBadRequest = msg.toLowerCase().includes("cannot cancel request with status");
      return NextResponse.json({ error: msg }, { status: isBadRequest ? 400 : 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (typeof status !== "string") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.includes(status as any)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await supabase.rpc("admin_set_withdrawal_status", {
    p_request_id: id,
    p_new_status: status,
    p_transaction_reference: transaction_reference ?? null,
    p_admin_notes: admin_notes ?? null,
    p_in_review_reason: in_review_reason ?? null,
  });

  if (error) {
    const msg = error.message || "Failed to update withdrawal";
    const isNotFound = msg.toLowerCase().includes("not found");
    return NextResponse.json({ error: msg }, { status: isNotFound ? 404 : 500 });
  }

  return NextResponse.json({ ok: true });
}