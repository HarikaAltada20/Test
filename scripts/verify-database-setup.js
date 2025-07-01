// Verify database setup for payment system
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDatabaseSetup() {
    console.log('🔍 Verifying database setup for payment system...\n');

    try {
        // Check advertiser_profiles table structure
        const { data: advertiserColumns, error: advertiserError } = await supabase
            .rpc('exec_sql', {
                sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'advertiser_profiles' 
          AND column_name = 'available_deposit_balance'
        `
            });

        if (advertiserError) {
            console.error('❌ Error checking advertiser_profiles:', advertiserError);
        } else if (advertiserColumns && advertiserColumns.length > 0) {
            console.log('✅ advertiser_profiles.available_deposit_balance column exists');
        } else {
            console.log('❌ advertiser_profiles.available_deposit_balance column NOT found');
        }

        // Check money_transactions table
        const { data: transactionCheck, error: transactionError } = await supabase
            .from('money_transactions')
            .select('*')
            .limit(1);

        if (transactionError) {
            console.log('❌ money_transactions table NOT found:', transactionError.message);
        } else {
            console.log('✅ money_transactions table exists');
        }

        // Test transaction insert (and rollback)
        const testUserId = '00000000-0000-0000-0000-000000000000';
        const { error: insertError } = await supabase
            .from('money_transactions')
            .insert({
                user_id: testUserId,
                type: 'deposit',
                status: 'pending',
                amount: 1.00,
                description: 'Test transaction'
            });

        if (insertError) {
            console.log('❌ Cannot insert into money_transactions:', insertError.message);
        } else {
            console.log('✅ money_transactions insert permissions working');

            // Clean up test transaction
            await supabase
                .from('money_transactions')
                .delete()
                .eq('user_id', testUserId);
        }

    } catch (error) {
        console.error('❌ Database verification failed:', error);
    }

    console.log('\n🎯 Next steps:');
    console.log('1. Run the SQL scripts in Supabase if any ❌ errors above');
    console.log('2. Restart your Next.js app');
    console.log('3. Test wallet top-up again');
}

verifyDatabaseSetup(); 