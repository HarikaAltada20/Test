# Stripe Setup Guide for GoViral Subscription System

This guide will walk you through setting up Stripe for the GoViral subscription system, including products, prices, webhooks, and customer portal configuration.

## Prerequisites

- Stripe account (https://dashboard.stripe.com)
- Access to your GoViral environment variables
- Admin access to your server/hosting platform

## Step 1: Stripe Account Setup

### 1.1 Create or Access Your Stripe Account
1. Go to https://dashboard.stripe.com
2. Sign in or create a new account
3. Complete account verification if required

### 1.2 Get Your API Keys
1. Navigate to **Developers > API Keys**
2. Copy your **Publishable Key** and **Secret Key**
3. For testing, use the test keys (starting with `pk_test_` and `sk_test_`)
4. For production, use live keys (starting with `pk_live_` and `sk_live_`)

## Step 2: Environment Variables Setup

Add these environment variables to your `.env.local` file:

```env
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Database (ensure these are set)
DATABASE_URL=your_database_url_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## Step 3: Create Subscription Products and Prices

### 3.1 Create Products

Navigate to **Products > Product catalog** and create the following products:

#### 1. Starter Plan
- **Name**: GoViral Starter Plan
- **Description**: Great for small businesses that want to run more contests and grow their presence
- **Statement descriptor**: GOVIRAL STARTER
- **Unit label**: per month

#### 2. Builder Plan  
- **Name**: GoViral Builder Plan
- **Description**: Medium to large brands scaling their presence and want more contests and flexibility
- **Statement descriptor**: GOVIRAL BUILDER
- **Unit label**: per month

#### 3. Champion Plan
- **Name**: GoViral Champion Plan
- **Description**: Large businesses, agencies, and enterprises looking to run high-volume campaigns with premium support
- **Statement descriptor**: GOVIRAL CHAMPION
- **Unit label**: per month

### 3.2 Create Prices for Each Product

For each product created above, add a recurring price:

#### Starter Plan Price
- **Pricing model**: Standard pricing
- **Price**: $100.00 USD
- **Billing period**: Monthly
- **Usage type**: Licensed

#### Builder Plan Price
- **Pricing model**: Standard pricing
- **Price**: $250.00 USD
- **Billing period**: Monthly
- **Usage type**: Licensed

#### Champion Plan Price
- **Pricing model**: Standard pricing
- **Price**: $500.00 USD
- **Billing period**: Monthly
- **Usage type**: Licensed

### 3.3 Copy Price IDs

After creating prices, copy the price IDs (starting with `price_`) and update your `constants/subscriptionPlans.ts` file:

```typescript
export const subscriptionPlans = [
  // ... existing plans
  {
    id: '0477016e-7751-4049-bc57-19012004a05b',
    name: 'STARTER',
    displayName: 'Starter Plan',
    price: 10000, // $100.00 in cents
    stripe_price_id: 'price_your_starter_price_id_here', // Add this
    features: {
      // ... existing features
    },
  },
  {
    id: '4107627f-4ccb-4f1e-ad1a-fdc723e6a5ef',
    name: 'BUILDER',
    displayName: 'Builder Plan',
    price: 25000, // $250.00 in cents
    stripe_price_id: 'price_your_builder_price_id_here', // Add this
    features: {
      // ... existing features
    },
  },
  {
    id: '0f094792-1ef6-4334-b169-f98d21ca0fbd',
    name: 'CHAMPION',
    displayName: 'Champion Plan',
    price: 50000, // $500.00 in cents
    stripe_price_id: 'price_your_champion_price_id_here', // Add this
    features: {
      // ... existing features
    },
  },
];
```

## Step 4: Configure Webhooks

### 4.1 Create Webhook Endpoint

1. Navigate to **Developers > Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL: `https://yourdomain.com/api/subscriptions/webhook`
4. Select the following events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`

### 4.2 Copy Webhook Secret

1. After creating the webhook, click on it
2. Go to **Signing secret** section
3. Click **Reveal** and copy the webhook secret (starts with `whsec_`)
4. Add it to your environment variables as `STRIPE_WEBHOOK_SECRET`

## Step 5: Configure Customer Portal

### 5.1 Enable Customer Portal

1. Navigate to **Settings > Customer portal**
2. Enable the customer portal
3. Configure the following settings:

#### Business Information
- **Business name**: GoViral
- **Privacy policy URL**: https://yourdomain.com/privacy
- **Terms of service URL**: https://yourdomain.com/terms

#### Functionality
- **Subscription management**: Allow customers to cancel, pause, or switch plans
- **Payment method management**: Allow customers to update payment methods
- **Invoice history**: Allow customers to view and download invoices
- **Billing address collection**: Optional

#### Branding
- **Logo**: Upload your GoViral logo
- **Primary color**: #7C3AED (purple-600)
- **Background color**: #FFFFFF

## Step 6: Database Migration

Run the subscription system database migration:

```bash
# Connect to your database and run the SQL file
psql -d your_database_name -f sql/subscription_system_upgrade.sql
```

Or if using Supabase:
1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Paste the contents of `sql/subscription_system_upgrade.sql`
4. Run the query

## Step 7: Testing

### 7.1 Test Subscription Creation

1. Go to your pricing page while logged in as an advertiser
2. Try upgrading to a paid plan
3. Use Stripe test card numbers:
   - **Success**: 4242 4242 4242 4242
   - **Declined**: 4000 0000 0000 0002
   - **Insufficient funds**: 4000 0000 0000 9995

### 7.2 Test Webhooks

1. Go to **Developers > Webhooks** in Stripe
2. Click on your webhook endpoint
3. Check the **Events** tab for successful webhook deliveries
4. Test different scenarios:
   - Complete a subscription purchase
   - Cancel a subscription
   - Update payment method

### 7.3 Test Customer Portal

1. Create a test subscription
2. Go to `/dashboard/billing` and click "Manage Subscription"
3. Test cancelling and updating payment methods

## Step 8: Go Live

### 8.1 Switch to Live Mode

1. In Stripe dashboard, toggle to **Live mode**
2. Complete account verification if required
3. Update environment variables with live keys
4. Update webhook endpoint to use live URL

### 8.2 Final Checklist

- [ ] Live API keys configured
- [ ] Webhook endpoint created with live URL
- [ ] All events properly configured
- [ ] Customer portal configured
- [ ] Database migration completed
- [ ] Test transactions completed successfully
- [ ] Error monitoring setup (recommended)

## Troubleshooting

### Common Issues

#### 1. Webhook Verification Failed
- Ensure `STRIPE_WEBHOOK_SECRET` is correctly set
- Check that the webhook URL is accessible
- Verify the webhook events are configured correctly

#### 2. Product/Price IDs Not Found
- Ensure `stripe_price_id` is set in `subscriptionPlans.ts`
- Verify the price IDs are correct in Stripe dashboard
- Check that you're using the correct mode (test vs live)

#### 3. Customer Portal Issues
- Ensure customer portal is enabled in Stripe
- Check that the customer has an active subscription
- Verify the return URL is correctly configured

### Monitoring

Set up monitoring for:
- Webhook delivery failures
- Failed subscription payments
- High error rates in subscription APIs
- Database connection issues

### Support

For Stripe-specific issues:
- Check Stripe documentation: https://stripe.com/docs
- Use Stripe's support: https://support.stripe.com

For GoViral-specific issues:
- Check application logs
- Review database queries
- Verify environment variables
- Test API endpoints directly

## Security Considerations

1. **Never expose secret keys** in client-side code
2. **Always verify webhook signatures** before processing
3. **Use HTTPS** for all webhook endpoints
4. **Regularly rotate API keys** for security
5. **Monitor for suspicious activity** in Stripe dashboard
6. **Implement proper error handling** to avoid data leaks

## Next Steps

After completing this setup:
1. Monitor subscription metrics in Stripe dashboard
2. Set up automated billing reports
3. Consider implementing subscription analytics
4. Plan for handling subscription lifecycle events
5. Set up customer success workflows

---

**Note**: This guide assumes you're using the GoViral subscription system as implemented. Make sure to test thoroughly in development before going live. 