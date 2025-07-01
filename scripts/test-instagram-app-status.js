const fetch = require('node-fetch');

// Test Instagram App Status
async function testInstagramAppStatus() {
    const appId = process.env.INSTAGRAM_CLIENT_ID || '1264761661968938';
    const appSecret = process.env.INSTAGRAM_CLIENT_SECRET;

    console.log('🔍 Testing Instagram App Status...\n');

    if (!appSecret) {
        console.log('❌ Missing INSTAGRAM_CLIENT_SECRET');
        return;
    }

    try {
        // Test app access token
        const tokenUrl = `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;

        const response = await fetch(tokenUrl);
        const data = await response.json();

        if (data.access_token) {
            console.log('✅ App credentials are valid');
            console.log('📱 App ID:', appId);

            // Test app info
            const appInfoUrl = `https://graph.facebook.com/${appId}?access_token=${data.access_token}`;
            const appInfoResponse = await fetch(appInfoUrl);
            const appInfo = await appInfoResponse.json();

            console.log('📋 App Info:');
            console.log(`   Name: ${appInfo.name || 'Unknown'}`);
            console.log(`   Category: ${appInfo.category || 'Unknown'}`);
            console.log(`   Company: ${appInfo.company || 'Unknown'}`);

            // Check if app is live
            if (appInfo.app_domains && appInfo.app_domains.length > 0) {
                console.log('🌐 App Domains:', appInfo.app_domains.join(', '));
            }

        } else {
            console.log('❌ Invalid app credentials');
            console.log('Error:', data.error?.message || 'Unknown error');
        }

    } catch (error) {
        console.log('❌ Error testing app:', error.message);
    }

    console.log('\n📝 Next Steps:');
    console.log('1. Go to https://developers.facebook.com/apps/' + appId);
    console.log('2. Check App Review tab for permission status');
    console.log('3. Ensure business verification is complete');
    console.log('4. Add data deletion callback URL');
    console.log('5. Submit for app review if needed');
}

// Run if called directly
if (require.main === module) {
    testInstagramAppStatus();
}

module.exports = { testInstagramAppStatus }; 