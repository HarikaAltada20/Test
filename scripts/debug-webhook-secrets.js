const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function debugWebhookSecrets() {
    console.log('🔍 Debugging Webhook Secret Configuration...\n');

    // 1. Check environment variables
    console.log('1. Environment Variables:');
    console.log('   STRIPE_SUBSCRIPTION_WEBHOOK_SECRET:', process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET ? `Set (${process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET.substring(0, 10)}...)` : 'NOT SET');
    console.log('   STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET ? `Set (${process.env.STRIPE_WEBHOOK_SECRET.substring(0, 10)}...)` : 'NOT SET');

    // 2. Check which secret is being used
    const endpointSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    console.log('\n2. Active Webhook Secret:');
    if (endpointSecret) {
        console.log(`   Using: ${endpointSecret.substring(0, 10)}...`);
        console.log(`   Source: ${process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET ? 'STRIPE_SUBSCRIPTION_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET'}`);
    } else {
        console.log('   ❌ NO WEBHOOK SECRET CONFIGURED!');
    }

    // 3. Check webhook endpoint URL
    console.log('\n3. Webhook Endpoint Configuration:');
    console.log('   Expected URL: http://localhost:3000/api/subscriptions/webhook');
    console.log('   Current Environment:', process.env.NODE_ENV || 'development');

    // 4. Common issues and solutions
    console.log('\n4. Common Webhook Signature Issues:');
    console.log('   ❌ Multiple webhook endpoints in Stripe with different secrets');
    console.log('   ❌ Wrong environment (test vs live mode)');
    console.log('   ❌ Copied secret from wrong webhook endpoint');
    console.log('   ❌ Secret includes extra characters (spaces, quotes)');

    console.log('\n🔧 Troubleshooting Steps:');
    console.log('   1. Go to Stripe Dashboard → Developers → Webhooks');
    console.log('   2. Check webhook endpoint: http://localhost:3000/api/subscriptions/webhook');
    console.log('   3. Copy the EXACT webhook secret (whsec_...)');
    console.log('   4. Make sure you\'re in TEST mode (not live mode)');
    console.log('   5. Ensure no extra spaces/quotes in .env file');

    console.log('\n📋 Webhook Events That Should Be Enabled:');
    console.log('   - customer.subscription.created');
    console.log('   - customer.subscription.updated');
    console.log('   - customer.subscription.deleted');
    console.log('   - checkout.session.completed');
    console.log('   - invoice.payment_succeeded');
    console.log('   - invoice.payment_failed');

    // 5. Test webhook secret format
    console.log('\n5. Webhook Secret Validation:');
    if (endpointSecret) {
        if (endpointSecret.startsWith('whsec_')) {
            console.log('   ✅ Secret format looks correct (starts with whsec_)');
        } else {
            console.log('   ❌ Secret format is wrong (should start with whsec_)');
        }

        if (endpointSecret.length >= 32) {
            console.log('   ✅ Secret length looks reasonable');
        } else {
            console.log('   ❌ Secret seems too short');
        }
    }

    console.log('\n🚀 Quick Fix Instructions:');
    console.log('   1. Open Stripe Dashboard: https://dashboard.stripe.com/test/webhooks');
    console.log('   2. Find webhook for: http://localhost:3000/api/subscriptions/webhook');
    console.log('   3. Click "Reveal" next to signing secret');
    console.log('   4. Copy the EXACT secret (whsec_...)');
    console.log('   5. Update .env file:');
    console.log('      STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_your_exact_secret_here');
    console.log('   6. Restart your development server');
    console.log('   7. Try the subscription upgrade again');
}

debugWebhookSecrets(); 