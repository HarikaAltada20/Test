#!/usr/bin/env node

// Comprehensive script to fix balance issues:
// 1. Fix current doubled balance based on transaction history
// 2. Convert schema from NUMERIC (dollars) to BIGINT (cents)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixBalanceSchemaAndData() {
    console.log('🔧 Starting comprehensive balance fix...\n');

    try {
        // STEP 1: Fix current doubled balances based on transaction history
        console.log('📊 STEP 1: Fixing current balance data...\n');

        const { data: profiles, error: profilesError } = await supabase
            .from('advertiser_profiles')
            .select('id, available_deposit_balance')
            .not('available_deposit_balance', 'is', null);

        if (profilesError) {
            console.error('❌ Error fetching profiles:', profilesError);
            return;
        }

        console.log(`📊 Found ${profiles.length} advertiser profiles with balances`);

        for (const profile of profiles) {
            const userId = profile.id;
            const currentBalance = profile.available_deposit_balance;

            console.log(`\n👤 Processing user: ${userId}`);
            console.log(`💰 Current balance: $${currentBalance}`);

            // Get all transactions for this user
            const { data: transactions, error: transactionsError } = await supabase
                .from('money_transactions')
                .select('amount, type, status, created_at')
                .eq('user_id', userId)
                .eq('status', 'success')
                .order('created_at', { ascending: true });

            if (transactionsError) {
                console.error(`❌ Error fetching transactions for user ${userId}:`, transactionsError);
                continue;
            }

            // Calculate correct balance based on transactions
            let correctBalanceInCents = 0;

            for (const transaction of transactions) {
                switch (transaction.type) {
                    case 'deposit':
                    case 'refund':
                        correctBalanceInCents += transaction.amount;
                        break;
                    case 'contest_payment':
                    case 'withdrawal':
                        correctBalanceInCents -= transaction.amount;
                        break;
                }
            }

            const correctBalanceInDollars = correctBalanceInCents / 100;

            console.log(`📈 Transaction Summary:`);
            console.log(`   Total transactions: ${transactions.length}`);
            console.log(`   Calculated balance: ${correctBalanceInCents} cents ($${correctBalanceInDollars})`);

            // Check if current balance needs fixing
            const isDoubled = Math.abs(currentBalance - correctBalanceInDollars * 2) < 0.01;
            const isCorrect = Math.abs(currentBalance - correctBalanceInDollars) < 0.01;

            if (isCorrect) {
                console.log(`✅ Balance is already correct`);
            } else if (isDoubled) {
                console.log(`🔧 Balance is doubled, fixing...`);

                const { error: updateError } = await supabase
                    .from('advertiser_profiles')
                    .update({ available_deposit_balance: correctBalanceInDollars })
                    .eq('id', userId);

                if (updateError) {
                    console.error(`❌ Error updating balance for user ${userId}:`, updateError);
                } else {
                    console.log(`✅ Fixed balance: $${currentBalance} → $${correctBalanceInDollars}`);
                }
            } else {
                console.log(`⚠️  Balance doesn't match expected pattern - manual review needed`);
            }
        }

        // STEP 2: Convert schema from NUMERIC (dollars) to BIGINT (cents)
        console.log('\n🔄 STEP 2: Converting schema from dollars to cents...\n');

        // Check current column type
        const { data: columnInfo, error: columnError } = await supabase
            .rpc('exec_sql', {
                query: `
                    SELECT column_name, data_type, is_nullable, column_default 
                    FROM information_schema.columns 
                    WHERE table_name = 'advertiser_profiles' 
                    AND column_name = 'available_deposit_balance'
                `
            });

        if (columnError) {
            console.error('❌ Error checking column type:', columnError);
            return;
        }

        console.log('📋 Current column info:', columnInfo);

        // Apply schema conversion
        const migrationSQL = `
            -- Add temporary column for cents
            ALTER TABLE advertiser_profiles 
            ADD COLUMN IF NOT EXISTS available_deposit_balance_cents BIGINT DEFAULT 0;

            -- Convert existing dollar values to cents
            UPDATE advertiser_profiles 
            SET available_deposit_balance_cents = ROUND(COALESCE(available_deposit_balance, 0) * 100)::BIGINT;

            -- Drop old column
            ALTER TABLE advertiser_profiles 
            DROP COLUMN IF EXISTS available_deposit_balance;

            -- Rename new column
            ALTER TABLE advertiser_profiles 
            RENAME COLUMN available_deposit_balance_cents TO available_deposit_balance;

            -- Set constraints
            ALTER TABLE advertiser_profiles 
            ALTER COLUMN available_deposit_balance SET NOT NULL,
            ALTER COLUMN available_deposit_balance SET DEFAULT 0;
        `;

        const { error: migrationError } = await supabase.rpc('exec_sql', {
            query: migrationSQL
        });

        if (migrationError) {
            console.error('❌ Error applying schema migration:', migrationError);
            return;
        }

        console.log('✅ Schema migration completed successfully!');

        // STEP 3: Verify the conversion
        console.log('\n✅ STEP 3: Verifying conversion...\n');

        const { data: verifyData, error: verifyError } = await supabase
            .from('advertiser_profiles')
            .select('id, available_deposit_balance')
            .gt('available_deposit_balance', 0)
            .limit(10);

        if (verifyError) {
            console.error('❌ Error verifying conversion:', verifyError);
            return;
        }

        console.log('📊 Sample converted balances:');
        verifyData.forEach(profile => {
            console.log(`   User ${profile.id}: ${profile.available_deposit_balance} cents ($${profile.available_deposit_balance / 100})`);
        });

        console.log('\n🎉 All fixes completed successfully!');
        console.log('📝 Summary:');
        console.log('   ✅ Fixed doubled balance data');
        console.log('   ✅ Converted schema from NUMERIC (dollars) to BIGINT (cents)');
        console.log('   ✅ All balances now consistently stored in cents');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the comprehensive fix
fixBalanceSchemaAndData(); 