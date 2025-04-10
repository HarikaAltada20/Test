/**
 * This script updates Supabase views and functions
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateViews() {
    try {
        console.log('Starting DB view updates...');

        // Read the SQL file
        const contestViewsSql = fs.readFileSync(
            path.join(__dirname, '../sql/contest_views.sql'),
            'utf8'
        );

        // Split SQL into statements
        const statements = contestViewsSql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

        // Execute each statement
        for (const stmt of statements) {
            console.log(`Executing SQL: ${stmt.substring(0, 50)}...`);

            try {
                // Execute the SQL directly
                const { data, error } = await supabase.rpc('exec_sql', {
                    sql_query: stmt
                });

                if (error) {
                    console.warn(`Warning executing statement: ${error.message}`);
                    console.log('Trying alternative approach...');

                    // If the function doesn't exist, create it first
                    if (error.message.includes('Could not find the function')) {
                        console.log('Creating exec_sql function first...');
                        const createFuncSQL = fs.readFileSync(
                            path.join(__dirname, '../sql/create_exec_sql_function.sql'),
                            'utf8'
                        );

                        // Note: This is a direct SQL execution which may not work
                        // You'll likely need to execute this in the SQL editor manually
                        console.log('Please execute the following SQL in Supabase SQL Editor:');
                        console.log(createFuncSQL);

                        console.log('\nThen run this script again or execute the following SQL:');
                        console.log(contestViewsSql);
                    }
                } else {
                    console.log('SQL executed successfully');
                }
            } catch (execError) {
                console.warn(`Error executing statement: ${execError.message}`);
            }
        }

        console.log('Database view update process completed. Check the logs for any warnings or errors.');
    } catch (error) {
        console.error('Error updating DB views:', error);
        process.exit(1);
    }
}

updateViews(); 