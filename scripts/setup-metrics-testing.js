#!/usr/bin/env node

/**
 * Metrics System Testing Setup Script
 * Run this to set up test data and validate the new metrics system
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test configuration
const TEST_CONFIG = {
    creatorId: null, // Will be created
    contestId: null, // Will be created
    adminId: null, // Will be created
};

async function createTestData() {
    console.log('🧪 Setting up test data...');

    try {
        // Create test creator
        const { data: creator, error: creatorError } = await supabase.auth.admin.createUser({
            email: `test-creator-${Date.now()}@example.com`,
            password: 'testpassword123',
            email_confirm: true
        });

        if (creatorError) throw creatorError;

        TEST_CONFIG.creatorId = creator.user.id;

        // Create creator profile
        await supabase
            .from('creator_profiles')
            .insert({
                id: creator.user.id,
                bio: 'Test creator for metrics testing'
            });

        // Create test advertiser/admin
        const { data: admin, error: adminError } = await supabase.auth.admin.createUser({
            email: `test-admin-${Date.now()}@example.com`,
            password: 'testpassword123',
            email_confirm: true
        });

        if (adminError) throw adminError;

        TEST_CONFIG.adminId = admin.user.id;

        // Create advertiser profile
        await supabase
            .from('advertiser_profiles')
            .insert({
                id: admin.user.id,
                company_name: 'Test Company'
            });

        // Create test contest
        const { data: contest, error: contestError } = await supabase
            .from('contests')
            .insert({
                advertiser_id: admin.user.id,
                title: 'Test Contest for Metrics',
                platform: 'youtube',
                start_date: new Date().toISOString(),
                end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                moderation_status: 'published',
                contest_type: 'standard'
            })
            .select()
            .single();

        if (contestError) throw contestError;

        TEST_CONFIG.contestId = contest.id;

        console.log('✅ Test data created successfully');
        console.log('Creator ID:', TEST_CONFIG.creatorId);
        console.log('Contest ID:', TEST_CONFIG.contestId);
        console.log('Admin ID:', TEST_CONFIG.adminId);

        return TEST_CONFIG;

    } catch (error) {
        console.error('❌ Failed to create test data:', error);
        throw error;
    }
}

async function testSubmissionCreation() {
    console.log('\n🧪 Testing submission creation...');

    try {
        // Get initial metrics
        const { data: initialProfile } = await supabase
            .from('creator_profiles')
            .select('total_submissions_made, total_contests_participated')
            .eq('id', TEST_CONFIG.creatorId)
            .single();

        console.log('Initial metrics:', initialProfile);

        // Create test submission
        const { data: submission, error } = await supabase
            .from('submissions')
            .insert({
                contest_id: TEST_CONFIG.contestId,
                creator_id: TEST_CONFIG.creatorId,
                content_link: 'https://youtube.com/watch?v=test',
                status: 'pending',
                description: 'Test submission for metrics testing'
            })
            .select()
            .single();

        if (error) throw error;

        // Wait a moment for trigger to execute
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check updated metrics
        const { data: updatedProfile } = await supabase
            .from('creator_profiles')
            .select('total_submissions_made, total_contests_participated')
            .eq('id', TEST_CONFIG.creatorId)
            .single();

        console.log('Updated metrics:', updatedProfile);

        // Verify increment
        const expectedSubmissions = (initialProfile?.total_submissions_made || 0) + 1;
        const expectedParticipation = (initialProfile?.total_contests_participated || 0) + 1;

        if (updatedProfile?.total_submissions_made === expectedSubmissions &&
            updatedProfile?.total_contests_participated === expectedParticipation) {
            console.log('✅ Submission creation test passed');
            return submission;
        } else {
            console.log('❌ Submission creation test failed');
            throw new Error('Metrics not updated correctly');
        }

    } catch (error) {
        console.error('❌ Submission creation test failed:', error);
        throw error;
    }
}

async function testSubmissionWin(submissionId) {
    console.log('\n🧪 Testing submission win tracking...');

    try {
        // Get initial metrics
        const { data: initialProfile } = await supabase
            .from('creator_profiles')
            .select('total_submissions_won, total_contests_won')
            .eq('id', TEST_CONFIG.creatorId)
            .single();

        console.log('Initial win metrics:', initialProfile);

        // Simulate payout by updating submission status and calling metrics service
        const { MetricsService } = await import('../lib/metrics-service.ts');

        await MetricsService.incrementSubmissionWin(
            TEST_CONFIG.creatorId,
            TEST_CONFIG.contestId,
            submissionId
        );

        // Check updated metrics
        const { data: updatedProfile } = await supabase
            .from('creator_profiles')
            .select('total_submissions_won, total_contests_won')
            .eq('id', TEST_CONFIG.creatorId)
            .single();

        console.log('Updated win metrics:', updatedProfile);

        // Verify increment
        const expectedSubmissionWins = (initialProfile?.total_submissions_won || 0) + 1;
        const expectedContestWins = (initialProfile?.total_contests_won || 0) + 1;

        if (updatedProfile?.total_submissions_won === expectedSubmissionWins &&
            updatedProfile?.total_contests_won === expectedContestWins) {
            console.log('✅ Submission win test passed');
        } else {
            console.log('❌ Submission win test failed');
            throw new Error('Win metrics not updated correctly');
        }

    } catch (error) {
        console.error('❌ Submission win test failed:', error);
        throw error;
    }
}

async function cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');

    try {
        // Delete test submissions
        await supabase
            .from('submissions')
            .delete()
            .eq('creator_id', TEST_CONFIG.creatorId);

        // Delete test contest
        await supabase
            .from('contests')
            .delete()
            .eq('id', TEST_CONFIG.contestId);

        // Delete creator profile
        await supabase
            .from('creator_profiles')
            .delete()
            .eq('id', TEST_CONFIG.creatorId);

        // Delete advertiser profile
        await supabase
            .from('advertiser_profiles')
            .delete()
            .eq('id', TEST_CONFIG.adminId);

        // Delete auth users
        await supabase.auth.admin.deleteUser(TEST_CONFIG.creatorId);
        await supabase.auth.admin.deleteUser(TEST_CONFIG.adminId);

        console.log('✅ Test data cleaned up successfully');

    } catch (error) {
        console.error('❌ Failed to cleanup test data:', error);
        console.log('You may need to manually clean up the following IDs:');
        console.log('Creator ID:', TEST_CONFIG.creatorId);
        console.log('Admin ID:', TEST_CONFIG.adminId);
        console.log('Contest ID:', TEST_CONFIG.contestId);
    }
}

async function runTests() {
    console.log('🚀 Starting Metrics System Tests\n');

    try {
        // Setup
        await createTestData();

        // Test 1: Submission Creation
        const submission = await testSubmissionCreation();

        // Test 2: Submission Win
        await testSubmissionWin(submission.id);

        console.log('\n🎉 All tests passed! The metrics system is working correctly.');

    } catch (error) {
        console.error('\n💥 Tests failed:', error.message);
        process.exit(1);
    } finally {
        // Cleanup
        await cleanupTestData();
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    createTestData,
    testSubmissionCreation,
    testSubmissionWin,
    cleanupTestData,
    runTests
};
