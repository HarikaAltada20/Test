const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateConstraints() {
    console.log('🔧 Updating money_transactions table constraints...\n');

    try {
        // Check current constraints
        const { data: currentData, error: fetchError } = await supabase
            .from('money_transactions')
            .select('type, status')
            .limit(1);

        if (fetchError) {
            console.log('⚠️  Error fetching from money_transactions:', fetchError.message);
            console.log('This might indicate constraint issues. Proceeding with updates...\n');
        }

        // Apply constraint updates using RPC
        const constraintSQL = `
            -- Drop existing constraints
            ALTER TABLE money_transactions DROP CONSTRAINT IF EXISTS money_transactions_type_check;
            ALTER TABLE money_transactions DROP CONSTRAINT IF EXISTS money_transactions_status_check;

            -- Add updated constraints with all required types
            ALTER TABLE money_transactions ADD CONSTRAINT money_transactions_type_check 
            CHECK (type = ANY (ARRAY['deposit'::text, 'contest_payment'::text, 'refund'::text, 'withdrawal'::text, 'reward'::text]));

            ALTER TABLE money_transactions ADD CONSTRAINT money_transactions_status_check 
            CHECK (status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'cancelled'::text]));

            -- Ensure currency column exists
            ALTER TABLE money_transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

            -- Ensure withdrawal_request_id column exists
            ALTER TABLE money_transactions ADD COLUMN IF NOT EXISTS withdrawal_request_id UUID;
        `;

        console.log('📝 Applying constraint updates...');
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: constraintSQL
        });

        if (error) {
            console.error('❌ Failed to update constraints:', error);
            console.log('💡 You may need to run this SQL manually in your database:');
            console.log(constraintSQL);
            process.exit(1);
        }

        console.log('✅ Constraints updated successfully!');

        // Test inserting a sample transaction
        const testTransaction = {
            user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID for test
            type: 'contest_payment',
            status: 'pending',
            amount: 1000, // 1000 cents = $10.00
            description: 'Test transaction to verify constraints',
            currency: 'USD'
        };

        console.log('\n🧪 Testing constraint updates with sample transaction...');
        const { data: insertData, error: insertError } = await supabase
            .from('money_transactions')
            .insert(testTransaction)
            .select()
            .single();

        if (insertError) {
            console.error('❌ Test insert failed:', insertError);
            console.log('💡 The constraint updates may not have been applied correctly.');
        } else {
            console.log('✅ Test insert successful! Constraints are working.');

            // Clean up test transaction
            await supabase
                .from('money_transactions')
                .delete()
                .eq('id', insertData.id);
            console.log('🧹 Test transaction cleaned up.');
        }

        console.log('\n📋 Summary:');
        console.log('   • Transaction types: deposit, contest_payment, refund, withdrawal, reward');
        console.log('   • Transaction statuses: pending, success, failed, cancelled');
        console.log('   • Amount storage: INTEGER (cents)');
        console.log('   • Currency column: Available');
        console.log('   • Ready for payment processing!');

    } catch (error) {
        console.error('❌ Error updating constraints:', error);
        process.exit(1);
    }
}

updateConstraints(); 