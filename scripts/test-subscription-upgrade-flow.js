/**
 * Test script to verify subscription upgrade flow
 * This script helps verify that the subscription system works correctly
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const testConfig = {
    userId: '88a148a2-0e98-4bad-8e56-8a4e335650df', // Replace with your test user ID
    oldProductId: 'prod_Sduka9mKXu35Ii', // EXPLORER (free)
    newProductId: 'prod_SdunoupDPLZfkU', // BUILDER (paid)
    newPriceId: 'price_1RicxUDCKN2LN0Qe3f13Nmel' // BUILDER price
};

async function testSubscriptionUpgradeFlow() {
    console.log('🧪 Testing Subscription Upgrade Flow');
    console.log('═══════════════════════════════════════');

    try {
        // Step 1: Check current subscription state
        console.log('1️⃣  Checking current subscription state...');
        const { data: currentProfile, error: profileError } = await supabase
            .from('advertiser_profiles')
            .select('subscription_info')
            .eq('id', testConfig.userId)
            .single();

        if (profileError) {
            console.error('❌ Error fetching profile:', profileError);
            return;
        }

        console.log('📊 Current subscription_info:');
        console.log(JSON.stringify(currentProfile.subscription_info, null, 2));

        // Step 2: Check if subscription data is correct
        const isCorrectPlan = currentProfile.subscription_info?.product_id === testConfig.newProductId;

        if (isCorrectPlan) {
            console.log('✅ Subscription upgrade completed successfully!');
            console.log(`📦 Current plan: ${currentProfile.subscription_info.product_id}`);
            console.log(`💰 Price ID: ${currentProfile.subscription_info.price_id}`);
            console.log(`🔗 Subscription ID: ${currentProfile.subscription_info.subscription_id}`);
            console.log(`🕐 Last synced: ${currentProfile.subscription_info.last_synced}`);
        } else {
            console.log('⚠️  Subscription upgrade not yet reflected in database');
            console.log(`Expected: ${testConfig.newProductId}`);
            console.log(`Current: ${currentProfile.subscription_info?.product_id}`);
        }

        // Step 3: Check subscriptions table for active subscriptions
        console.log('\n2️⃣  Checking subscriptions table...');
        const { data: subscriptions, error: subError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', testConfig.userId)
            .order('created', { ascending: false });

        if (subError) {
            console.error('❌ Error fetching subscriptions:', subError);
        } else {
            console.log(`📋 Found ${subscriptions.length} subscriptions:`);
            subscriptions.forEach((sub, index) => {
                console.log(`   ${index + 1}. ${sub.id} - ${sub.status} - ${sub.price_id}`);
            });
        }

        // Step 4: Test API endpoint
        console.log('\n3️⃣  Testing subscription API endpoint...');
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/subscriptions/current`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const apiResult = await response.json();
            console.log('✅ API endpoint working correctly');
            console.log('📊 API response:', JSON.stringify(apiResult, null, 2));
        } else {
            console.log('❌ API endpoint error:', response.status, response.statusText);
        }

        console.log('\n🎯 Test Summary:');
        console.log('─────────────────');
        console.log(`✅ Database access: Working`);
        console.log(`${isCorrectPlan ? '✅' : '❌'} Subscription upgrade: ${isCorrectPlan ? 'Completed' : 'Pending'}`);
        console.log(`${subscriptions && subscriptions.length > 0 ? '✅' : '❌'} Subscriptions table: ${subscriptions ? subscriptions.length + ' records' : 'Error'}`);
        console.log(`${response.ok ? '✅' : '❌'} API endpoint: ${response.ok ? 'Working' : 'Error'}`);

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testSubscriptionUpgradeFlow().catch(console.error); 