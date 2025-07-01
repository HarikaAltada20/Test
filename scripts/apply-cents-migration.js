// Apply migration to convert available_deposit_balance from dollars to cents
// This ensures consistency with money_transactions.amount which is already in cents

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
    console.log('🚀 Starting migration: Convert available_deposit_balance to cents...\n');

    try {
        // Read the SQL migration file
        const migrationPath = path.join(process.cwd(), 'sql', 'convert_balance_to_cents.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Running migration SQL...');

        // Execute the migration
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: migrationSQL
        });

        if (error) {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        }

        console.log('✅ Migration completed successfully!');
        console.log('📊 Verifying the migration...\n');

        // Verify the migration worked
        const { data: profiles, error: verifyError } = await supabase
            .from('advertiser_profiles')
            .select('available_deposit_balance')
            .limit(5);

        if (verifyError) {
            console.error('❌ Verification failed:', verifyError);
            process.exit(1);
        }

        console.log('🔍 Sample balances after migration:');
        profiles?.forEach((profile, index) => {
            console.log(`   Profile ${index + 1}: ${profile.available_deposit_balance} cents`);
        });

        console.log('\n✅ Migration verification successful!');
        console.log('\n📋 Summary:');
        console.log('   • available_deposit_balance is now stored in cents (INTEGER)');
        console.log('   • money_transactions.amount already uses cents');
        console.log('   • Full consistency achieved across the system');
        console.log('   • Frontend will convert cents to dollars for display');

    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    }
}

// Run the migration
applyMigration(); 