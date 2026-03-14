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
    
    // Refund the balance back to user
    if (request.amount_type === 'cash') {
      // First get current balance
      const { data: currentProfile, error: fetchError } = await supabase
        .from('creator_profiles')
        .select('withdrawable_balance')
        .eq('id', request.user_id)
        .single();

      if (fetchError || !currentProfile) {
        console.error('❌ Error fetching current balance:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch current balance' }, { status: 500 });
      }

      const newBalance = (currentProfile.withdrawable_balance || 0) + request.amount;
      
      const { error: refundError } = await supabase
        .from('creator_profiles')
        .update({ 
          withdrawable_balance: newBalance
        })
        .eq('id', request.user_id);

      if (refundError) {
        console.error('❌ Error refunding balance:', refundError);
        return NextResponse.json({ error: 'Failed to refund balance' }, { status: 500 });
      }
      
      console.log(`✅ Refunded ${request.amount} cents to user ${request.user_id}. New balance: ${newBalance}`);
    } else if (request.amount_type === 'coins') {
      // First get current coins
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('coins')
        .eq('id', request.user_id)
        .single();

      if (fetchError || !currentUser) {
        console.error('❌ Error fetching current coins:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch current coins' }, { status: 500 });
      }

      const newCoins = (currentUser.coins || 0) + request.amount;
      
      const { error: refundError } = await supabase
        .from('users')
        .update({ 
          coins: newCoins
        })
        .eq('id', request.user_id);

      if (refundError) {
        console.error('❌ Error refunding coins:', refundError);
        return NextResponse.json({ error: 'Failed to refund coins' }, { status: 500 });
      }
      
      console.log(`✅ Refunded ${request.amount} coins to user ${request.user_id}. New coins: ${newCoins}`);
    }

    // Log the refund transaction
    const { error: logError } = await supabase
      .from('money_transactions')
      .insert({
        user_id: request.user_id,
        type: 'refund',
        status: 'success',
        amount: request.amount,
        description: 'Withdrawal cancelled - Balance refunded',
        remarks: 'Refund for cancelled withdrawal request',
        metadata: {
          original_withdrawal_id: id,
          refund_reason: 'cancelled',
          admin_notes: 'Cancelled by admin'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (logError) {
      console.error('❌ Error logging refund transaction:', logError);
      // Don't fail the request, just log the error
    }
    
    return NextResponse.json({ ok: true });
  }

  // Get withdrawal request details first
  const { data: request, error: fetchError } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !request) {
    return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });
  }

  // When marking in_review, append internal reason to admin_notes (visible to other reviewers only)
  let finalAdminNotes = admin_notes ?? request.admin_notes ?? null;
  if (status === 'in_review' && in_review_reason != null && String(in_review_reason).trim() !== '') {
    const prefix = (request.admin_notes || '').trim() ? `${(request.admin_notes || '').trim()}\n\n` : '';
    finalAdminNotes = `${prefix}In review: ${String(in_review_reason).trim()}`;
  }

  // Update withdrawal request
  const { error } = await supabase
    .from("withdrawal_requests")
    .update({ status, updated_at: new Date().toISOString(), transaction_reference: transaction_reference ?? null, admin_notes: finalAdminNotes, processed_at: status === 'processed' ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Handle refunds for rejected/cancelled withdrawals
  if (['rejected', 'cancelled'].includes(status)) {
    console.log(`🔄 Processing refund for ${status} withdrawal: ${request.amount} ${request.amount_type} to user ${request.user_id}`);
    
    // Refund the balance back to user
    if (request.amount_type === 'cash') {
      // First get current balance
      const { data: currentProfile, error: fetchError } = await supabase
        .from('creator_profiles')
        .select('withdrawable_balance')
        .eq('id', request.user_id)
        .single();

      if (fetchError || !currentProfile) {
        console.error('❌ Error fetching current balance:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch current balance' }, { status: 500 });
      }

      const newBalance = (currentProfile.withdrawable_balance || 0) + request.amount;
      
      const { error: refundError } = await supabase
        .from('creator_profiles')
        .update({ 
          withdrawable_balance: newBalance
        })
        .eq('id', request.user_id);

      if (refundError) {
        console.error('❌ Error refunding balance:', refundError);
        return NextResponse.json({ error: 'Failed to refund balance' }, { status: 500 });
      }
      
      console.log(`✅ Refunded ${request.amount} cents to user ${request.user_id}. New balance: ${newBalance}`);
    } else if (request.amount_type === 'coins') {
      // First get current coins
      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('coins')
        .eq('id', request.user_id)
        .single();

      if (fetchError || !currentUser) {
        console.error('❌ Error fetching current coins:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch current coins' }, { status: 500 });
      }

      const newCoins = (currentUser.coins || 0) + request.amount;
      
      const { error: refundError } = await supabase
        .from('users')
        .update({ 
          coins: newCoins
        })
        .eq('id', request.user_id);

      if (refundError) {
        console.error('❌ Error refunding coins:', refundError);
        return NextResponse.json({ error: 'Failed to refund coins' }, { status: 500 });
      }
      
      console.log(`✅ Refunded ${request.amount} coins to user ${request.user_id}. New coins: ${newCoins}`);
    }

    // Log the refund transaction
    const { error: logError } = await supabase
      .from('money_transactions')
      .insert({
        user_id: request.user_id,
        type: 'refund',
        status: 'success',
        amount: request.amount,
        description: `Withdrawal ${status} - Balance refunded`,
        remarks: `Refund for ${status} withdrawal request`,
        metadata: {
          original_withdrawal_id: id,
          refund_reason: status,
          admin_notes: admin_notes
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (logError) {
      console.error('❌ Error logging refund transaction:', logError);
      // Don't fail the request, just log the error
    }
  }

  // Also update the corresponding money transaction if status is processed, failed, or cancelled
  if (['processed', 'failed', 'cancelled', 'rejected'].includes(status)) {
    const transactionStatus = status === 'processed' ? 'success' : 
                             status === 'failed' ? 'failed' : 
                             status === 'rejected' ? 'failed' : 'cancelled';
    
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