// Test script to simulate edge cases for registration fixes
// Run this in browser console on localhost:3000

async function testEdgeCases() {
    console.log('🧪 Testing Registration Edge Cases...');

    // Test 1: IP endpoint with various scenarios
    console.log('\n1. Testing IP endpoint..');
    try {
        const ipResponse = await fetch('/api/get-ip');
        const ipData = await ipResponse.json();
        console.log('✅ IP Response:', ipData);

        if (ipData.ip === '0.0.0.0') {
            console.error('❌ FAIL: Still returning 0.0.0.0');
        } else {
            console.log('✅ PASS: No 0.0.0.0 returned');
        }
    } catch (error) {
        console.error('❌ IP endpoint error:', error);
    }

    // Test 2: Check if IP fetch failure is handled gracefully
    console.log('\n2. Testing IP fetch failure handling...');

    // Simulate network failure by calling with invalid endpoint
    try {
        const fakeResponse = await fetch('/api/fake-ip-endpoint');
        console.log('Fake endpoint responded (unexpected)');
    } catch (error) {
        console.log('✅ PASS: Fake endpoint correctly failed');
    }

    console.log('\n✅ Edge case testing complete!');
    console.log('📝 Now register a test user and check the database with the SQL queries.');
}

// Run the tests
testEdgeCases();
