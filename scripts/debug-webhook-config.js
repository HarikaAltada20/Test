#!/usr/bin/env node

/**
 * Webhook Configuration Debug Script
 * Run this to check if your webhook environment variables are configured correctly
 */

console.log('🔍 Webhook Configuration Debug');
console.log('==============================\n');

// Check environment variables
const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
];

console.log('📋 Environment Variables Check:');
requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
        const masked = value.substring(0, 10) + '...' + value.substring(value.length - 4);
        console.log(`✅ ${envVar}: ${masked}`);
    } else {
        console.log(`❌ ${envVar}: NOT SET`);
    }
});

console.log('\n🚀 Next Steps:');
console.log('1. Make sure STRIPE_WEBHOOK_SECRET is set in Vercel environment variables');
console.log('2. The webhook secret should start with "whsec_"');
console.log('3. In Stripe Dashboard > Webhooks, make sure your webhook endpoint is:');
console.log('   https://your-domain.com/api/payments/webhook');
console.log('4. Required events: payment_intent.succeeded, payment_intent.payment_failed');

// If this is running in production, show additional info
if (process.env.NODE_ENV === 'production') {
    console.log('\n⚠️  PRODUCTION ENVIRONMENT DETECTED');
    console.log('Make sure your Stripe webhook endpoint is pointing to your production URL');
}

console.log('\n📖 Webhook Debugging Tips:');
console.log('- Check Vercel deployment logs for webhook errors');
console.log('- Use Stripe CLI: stripe logs --filter-type webhook');
console.log('- Check Stripe Dashboard > Webhooks > View Events for delivery status');
console.log('- Webhook events can take 1-10 seconds to process'); 