import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { status, transaction_reference, admin_notes, action, user_id } = body || {};
  if (!status && action !== 'cancel') return NextResponse.json({ error: "Missing status or action" }, { status: 400 });

  const supabase = createAdminClient();
  
  // Admin-triggered cancel with refund
  if (action === 'cancel') {
    if (!user_id) return NextResponse.json({ error: 'Missing user_id for cancel' }, { status: 400 });
    
    // First, get the withdrawal request details
    const { data: request, error: fetchError } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !request) {
      return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });
    }
    
    // Check if request is in a cancellable state
    if (!['pending', 'in_review'].includes(request.status)) {
      return NextResponse.json({ error: `Cannot cancel request with status: ${request.status}` }, { status: 400 });
    }
    
    // Start a transaction to cancel the request and refund the balance
    const { error: updateError } = await supabase
      .from('withdrawal_requests')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'Cancelled by admin',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (updateError) {
      return NextResponse.json({ error: 'Failed to update withdrawal request' }, { status: 500 });
    }
    
    // Also update the corresponding money transaction
    const { error: transactionError } = await supabase
      .from("money_transactions")
      .update({ 
        status: 'cancelled', 
        updated_at: new Date().toISOString(),
        remarks: 'Cancelled by admin'
      })
      .eq("withdrawal_request_id", id);

    if (transactionError) {
      console.error('Error updating money transaction for cancellation:', transactionError);
      // Don't fail the request, just log the error
    }
    
    // For now, just mark as cancelled without refunding balance
    // The balance refund can be handled manually or through a separate process
    console.log(`Withdrawal request ${id} cancelled by admin. Amount to refund: ${request.amount} ${request.amount_type} to user ${user_id}`);
    
    return NextResponse.json({ ok: true });
  }

  // Update withdrawal request
  const { error } = await supabase
    .from("withdrawal_requests")
    .update({ status, updated_at: new Date().toISOString(), transaction_reference: transaction_reference ?? null, admin_notes: admin_notes ?? null, processed_at: status === 'processed' ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also update the corresponding money transaction if status is processed, failed, or cancelled
  if (['processed', 'failed', 'cancelled'].includes(status)) {
    const transactionStatus = status === 'processed' ? 'success' : status === 'failed' ? 'failed' : 'cancelled';
    
    const { error: transactionError } = await supabase
      .from("money_transactions")
      .update({ 
        status: transactionStatus, 
        updated_at: new Date().toISOString(),
        remarks: admin_notes ? `Admin notes: ${admin_notes}` : null
      })
      .eq("withdrawal_request_id", id);

    if (transactionError) {
      console.error('Error updating money transaction:', transactionError);
      // Don't fail the request, just log the error
    }
  }

  return NextResponse.json({ ok: true });
}


