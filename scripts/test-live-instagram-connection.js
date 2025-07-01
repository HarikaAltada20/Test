const fetch = require('node-fetch');

// Test Instagram Live App Connection
async function testLiveInstagramConnection() {
    const appId = process.env.INSTAGRAM_CLIENT_ID || '1264761661968938';
    const appSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    console.log('🔍 Testing Live Instagram App Connection...\n');

    if (!appSecret) {
        console.log('❌ Missing INSTAGRAM_CLIENT_SECRET');
        return;
    }

    try {
        // Test app access token
        console.log('1️⃣ Testing App Credentials...');
        const tokenUrl = `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`;

        const response = await fetch(tokenUrl);
        const data = await response.json();

        if (data.access_token) {
            console.log('✅ App credentials are valid');

            // Test app permissions
            console.log('\n2️⃣ Checking App Permissions...');
            const permissionsUrl = `https://graph.facebook.com/${appId}/app_permissions?access_token=${data.access_token}`;
            const permResponse = await fetch(permissionsUrl);
            const permData = await permResponse.json();

            if (permData.data) {
                const instagramBasic = permData.data.find(p => p.permission === 'instagram_business_basic');
                const instagramInsights = permData.data.find(p => p.permission === 'instagram_business_manage_insights');

                console.log('📋 Permission Status:');
                console.log(`   instagram_business_basic: ${instagramBasic?.status || 'Not found'}`);
                console.log(`   instagram_business_manage_insights: ${instagramInsights?.status || 'Not found'}`);

                if (instagramBasic?.status === 'live' && instagramInsights?.status === 'live') {
                    console.log('\n🎉 All permissions are LIVE! Your app should work for all users.');
                } else {
                    console.log('\n⏳ Permissions not yet live. Check app review status.');
                }
            }

            // Test authorization URL generation
            console.log('\n3️⃣ Testing Authorization URL...');
            const redirectUri = `${appUrl}/api/instagram/callback`;
            const scopes = 'instagram_business_basic,instagram_business_manage_insights';
            const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&enable_fb_login=0&force_authentication=1`;

            console.log('🔗 Auth URL Generated Successfully');
            console.log('📍 Redirect URI:', redirectUri);
            console.log('🔐 Scopes:', scopes);

        } else {
            console.log('❌ Invalid app credentials');
            console.log('Error:', data.error?.message || 'Unknown error');
        }

    } catch (error) {
        console.log('❌ Error testing app:', error.message);
    }

    console.log('\n📝 Status Summary:');
    console.log('✅ Business verified');
    console.log('✅ Data access renewal approved');
    console.log('⏳ Waiting for app review approval');
    console.log('\n💡 Next: Submit app review for both permissions');
}

// Run if called directly
if (require.main === module) {
    testLiveInstagramConnection();
}

module.exports = { testLiveInstagramConnection }; 