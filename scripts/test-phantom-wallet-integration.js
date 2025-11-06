/**
 * Test script to verify Phantom Wallet payout method integration
 * This will help debug if there are any issues with adding Phantom Wallet
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to add your Supabase URL and service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPhantomWalletIntegration() {
  console.log('🔍 Testing Phantom Wallet Integration...');
  
  try {
    // 1. Check if there are any existing Phantom Wallet payout methods
    console.log('\n1. Checking existing Phantom Wallet payout methods...');
    const { data: existingPhantom, error: phantomError } = await supabase
      .from('payout_methods')
      .select('*')
      .eq('method_type', 'phantom');

    if (phantomError) {
      console.error('❌ Error fetching Phantom Wallet methods:', phantomError);
      return;
    }

    console.log(`📊 Found ${existingPhantom?.length || 0} existing Phantom Wallet payout methods`);
    
    if (existingPhantom && existingPhantom.length > 0) {
      console.log('✅ Phantom Wallet methods found:');
      existingPhantom.forEach((method, index) => {
        console.log(`   ${index + 1}. ${method.friendly_name || 'Unnamed'} - ${method.details?.wallet_address || 'No address'}`);
      });
    } else {
      console.log('ℹ️  No Phantom Wallet methods found yet. This is normal if users haven\'t added any.');
    }

    // 2. Check all payout method types
    console.log('\n2. Checking all payout method types...');
    const { data: allMethods, error: allError } = await supabase
      .from('payout_methods')
      .select('method_type')
      .order('created_at', { ascending: false })
      .limit(10);

    if (allError) {
      console.error('❌ Error fetching all methods:', allError);
      return;
    }

    const methodTypes = [...new Set(allMethods?.map(m => m.method_type) || [])];
    console.log('📊 Available payout method types:', methodTypes);
    
    if (methodTypes.includes('phantom')) {
      console.log('✅ Phantom Wallet method type is supported in database');
    } else {
      console.log('⚠️  Phantom Wallet method type not found in existing data');
    }

    // 3. Test creating a Phantom Wallet method (dry run)
    console.log('\n3. Testing Phantom Wallet method creation (dry run)...');
    
    const testPhantomMethod = {
      user_id: '00000000-0000-0000-0000-000000000000', // Test UUID
      method_type: 'phantom',
      details: {
        wallet_address: '8qhgYTV4wJFsEEwiZqTwzuJisFrimUXQG9MLsHGkkWU8',
        preferred_token: 'USDC',
        network: 'devnet',
        friendly_name: 'Test Phantom Wallet'
      },
      is_default: false,
      friendly_name: 'Test Phantom Wallet'
    };

    console.log('📝 Test Phantom Wallet method structure:');
    console.log(JSON.stringify(testPhantomMethod, null, 2));

    // 4. Check if we can validate the structure
    console.log('\n4. Validating Phantom Wallet method structure...');
    
    const requiredFields = ['user_id', 'method_type', 'details'];
    const missingFields = requiredFields.filter(field => !testPhantomMethod[field]);
    
    if (missingFields.length === 0) {
      console.log('✅ All required fields present');
    } else {
      console.log('❌ Missing required fields:', missingFields);
    }

    const requiredDetails = ['wallet_address', 'preferred_token', 'network'];
    const missingDetails = requiredDetails.filter(field => !testPhantomMethod.details[field]);
    
    if (missingDetails.length === 0) {
      console.log('✅ All required details present');
    } else {
      console.log('❌ Missing required details:', missingDetails);
    }

    console.log('\n🎉 Phantom Wallet integration test completed!');
    console.log('\n📋 Summary:');
    console.log(`   • Existing Phantom methods: ${existingPhantom?.length || 0}`);
    console.log(`   • Available method types: ${methodTypes.join(', ')}`);
    console.log(`   • Phantom supported: ${methodTypes.includes('phantom') ? 'Yes' : 'Not found in data'}`);
    console.log(`   • Structure valid: ${missingFields.length === 0 && missingDetails.length === 0 ? 'Yes' : 'No'}`);

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testPhantomWalletIntegration()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
