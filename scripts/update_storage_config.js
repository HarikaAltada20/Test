/**
 * This script updates Supabase storage bucket configurations
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

async function updateStorageConfig() {
    try {
        console.log('Starting storage configuration updates...');

        // First try direct API approach
        try {
            console.log('Getting current bucket info...');
            const { data: bucketData, error: getBucketError } = await supabase
                .storage
                .getBucket('contest-assets');

            if (getBucketError) {
                if (getBucketError.message.includes('not found')) {
                    // Create bucket if it doesn't exist
                    console.log('Bucket not found, creating it...');
                    const { data: createData, error: createError } = await supabase
                        .storage
                        .createBucket('contest-assets', {
                            public: true,
                            fileSizeLimit: 20971520 // 20MB
                        });

                    if (createError) {
                        throw createError;
                    }
                    console.log('Bucket created successfully with 20MB file size limit');
                } else {
                    throw getBucketError;
                }
            } else {
                // Update existing bucket
                console.log('Updating existing bucket...');
                const { data: updateData, error: updateError } = await supabase
                    .storage
                    .updateBucket('contest-assets', {
                        public: true,
                        fileSizeLimit: 20971520 // 20MB
                    });

                if (updateError) {
                    throw updateError;
                }
                console.log('Bucket updated successfully with 20MB file size limit');
            }
        } catch (apiError) {
            console.warn(`API approach failed: ${apiError.message}`);
            console.log('Trying SQL approach...');

            // Fallback to SQL approach
            // Read the SQL file
            const storageSql = fs.readFileSync(
                path.join(__dirname, '../supabase/storage.sql'),
                'utf8'
            );

            // Try executing via exec_sql function
            try {
                const { data, error } = await supabase.rpc('exec_sql', {
                    sql_query: storageSql
                });

                if (error) {
                    console.warn(`Warning: ${error.message}`);
                    console.log('Please execute this SQL manually in the Supabase SQL Editor:');
                    console.log(storageSql);
                } else {
                    console.log('Storage configuration SQL executed successfully');
                }
            } catch (sqlError) {
                console.warn(`SQL execution failed: ${sqlError.message}`);
                console.log('Please execute this SQL manually in the Supabase SQL Editor:');
                console.log(storageSql);
            }
        }

        console.log('Storage configuration update process completed.');
    } catch (error) {
        console.error('Error updating storage configuration:', error);
        process.exit(1);
    }
}

updateStorageConfig(); 