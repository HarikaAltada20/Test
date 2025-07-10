const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const testConfig = {
    userId: '88a148a2-0e98-4bad-8e56-8a4e335650df',
    customerId: 'cus_SedSw0vpYMNdky',
    builderPriceId: 'price_1RicxUDCKN2LN0Qe3f13Nmel',
    championPriceId: 'price_1RicxVDCKN2LN0QeBCrXKWR7'
};

console.log('🔍 DEBUGGING SCHEDULED UPGRADE ISSUE');
console.log('===================================\n');

async function step1_CheckStripeSubscriptions() {
    console.log('1️⃣  STRIPE SUBSCRIPTION STATUS');
    console.log('─────────────────────────────────');
    console.log('🔍 Please run this command and share the output:');
    console.log('   stripe subscriptions list --customer cus_SedSw0vpYMNdky\n');

    console.log('📋 What to look for:');
    console.log('   ✅ Active subscription with BUILDER or CHAMPION price');
    console.log('   ⚠️  Status should be "active", not "incomplete" or "past_due"');
    console.log('   ⚠️  Check if there are multiple subscriptions (old + new)');
    console.log('   ⚠️  Look for "default_payment_method" - should not be null\n');

    return true;
}

async function step2_CheckDatabaseState() {
    console.log('2️⃣  DATABASE SUBSCRIPTION STATUS');
    console.log('───────────────────────────────────');

    try {
        // Check advertiser_profiles subscription_info
        const { data: profileData, error: profileError } = await supabase
            .from('advertiser_profiles')
            .select('subscription_info')
            .eq('id', testConfig.userId)
            .single();

        if (profileError) {
            console.log('❌ Error fetching profile:', profileError);
            return false;
        }

        console.log('📊 Current subscription_info in database:');
        console.log(JSON.stringify(profileData.subscription_info, null, 2));

        // Check subscriptions table
        const { data: subscriptions, error: subError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', testConfig.userId)
            .order('created', { ascending: false });

        if (subError) {
            console.log('❌ Error fetching subscriptions:', subError);
        } else {
            console.log('\n📋 Subscriptions in database:');
            subscriptions.forEach((sub, index) => {
                console.log(`   ${index + 1}. ID: ${sub.id}`);
                console.log(`      Status: ${sub.status}`);
                console.log(`      Price ID: ${sub.price_id}`);
                console.log(`      Period: ${sub.current_period_start} → ${sub.current_period_end}`);
                console.log(`      Created: ${sub.created}\n`);
            });
        }

        return true;
    } catch (error) {
        console.error('❌ Database check failed:', error);
        return false;
    }
}

async function step3_DiagnoseOverdueIssue() {
    console.log('3️⃣  DIAGNOSING "OVERDUE" ISSUE');
    console.log('─────────────────────────────');

    console.log('🚨 "Overdue" status usually means:');
    console.log('   1. New subscription created but payment failed');
    console.log('   2. Subscription is in "past_due" or "incomplete" status');
    console.log('   3. Payment method not attached or invalid');
    console.log('   4. Webhook failed to update database properly\n');

    console.log('🔍 DEBUGGING STEPS:');
    console.log('   A. Check Stripe subscription status (run command above)');
    console.log('   B. Check payment method attached to customer');
    console.log('   C. Look for failed payment intents');
    console.log('   D. Verify webhook processing\n');

    console.log('📝 Additional Stripe commands to run:');
    console.log('   stripe customers retrieve cus_SedSw0vpYMNdky');
    console.log('   stripe payment_intents list --customer cus_SedSw0vpYMNdky --limit 5');
    console.log('   stripe invoices list --customer cus_SedSw0vpYMNdky --limit 5\n');
}

async function step4_FixStrategies() {
    console.log('4️⃣  FIX STRATEGIES');
    console.log('─────────────────');

    console.log('🔧 STRATEGY A: Manual Payment Collection');
    console.log('   If subscription exists but payment failed:');
    console.log('   1. Find the latest invoice');
    console.log('   2. Retry payment collection via Stripe Dashboard');
    console.log('   3. Update payment method if needed\n');

    console.log('🔧 STRATEGY B: Database Sync Fix');
    console.log('   If Stripe is fine but database is wrong:');
    console.log('   1. Get correct subscription ID from Stripe');
    console.log('   2. Run manual sync script');
    console.log('   3. Update advertiser_profiles.subscription_info\n');

    console.log('🔧 STRATEGY C: Clean Restart');
    console.log('   If everything is broken:');
    console.log('   1. Cancel problematic subscriptions in Stripe');
    console.log('   2. Reset user to free plan in database');
    console.log('   3. Create fresh subscription via your app\n');

    return true;
}

async function step5_CreateSyncScript() {
    console.log('5️⃣  SYNC SCRIPT GENERATOR');
    console.log('─────────────────────────');

    console.log('📝 After you run the Stripe commands above, update this script:');
    console.log('   1. Find the correct subscription ID');
    console.log('   2. Check its status and price_id');
    console.log('   3. Run the sync script below\n');

    console.log('💾 Manual sync template:');
    console.log(`
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function syncCorrectSubscription() {
  // REPLACE THESE VALUES with correct ones from Stripe
  const subscriptionId = 'sub_REPLACE_WITH_CORRECT_ID';
  const priceId = 'price_REPLACE_WITH_CORRECT_PRICE';
  const status = 'active'; // or whatever the real status is
  
  if (subscriptionId.includes('REPLACE')) {
    console.log('❌ Please update the subscription ID first!');
    return;
  }
  
  // Update subscriptions table
  const { error: subError } = await supabase
    .from('subscriptions')
    .upsert({
      id: subscriptionId,
      user_id: '${testConfig.userId}',
      status: status,
      price_id: priceId,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
      cancel_at_period_end: false
    });
  
  if (subError) {
    console.error('❌ Subscription sync error:', subError);
    return;
  }
  
  // Update advertiser_profiles
  const productId = priceId === '${testConfig.builderPriceId}' ? 'prod_SdunoupDPLZfkU' : 'prod_SeewOgTx6EqxYn';
  const { error: profileError } = await supabase
    .from('advertiser_profiles')
    .update({
      subscription_info: {
        product_id: productId,
        price_id: priceId,
        subscription_id: subscriptionId,
        last_synced: new Date().toISOString()
      }
    })
    .eq('id', '${testConfig.userId}');
  
  if (profileError) {
    console.error('❌ Profile sync error:', profileError);
    return;
  }
  
  console.log('✅ Manual sync completed!');
  console.log('🔗 Check: http://localhost:3000/dashboard/billing');
}

syncCorrectSubscription();
  `);
}

async function runDiagnostics() {
    console.log('🚀 Starting comprehensive diagnostics...\n');

    await step1_CheckStripeSubscriptions();
    await step2_CheckDatabaseState();
    await step3_DiagnoseOverdueIssue();
    await step4_FixStrategies();
    await step5_CreateSyncScript();

    console.log('📋 NEXT STEPS:');
    console.log('─────────────');
    console.log('1. Run the Stripe commands shown above');
    console.log('2. Share the output with me');
    console.log('3. Based on results, we\'ll pick the right fix strategy');
    console.log('4. Execute the fix and verify success\n');

    console.log('🎯 GOAL: Get you to CHAMPION plan with working billing');
    console.log('💡 The scheduled upgrade DID work - we just need to fix the sync!\n');
}

runDiagnostics();

