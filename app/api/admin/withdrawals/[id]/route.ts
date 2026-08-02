import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const {
    status,
    transaction_reference,
    admin_notes,
    action,
    user_id,
    in_review_reason,
    mode,
    payment_proof_link,
  } = body || {};

  const supabase = createAdminClient();

  // Metadata-only update (notes, UTR, proof link) — any status, no RPC
  if (mode === "metadata") {
    const updates: Record<string, string | null> = {};
    if (typeof admin_notes === "string") {
      updates.admin_notes = admin_notes.slice(0, 20000);
    }
    if (typeof transaction_reference === "string") {
      updates.transaction_reference = transaction_reference.slice(0, 500);
    }
    if (payment_proof_link === null) {
      updates.payment_proof_link = null;
    } else if (typeof payment_proof_link === "string") {
      updates.payment_proof_link = payment_proof_link.trim().slice(0, 2048);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          error:
            "Provide admin_notes, transaction_reference, and/or payment_proof_link",
        },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("withdrawal_requests")
      .update(updates)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!status && action !== "cancel")
    return NextResponse.json(
      { error: "Missing status or action" },
      { status: 400 },
    );

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

  // Only forward optional fields when explicitly provided so the RPC can
  // preserve existing transaction_reference / admin_notes (COALESCE).
  const { error } = await supabase.rpc("admin_set_withdrawal_status", {
    p_request_id: id,
    p_new_status: status,
    p_transaction_reference:
      typeof transaction_reference === "string" ? transaction_reference : null,
    p_admin_notes: typeof admin_notes === "string" ? admin_notes : null,
    p_in_review_reason:
      typeof in_review_reason === "string" ? in_review_reason : null,
  });

  if (error) {
    const msg = error.message || "Failed to update withdrawal";
    const lower = msg.toLowerCase();
    const isNotFound = lower.includes("not found");
    const isBadTransition = lower.includes("invalid status transition");
    return NextResponse.json(
      { error: msg },
      { status: isNotFound ? 404 : isBadTransition ? 400 : 500 },
    );
  }

  return NextResponse.json({ ok: true });
}