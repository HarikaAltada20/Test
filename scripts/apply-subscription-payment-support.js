// Script to apply subscription payment support to money_transactions table
const { createClient } = require('@supabase/supabase-js');

async function applySubscriptionPaymentSupport() {
    try {
        console.log('🚀 Applying subscription payment support to money_transactions table...');

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Read the SQL migration file
        const fs = require('fs');
        const path = require('path');
        const sqlPath = path.join(__dirname, '../sql/add_subscription_payment_support.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📝 Executing SQL migration...');

        // Execute the SQL using RPC
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: sql
        });

        if (error) {
            console.error('❌ Failed to apply subscription payment support:', error);
            console.log('💡 You may need to run this SQL manually in your database:');
            console.log(sql);
            process.exit(1);
        }

        console.log('✅ Subscription payment support applied successfully!');
        console.log('📊 Changes applied:');
        console.log('   - Added metadata JSONB column');
        console.log('   - Added stripe_invoice_id column');
        console.log('   - Added stripe_subscription_id column');
        console.log('   - Added subscription_payment type');
        console.log('   - Added completed status');
        console.log('   - Created performance indexes');
        console.log('   - Updated type and status constraints');

        // Test inserting a sample subscription payment transaction
        console.log('\n🧪 Testing subscription payment transaction insertion...');

        const testTransaction = {
            user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID for test
            type: 'subscription_payment',
            status: 'completed',
            amount: 50000, // $500.00 in cents
            description: 'Test subscription payment',
            currency: 'USD',
            payment_intent_id: 'pi_test_123',
            stripe_invoice_id: 'in_test_123',
            stripe_subscription_id: 'sub_test_123',
            remarks: 'Test subscription payment for CHAMPION plan',
            payment_method: 'stripe',
            metadata: {
                product_name: 'CHAMPION',
                subscription_status: 'active',
                billing_period_start: '2025-07-29T00:00:00.000Z',
                billing_period_end: '2025-08-29T00:00:00.000Z',
                invoice_number: 'TEST-001',
                subscription_plan: 'CHAMPION',
                webhook_source: 'subscription_webhook',
                test: true
            }
        };

        const { data: testData, error: testError } = await supabase
            .from('money_transactions')
            .insert(testTransaction)
            .select()
            .single();

        if (testError) {
            console.error('❌ Test transaction insertion failed:', testError);
            console.log('💡 The database changes may not have been applied correctly');
            process.exit(1);
        }

        console.log('✅ Test transaction inserted successfully:', testData.id);

        // Clean up test data
        await supabase
            .from('money_transactions')
            .delete()
            .eq('id', testData.id);

        console.log('🧹 Test data cleaned up');
        console.log('\n🎉 Subscription payment support is ready to use!');

    } catch (error) {
        console.error('❌ Error applying subscription payment support:', error);
        process.exit(1);
    }
}

// Run the script
applySubscriptionPaymentSupport();