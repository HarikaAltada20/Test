/**
 * Admin API to refund old rejected withdrawals
 * One-time fix for historical data
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";

export async function POST(req: NextRequest) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();

  try {
    console.log('🔍 Finding old rejected withdrawals that need refunds...');
    
    // Find all rejected withdrawals
    const { data: rejectedWithdrawals, error: fetchError } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('status', 'rejected')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching rejected withdrawals:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch rejected withdrawals' }, { status: 500 });
    }

    if (!rejectedWithdrawals || rejectedWithdrawals.length === 0) {
      return NextResponse.json({ 
        message: 'No rejected withdrawals found',
        processed: 0,
        errors: 0
      });
    }

    console.log(`📊 Found ${rejectedWithdrawals.length} rejected withdrawals to process`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const withdrawal of rejectedWithdrawals) {
      try {
        console.log(`🔄 Processing withdrawal ${withdrawal.id} (${withdrawal.amount} ${withdrawal.amount_type})`);

        // Check if refund already exists
        const { data: existingRefund } = await supabase
          .from('money_transactions')
          .select('id')
          .eq('type', 'refund')
          .eq('metadata->>original_withdrawal_id', withdrawal.id)
          .single();

        if (existingRefund) {
          console.log(`⏭️  Refund already exists for withdrawal ${withdrawal.id}, skipping...`);
          continue;
        }

        // Refund the balance
        if (withdrawal.amount_type === 'cash') {
          // Get current balance
          const { data: currentProfile, error: fetchError } = await supabase
            .from('creator_profiles')
            .select('withdrawable_balance')
            .eq('id', withdrawal.user_id)
            .single();

          if (fetchError || !currentProfile) {
            const errorMsg = `Error fetching balance for user ${withdrawal.user_id}: ${fetchError?.message}`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
            errorCount++;
            continue;
          }

          const newBalance = (currentProfile.withdrawable_balance || 0) + withdrawal.amount;
          
          // Update balance
          const { error: refundError } = await supabase
            .from('creator_profiles')
            .update({ 
              withdrawable_balance: newBalance
            })
            .eq('id', withdrawal.user_id);

          if (refundError) {
            const errorMsg = `Error refunding balance for user ${withdrawal.user_id}: ${refundError.message}`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
            errorCount++;
            continue;
          }

          console.log(`✅ Refunded ${withdrawal.amount} cents to user ${withdrawal.user_id}. New balance: ${newBalance}`);

        } else if (withdrawal.amount_type === 'coins') {
          // Get current coins
          const { data: currentUser, error: fetchError } = await supabase
            .from('users')
            .select('coins')
            .eq('id', withdrawal.user_id)
            .single();

          if (fetchError || !currentUser) {
            const errorMsg = `Error fetching coins for user ${withdrawal.user_id}: ${fetchError?.message}`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
            errorCount++;
            continue;
          }

          const newCoins = (currentUser.coins || 0) + withdrawal.amount;
          
          // Update coins
          const { error: refundError } = await supabase
            .from('users')
            .update({ 
              coins: newCoins
            })
            .eq('id', withdrawal.user_id);

          if (refundError) {
            const errorMsg = `Error refunding coins for user ${withdrawal.user_id}: ${refundError.message}`;
            console.error(`❌ ${errorMsg}`);
            errors.push(errorMsg);
            errorCount++;
            continue;
          }

          console.log(`✅ Refunded ${withdrawal.amount} coins to user ${withdrawal.user_id}. New coins: ${newCoins}`);
        }

        // Log the refund transaction
        const { error: logError } = await supabase
          .from('money_transactions')
          .insert({
            user_id: withdrawal.user_id,
            type: 'refund',
            status: 'success',
            amount: withdrawal.amount,
            description: 'Withdrawal rejected - Balance refunded (historical fix)',
            remarks: 'Refund for rejected withdrawal request (historical fix)',
            metadata: {
              original_withdrawal_id: withdrawal.id,
              refund_reason: 'rejected',
              admin_notes: 'Historical refund for old rejected withdrawal',
              processed_by: 'admin-api'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (logError) {
          const errorMsg = `Error logging refund transaction for withdrawal ${withdrawal.id}: ${logError.message}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
          errorCount++;
          continue;
        }

        successCount++;
        console.log(`✅ Successfully processed withdrawal ${withdrawal.id}`);

      } catch (error: any) {
        const errorMsg = `Unexpected error processing withdrawal ${withdrawal.id}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
        errorCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📋 Total withdrawals: ${rejectedWithdrawals.length}`);

    return NextResponse.json({
      message: 'Refund process completed',
      total: rejectedWithdrawals.length,
      processed: successCount,
      errors: errorCount,
      errorDetails: errors
    });

  } catch (error: any) {
    console.error('💥 Refund process failed:', error);
    return NextResponse.json({ 
      error: 'Refund process failed',
      details: error.message 
    }, { status: 500 });
  }
}
