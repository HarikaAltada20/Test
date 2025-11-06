/**
 * One-time script to refund old rejected withdrawals
 * Run this once to fix historical data
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to add your Supabase URL and service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function refundOldRejectedWithdrawals() {
    console.log('🔍 Finding old rejected withdrawals that need refunds...');

    // Find all rejected withdrawals
    const { data: rejectedWithdrawals, error: fetchError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('status', 'rejected')
        .order('created_at', { ascending: true });

    if (fetchError) {
        console.error('❌ Error fetching rejected withdrawals:', fetchError);
        return;
    }

    if (!rejectedWithdrawals || rejectedWithdrawals.length === 0) {
        console.log('✅ No rejected withdrawals found. All good!');
        return;
    }

    console.log(`📊 Found ${rejectedWithdrawals.length} rejected withdrawals to process`);

    let successCount = 0;
    let errorCount = 0;

    for (const withdrawal of rejectedWithdrawals) {
        try {
            console.log(`\n🔄 Processing withdrawal ${withdrawal.id} (${withdrawal.amount} ${withdrawal.amount_type})`);

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
                    console.error(`❌ Error fetching balance for user ${withdrawal.user_id}:`, fetchError);
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
                    console.error(`❌ Error refunding balance for user ${withdrawal.user_id}:`, refundError);
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
                    console.error(`❌ Error fetching coins for user ${withdrawal.user_id}:`, fetchError);
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
                    console.error(`❌ Error refunding coins for user ${withdrawal.user_id}:`, refundError);
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
                        processed_by: 'refund-script'
                    },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (logError) {
                console.error(`❌ Error logging refund transaction for withdrawal ${withdrawal.id}:`, logError);
                errorCount++;
                continue;
            }

            successCount++;
            console.log(`✅ Successfully processed withdrawal ${withdrawal.id}`);

        } catch (error) {
            console.error(`❌ Unexpected error processing withdrawal ${withdrawal.id}:`, error);
            errorCount++;
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📋 Total withdrawals: ${rejectedWithdrawals.length}`);
}

// Run the script
refundOldRejectedWithdrawals()
    .then(() => {
        console.log('\n🎉 Script completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    });
