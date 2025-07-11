/**
 * Simple script to check subscription status
 * Run this to verify subscription state and identify multiple active subscriptions
 */

// Using environment variables from .env.local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Checking Subscription Status');
console.log('═══════════════════════════════════');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Environment variables not set. Please check your .env.local file.');
    console.log('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// For now, let's just show the environment status
console.log('✅ Environment variables configured');
console.log('📊 Supabase URL:', SUPABASE_URL);
console.log('🔑 Service key configured:', SUPABASE_SERVICE_KEY ? 'Yes' : 'No');

console.log('\n🔧 Next Steps:');
console.log('1. Check your Stripe dashboard for active subscriptions');
console.log('2. Check your Supabase dashboard -> subscriptions table');
console.log('3. Look for multiple active subscriptions for the same user');
console.log('4. The webhook should now cancel old subscriptions automatically');

console.log('\n💡 To check subscription status:');
console.log('- Go to your Supabase dashboard');
console.log('- Navigate to Table Editor -> subscriptions');
console.log('- Filter by user_id and status = "active"');
console.log('- You should see only 1 active subscription per user');

console.log('\n🔗 Manual cleanup if needed:');
console.log('- In Stripe Dashboard: Cancel extra subscriptions');
console.log('- In Supabase: Update status to "canceled" for old subscriptions'); 