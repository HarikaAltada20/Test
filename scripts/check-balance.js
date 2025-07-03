const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBalance() {
    try {
        const contestId = '5679ca79-8f61-4ab9-812c-da018f556509';

        // Get contest data to find advertiser_id and payment_details
        const { data: contest, error: contestError } = await supabase
            .from('contests')
            .select('advertiser_id, payment_details')
            .eq('id', contestId)
            .single();

        if (contestError || !contest) {
            console.error('❌ Error fetching contest:', contestError?.message || 'Contest not found.');
            return;
        }

        const { advertiser_id, payment_details } = contest;

        // Get advertiser's wallet balance
        const { data: profile, error: profileError } = await supabase
            .from('advertiser_profiles')
            .select('available_deposit_balance')
            .eq('id', advertiser_id)
            .single();

        if (profileError || !profile) {
            console.error('❌ Error fetching advertiser profile:', profileError?.message || 'Profile not found.');
            return;
        }

        const walletBalance = profile.available_deposit_balance;
        const totalAmount = payment_details.total_amount_paid;

        console.log('--- Balance Check ---');
        console.log(`👤 User ID: ${advertiser_id}`);
        console.log(`💰 Wallet Balance: $${(walletBalance / 100).toFixed(2)} (${walletBalance} cents)`);
        console.log(`💳 Contest Total: $${(totalAmount / 100).toFixed(2)} (${totalAmount} cents)`);
        console.log('---------------------\n');

        if (walletBalance <= 0) {
            console.log('ℹ️ Reason: Split payment option is hidden because your wallet balance is $0.00.');
        } else if (walletBalance >= totalAmount) {
            console.log(`ℹ️ Reason: Split payment option is hidden because your wallet balance is enough to pay the full amount.`);
        } else {
            console.log('✅ Info: Split payment option should be visible.');
        }

    } catch (error) {
        console.error('❌ Script error:', error);
    }
}

checkBalance(); 