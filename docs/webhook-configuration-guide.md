# Stripe Webhook Configuration Guide

## Problem
Subscription payments are being sent to the wrong webhook endpoint, causing errors because subscription payment intents don't have the required metadata that direct payments have.

## Solution
Configure two separate webhook endpoints in your Stripe dashboard with specific events for each.

## Step 1: Access Stripe Dashboard

1. Go to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** > **Webhooks**

## Step 2: Configure Payment Webhook

### Create/Update Payment Webhook
1. Click **Add endpoint** (or edit existing webhook)
2. **Endpoint URL**: `https://yourdomain.com/api/payments/webhook`
3. **Description**: "Payment Processing - Wallet Top-ups and Contest Payments"
4. **Events to send**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

### Get Webhook Secret
1. Click on the webhook after creation
2. Go to **Signing secret** section
3. Copy the secret (starts with `whsec_`)
4. Add to your environment variables as `STRIPE_WEBHOOK_SECRET`

## Step 3: Configure Subscription Webhook

### Create Subscription Webhook
1. Click **Add endpoint**
2. **Endpoint URL**: `https://yourdomain.com/api/subscriptions/webhook`
3. **Description**: "Subscription Processing - Billing and Lifecycle"
4. **Events to send**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### Get Webhook Secret
1. Click on the webhook after creation
2. Go to **Signing secret** section
3. Copy the secret (starts with `whsec_`)
4. Add to your environment variables as `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`

## Step 4: Update Environment Variables

Add both webhook secrets to your environment:

```bash
# Payment webhook (existing)
STRIPE_WEBHOOK_SECRET=whsec_your_payment_webhook_secret

# Subscription webhook (new)
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_your_subscription_webhook_secret
```

## Step 5: Update Subscription Webhook Code

Update your subscription webhook to use the correct secret:

```typescript
// In app/api/subscriptions/webhook/route.ts
const endpointSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET!;
```

## Step 6: Test the Configuration

### Test Subscription Creation
1. Go to your pricing page
2. Try to subscribe to a paid plan
3. Check the webhook logs in both Stripe dashboard and your application logs

### Expected Behavior
- **Payment webhook** should only receive `payment_intent.succeeded` events for wallet top-ups and contest payments
- **Subscription webhook** should receive `checkout.session.completed` and `invoice.payment_succeeded` events for subscriptions

## Step 7: Verify Webhook Delivery

In your Stripe dashboard:
1. Go to **Developers** > **Webhooks**
2. Click on each webhook
3. Check the **Events** tab to see successful deliveries
4. Look for any failed deliveries and troubleshoot

## Common Issues and Solutions

### Issue 1: Webhook Secret Mismatch
**Error**: `Webhook signature verification failed`
**Solution**: Ensure you're using the correct webhook secret for each endpoint

### Issue 2: Missing Events
**Error**: Subscriptions not being created
**Solution**: Verify all required events are configured for the subscription webhook

### Issue 3: Duplicate Processing
**Error**: Same event processed by both webhooks
**Solution**: Ensure events are only configured for the appropriate webhook

## Testing Commands

You can test webhook delivery using Stripe CLI:

```bash
# Test payment webhook
stripe listen --forward-to localhost:3000/api/payments/webhook

# Test subscription webhook
stripe listen --forward-to localhost:3000/api/subscriptions/webhook
```

## Production Checklist

- [ ] Payment webhook configured with correct URL and events
- [ ] Subscription webhook configured with correct URL and events
- [ ] Both webhook secrets added to environment variables
- [ ] Subscription webhook updated to use correct secret
- [ ] Test subscription creation works
- [ ] Test wallet top-up works
- [ ] Monitor webhook delivery in Stripe dashboard

## Next Steps

After configuration:
1. Deploy the updated code
2. Test the subscription flow end-to-end
3. Monitor webhook logs for any errors
4. Set up alerts for webhook failures 