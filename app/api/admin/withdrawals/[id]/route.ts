import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { status, transaction_reference, admin_notes, action, user_id } = body || {};
  if (!status && action !== 'cancel') return NextResponse.json({ error: "Missing status or action" }, { status: 400 });

  const supabase = createAdminClient();
  
  // Admin-triggered cancel with refund
  if (action === 'cancel') {
    if (!user_id) return NextResponse.json({ error: 'Missing user_id for cancel' }, { status: 400 });
    const { data: rpcOk, error: rpcErr } = await supabase.rpc('cancel_withdrawal_request_by_user', {
      p_request_id: params.id,
      p_user_id: user_id
    });
    if (rpcErr || rpcOk !== true) {
      return NextResponse.json({ error: rpcErr?.message || 'Cancellation failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("withdrawal_requests")
    .update({ status, updated_at: new Date().toISOString(), transaction_reference: transaction_reference ?? null, admin_notes: admin_notes ?? null, processed_at: status === 'processed' ? new Date().toISOString() : null })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}


