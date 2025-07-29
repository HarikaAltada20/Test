# Stripe Webhook Setup Guide for Subscription Payments

## **Issue: Subscription payments not appearing in money_transactions**

If you've taken subscriptions but don't see payment entries in your money transactions table, follow these steps to debug and fix the issue.

## **Step 1: Verify Stripe Webhook Configuration**

### **Required Events for Subscription Payment Tracking:**

1. **Go to Stripe Dashboard** → **Developers** → **Webhooks**
2. **Find your webhook endpoint** (should be something like `https://yourdomain.com/api/subscriptions/webhook`)
3. **Click on the webhook** to edit it
4. **Ensure these events are selected:**

#### **Essential Events:**
- ✅ `checkout.session.completed`
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`
- ✅ `invoice.payment_succeeded` ← **CRITICAL for payment tracking**
- ✅ `invoice.payment_failed`
- ✅ `invoice.refunded`

#### **Optional Events:**
- `subscription_schedule.created`
- `subscription_schedule.released`
- `subscription_schedule.canceled`

### **Step 2: Test Webhook Events**

1. **In Stripe Dashboard**, go to your webhook
2. **Click "Send test webhook"**
3. **Select "invoice.payment_succeeded"** from the dropdown
4. **Click "Send test webhook"**
5. **Check your application logs** for the webhook receipt

### **Step 3: Check Webhook Logs**

1. **In Stripe Dashboard**, go to your webhook
2. **Click on "Events" tab**
3. **Look for recent `invoice.payment_succeeded` events**
4. **Check if they show "Succeeded" or "Failed"**

### **Step 4: Verify Environment Variables**

Ensure these environment variables are set correctly:

```env
# Required for webhook signature verification
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_your_webhook_secret_here
# OR
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Required for Stripe API access
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

### **Step 5: Check Application Logs**

Look for these log messages in your application:

**✅ Success indicators:**
```
📥 Subscription Webhook received: invoice.payment_succeeded
💰 Invoice payment succeeded: inv_...
💰 Logging subscription payment to money_transactions for user ...
✅ Successfully logged subscription payment transaction: ...
```

**❌ Error indicators:**
```
❌ No Stripe signature found
❌ No webhook secret configured
❌ Webhook signature verification failed
❌ Error logging subscription payment to money_transactions
```

### **Step 6: Manual Database Check**

If webhooks aren't working, you can manually check for subscription data:

```sql
-- Check if subscriptions exist
SELECT * FROM subscriptions WHERE status = 'active';

-- Check if any subscription payments were logged
SELECT * FROM money_transactions WHERE type = 'subscription_payment';

-- Check advertiser profiles for subscription info
SELECT id, subscription_info FROM advertiser_profiles WHERE subscription_info IS NOT NULL;
```

### **Step 7: Common Issues and Solutions**

#### **Issue 1: Webhook not receiving events**
- **Solution**: Verify webhook URL is accessible and returns 200 status
- **Check**: Ensure your domain is accessible from Stripe's servers

#### **Issue 2: Signature verification failing**
- **Solution**: Double-check webhook secret in environment variables
- **Check**: Ensure secret matches exactly what's shown in Stripe dashboard

#### **Issue 3: Events not being sent**
- **Solution**: Ensure events are selected in webhook configuration
- **Check**: Verify webhook is enabled and not in test mode

#### **Issue 4: Database errors**
- **Solution**: Check money_transactions table schema
- **Check**: Ensure all required columns exist and have correct types

### **Step 8: Testing the Fix**

1. **Make a test subscription payment**
2. **Check webhook logs in Stripe dashboard**
3. **Check application logs for webhook processing**
4. **Verify transaction appears in money_transactions table**
5. **Check the transaction history in your application**

### **Step 9: Monitoring**

Set up monitoring for webhook health:

```sql
-- Create a view to monitor webhook processing
CREATE VIEW webhook_health AS
SELECT 
    event_type,
    COUNT(*) as event_count,
    MAX(created_at) as last_event,
    COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as error_count
FROM webhook_errors 
GROUP BY event_type
ORDER BY last_event DESC;
```

## **Quick Fix Checklist:**

- [ ] Verify `invoice.payment_succeeded` is selected in webhook events
- [ ] Check webhook secret in environment variables
- [ ] Test webhook with Stripe dashboard
- [ ] Check application logs for webhook processing
- [ ] Verify database schema for money_transactions table
- [ ] Test with a new subscription payment

## **Support**

If issues persist after following these steps:
1. Check Stripe webhook logs for specific error messages
2. Review application logs for processing errors
3. Verify database connectivity and permissions
4. Test webhook endpoint accessibility