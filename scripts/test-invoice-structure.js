// Test script to verify invoice structure handling
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function testInvoiceStructure() {
    try {
        console.log('🔍 Testing invoice structure handling...');

        // Get recent invoices to test the structure
        const invoices = await stripe.invoices.list({
            limit: 5,
            status: 'paid'
        });

        console.log(`📋 Found ${invoices.data.length} recent invoices`);

        invoices.data.forEach((invoice, index) => {
            console.log(`\n--- Invoice ${index + 1}: ${invoice.id} ---`);
            console.log('Direct subscription field:', invoice.subscription);
            console.log('Parent subscription details:', invoice.parent?.subscription_details?.subscription);

            // Test our new logic
            let subscriptionId = invoice.subscription;
            if (!subscriptionId && invoice.parent?.subscription_details?.subscription) {
                subscriptionId = invoice.parent.subscription_details.subscription;
                console.log('✅ Found subscription in parent.subscription_details:', subscriptionId);
            } else if (subscriptionId) {
                console.log('✅ Found subscription in direct field:', subscriptionId);
            } else {
                console.log('⚠️ No subscription found');
            }
        });

    } catch (error) {
        console.error('❌ Error testing invoice structure:', error);
    }
}

// Run the test
testInvoiceStructure();