const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSubscriptionRLSPolicies() {
    console.log('🔧 Fixing Subscription Table RLS Policies...\n');

    try {
        // 1. Check current RLS status
        console.log('1. Checking current RLS policies for subscriptions table...');
        const { data: currentPolicies, error: policiesError } = await supabase.rpc('exec_sql', {
            sql: `
                SELECT schemaname, tablename, policyname, roles, cmd, qual 
                FROM pg_policies 
                WHERE tablename = 'subscriptions'
                ORDER BY cmd, policyname;
            `
        });

        if (policiesError) {
            console.log('   Could not fetch current policies (exec_sql not available)');
        } else if (currentPolicies && currentPolicies.length > 0) {
            console.log('   Current policies:');
            currentPolicies.forEach(policy => {
                console.log(`   - ${policy.policyname} (${policy.cmd}) for ${policy.roles}`);
            });
        } else {
            console.log('   No policies found or exec_sql not available');
        }

        // 2. Add missing service role policies via SQL
        console.log('\n2. Adding missing service role policies...');

        const sqlCommands = [
            // Allow service role to SELECT all subscriptions (webhooks need to find existing subscriptions)
            `CREATE POLICY "Service role can view all subscriptions" 
             ON subscriptions FOR SELECT 
             TO service_role 
             USING (true);`,

            // Allow service role to INSERT subscriptions (webhooks need to create new subscriptions)
            `CREATE POLICY "Service role can insert subscriptions" 
             ON subscriptions FOR INSERT 
             TO service_role 
             WITH CHECK (true);`,

            // Allow service role to UPDATE subscriptions (webhooks need to update subscription status)
            `CREATE POLICY "Service role can update subscriptions" 
             ON subscriptions FOR UPDATE 
             TO service_role 
             USING (true);`,

            // Allow service role to DELETE subscriptions (for cancellations)
            `CREATE POLICY "Service role can delete subscriptions" 
             ON subscriptions FOR DELETE 
             TO service_role 
             USING (true);`
        ];

        for (const sql of sqlCommands) {
            console.log(`   Executing: ${sql.split('\n')[0]}...`);
            const { error } = await supabase.rpc('exec_sql', { sql });

            if (error) {
                if (error.message.includes('already exists')) {
                    console.log('     ✅ Policy already exists, skipping');
                } else {
                    console.error(`     ❌ Error: ${error.message}`);
                }
            } else {
                console.log('     ✅ Policy created successfully');
            }
        }

        // 3. Also ensure table-level permissions are granted
        console.log('\n3. Ensuring table-level permissions for service_role...');
        const grantSQL = `GRANT ALL ON subscriptions TO service_role;`;

        const { error: grantError } = await supabase.rpc('exec_sql', { sql: grantSQL });
        if (grantError) {
            console.log(`   Could not grant permissions via exec_sql: ${grantError.message}`);
            console.log('   You may need to run this manually in Supabase SQL editor:');
            console.log(`   ${grantSQL}`);
        } else {
            console.log('   ✅ Table permissions granted to service_role');
        }

        // 4. Test access
        console.log('\n4. Testing service role access...');
        const { data: testData, error: testError } = await supabase
            .from('subscriptions')
            .select('id, user_id, status')
            .limit(1);

        if (testError) {
            console.error(`   ❌ Test failed: ${testError.message}`);
        } else {
            console.log(`   ✅ Service role can read subscriptions (found ${testData?.length || 0} records)`);
        }

        console.log('\n🎉 RLS Policies Fixed!');
        console.log('\n📋 What was added:');
        console.log('   ✅ Service role can SELECT all subscriptions');
        console.log('   ✅ Service role can INSERT new subscriptions');
        console.log('   ✅ Service role can UPDATE subscription status');
        console.log('   ✅ Service role can DELETE canceled subscriptions');
        console.log('\n🚀 Next steps:');
        console.log('   1. Try the subscription upgrade flow again');
        console.log('   2. Check webhook logs - should see successful subscription creation');
        console.log('   3. Verify database gets updated with new subscription');

    } catch (error) {
        console.error('❌ Script failed:', error);
        console.log('\n🔧 Manual fix required:');
        console.log('   Run these commands in Supabase SQL Editor:');
        console.log(`
-- Add service role policies for subscriptions table
CREATE POLICY "Service role can view all subscriptions" 
ON subscriptions FOR SELECT TO service_role USING (true);

CREATE POLICY "Service role can insert subscriptions" 
ON subscriptions FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update subscriptions" 
ON subscriptions FOR UPDATE TO service_role USING (true);

CREATE POLICY "Service role can delete subscriptions" 
ON subscriptions FOR DELETE TO service_role USING (true);

-- Ensure table permissions
GRANT ALL ON subscriptions TO service_role;
        `);
    }
}

fixSubscriptionRLSPolicies(); 