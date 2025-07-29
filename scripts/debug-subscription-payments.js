const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugSubscriptionPayments() {
    console.log('🔍 Debugging Subscription Payments...\n');

    try {
        // 1. Check active subscriptions
        console.log('📊 Checking active subscriptions...');
        const { data: subscriptions, error: subError } = await supabase
            .from('subscriptions')
            .select('*')
            .in('status', ['active', 'trialing', 'past_due'])
            .order('created', { ascending: false });

        if (subError) {
            console.error('❌ Error fetching subscriptions:', subError);
        } else {
            console.log(`✅ Found ${subscriptions.length} active subscriptions:`);
            subscriptions.forEach(sub => {
                console.log(`   - ID: ${sub.id}`);
                console.log(`     User: ${sub.user_id}`);
                console.log(`     Status: ${sub.status}`);
                console.log(`     Price ID: ${sub.price_id}`);
                console.log(`     Created: ${sub.created}`);
                console.log('');
            });
        }

        // 2. Check money transactions for subscription payments
        console.log('💰 Checking money transactions for subscription payments...');
        const { data: transactions, error: transError } = await supabase
            .from('money_transactions')
            .select('*')
            .in('type', ['subscription_payment', 'subscription_refund'])
            .order('created_at', { ascending: false });

        if (transError) {
            console.error('❌ Error fetching transactions:', transError);
        } else {
            console.log(`✅ Found ${transactions.length} subscription-related transactions:`);
            transactions.forEach(trans => {
                console.log(`   - ID: ${trans.id}`);
                console.log(`     Type: ${trans.type}`);
                console.log(`     Amount: ${trans.amount} cents ($${(trans.amount / 100).toFixed(2)})`);
                console.log(`     Status: ${trans.status}`);
                console.log(`     Description: ${trans.description}`);
                console.log(`     Created: ${trans.created_at}`);
                console.log('');
            });
        }

        // 3. Check advertiser profiles for subscription info
        console.log('👤 Checking advertiser profiles for subscription info...');
        const { data: profiles, error: profileError } = await supabase
            .from('advertiser_profiles')
            .select('id, subscription_info')
            .not('subscription_info', 'is', null);

        if (profileError) {
            console.error('❌ Error fetching profiles:', profileError);
        } else {
            console.log(`✅ Found ${profiles.length} profiles with subscription info:`);
            profiles.forEach(profile => {
                console.log(`   - User ID: ${profile.id}`);
                console.log(`     Subscription Info:`, JSON.stringify(profile.subscription_info, null, 2));
                console.log('');
            });
        }

        // 4. Check webhook errors
        console.log('🚨 Checking webhook errors...');
        const { data: webhookErrors, error: webhookError } = await supabase
            .from('webhook_errors')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (webhookError) {
            console.log('⚠️ No webhook_errors table found or error fetching errors');
        } else {
            console.log(`✅ Found ${webhookErrors.length} recent webhook errors:`);
            webhookErrors.forEach(error => {
                console.log(`   - Event Type: ${error.event_type}`);
                console.log(`     Error: ${error.error_message}`);
                console.log(`     Created: ${error.created_at}`);
                console.log('');
            });
        }

        // 5. Summary and recommendations
        console.log('📋 SUMMARY AND RECOMMENDATIONS:');
        console.log('================================');

        if (subscriptions && subscriptions.length > 0) {
            console.log(`✅ You have ${subscriptions.length} active subscriptions`);
        } else {
            console.log('❌ No active subscriptions found');
        }

        if (transactions && transactions.length > 0) {
            console.log(`✅ You have ${transactions.length} subscription payment transactions`);
        } else {
            console.log('❌ No subscription payment transactions found');
            console.log('');
            console.log('🔧 LIKELY ISSUES:');
            console.log('1. Stripe webhook not configured for invoice.payment_succeeded events');
            console.log('2. Webhook secret not properly set in environment variables');
            console.log('3. Webhook endpoint not accessible from Stripe');
            console.log('4. Database errors preventing transaction logging');
            console.log('');
            console.log('🔧 NEXT STEPS:');
            console.log('1. Check Stripe Dashboard → Developers → Webhooks');
            console.log('2. Ensure invoice.payment_succeeded is selected');
            console.log('3. Test webhook with Stripe dashboard');
            console.log('4. Check application logs for webhook processing');
            console.log('5. Verify environment variables are set correctly');
        }

    } catch (error) {
        console.error('❌ Error in debug script:', error);
    }
}

// Run the debug function
debugSubscriptionPayments()
    .then(() => {
        console.log('✅ Debug script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Debug script failed:', error);
        process.exit(1);
    });