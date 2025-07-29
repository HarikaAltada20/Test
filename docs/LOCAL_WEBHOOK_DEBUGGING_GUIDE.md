# Local Webhook Debugging Guide

## **Issue: Subscription payments not appearing in money_transactions during local development**

When testing locally, Stripe webhooks can't reach your `localhost:3000` server, so subscription payment events aren't being processed.

## **Solution: Use Stripe CLI for Local Webhook Forwarding**

### **Step 1: Install Stripe CLI**

#### **Windows (using Chocolatey):**
```bash
choco install stripe-cli
```

#### **Windows (using Scoop):**
```bash
scoop install stripe
```

#### **macOS (using Homebrew):**
```bash
brew install stripe/stripe-cli/stripe
```

#### **Linux:**
```bash
# Download from https://github.com/stripe/stripe-cli/releases
# Or use package manager
```

### **Step 2: Login to Stripe CLI**

```bash
stripe login
```

This will open your browser to authenticate with your Stripe account.

### **Step 3: Start Webhook Forwarding**

```bash
stripe listen --forward-to localhost:3000/api/subscriptions/webhook
```

**Expected output:**
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxx
```

### **Step 4: Update Environment Variables**

Add the webhook secret from the CLI output to your `.env.local`:

```env
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

### **Step 5: Test Subscription Payment**

1. **Make a subscription payment** in your local app
2. **Watch the CLI output** for webhook events
3. **Check your application logs** for processing

**Expected CLI output:**
```
2024-01-15 10:30:15   --> invoice.payment_succeeded [evt_1234567890]
2024-01-15 10:30:15  <--  [200] POST http://localhost:3000/api/subscriptions/webhook [evt_1234567890]
```

**Expected application logs:**
```
📥 Subscription Webhook received: invoice.payment_succeeded
💰 Invoice payment succeeded: inv_...
💰 Logging subscription payment to money_transactions for user ...
✅ Successfully logged subscription payment transaction: ...
```

## **Alternative: Manual Webhook Testing**

If you can't use Stripe CLI, you can manually test webhooks:

### **Step 1: Get Test Event Data**

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**
2. Click on your webhook endpoint
3. Click **"Send test webhook"**
4. Select **"invoice.payment_succeeded"**
5. Copy the event data

### **Step 2: Create Test Endpoint**

Create a temporary test endpoint to simulate webhook:

```typescript
// app/api/test-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  
  // Forward to your actual webhook
  const response = await fetch('http://localhost:3000/api/subscriptions/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 'test_signature'
    },
    body: JSON.stringify(body)
  });
  
  return NextResponse.json({ success: true });
}
```

### **Step 3: Send Test Request**

```bash
curl -X POST http://localhost:3000/api/test-webhook \
  -H "Content-Type: application/json" \
  -d @test-webhook-event.json
```

## **Debugging Steps**

### **1. Check if Webhook is Receiving Events**

Look for these log messages:
```
📥 Subscription Webhook received: invoice.payment_succeeded
```

### **2. Check if Payment Processing is Working**

Look for these log messages:
```
💰 Invoice payment succeeded: inv_...
💰 Logging subscription payment to money_transactions for user ...
✅ Successfully logged subscription payment transaction: ...
```

### **3. Check Database for Transactions**

Run the debug script:
```bash
node scripts/debug-subscription-payments.js
```

### **4. Common Issues and Solutions**

#### **Issue: "No Stripe signature found"**
- **Solution**: Ensure webhook secret is set correctly
- **Check**: Verify `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` in `.env.local`

#### **Issue: "Webhook signature verification failed"**
- **Solution**: Use the correct webhook secret from Stripe CLI
- **Check**: Make sure you're using the secret from `stripe listen` output

#### **Issue: "Error logging subscription payment"**
- **Solution**: Check database schema and permissions
- **Check**: Ensure `money_transactions` table exists with correct columns

#### **Issue: No webhook events received**
- **Solution**: Verify Stripe CLI is running and forwarding
- **Check**: Ensure your app is running on `localhost:3000`

## **Production vs Development**

### **Development (Local):**
- Use Stripe CLI to forward webhooks
- Webhook secret: `whsec_xxxxxxxxxxxxxxxxxxxxx` (from CLI)
- Endpoint: `localhost:3000/api/subscriptions/webhook`

### **Production:**
- Stripe sends webhooks directly to your domain
- Webhook secret: `whsec_xxxxxxxxxxxxxxxxxxxxx` (from Stripe Dashboard)
- Endpoint: `https://yourdomain.com/api/subscriptions/webhook`

## **Quick Setup Checklist**

- [ ] Install Stripe CLI
- [ ] Run `stripe login`
- [ ] Start webhook forwarding: `stripe listen --forward-to localhost:3000/api/subscriptions/webhook`
- [ ] Add webhook secret to `.env.local`
- [ ] Restart your development server
- [ ] Make a test subscription payment
- [ ] Check logs for webhook processing
- [ ] Verify transaction appears in database

## **Monitoring Local Webhooks**

### **Stripe CLI Commands:**

```bash
# View all events
stripe events list

# View specific event
stripe events retrieve evt_1234567890

# View webhook attempts
stripe webhook_endpoints list
```

### **Application Logs:**

Look for these patterns:
```
📥 Subscription Webhook received: [event_type]
💰 Invoice payment succeeded: [invoice_id]
✅ Successfully logged subscription payment transaction: [transaction_id]
```

## **Troubleshooting**

### **If Stripe CLI isn't working:**
1. Check if you're logged in: `stripe config --list`
2. Re-login: `stripe login`
3. Check webhook forwarding: `stripe listen --help`

### **If webhooks aren't being processed:**
1. Check application logs for errors
2. Verify webhook secret is correct
3. Ensure your app is running on the correct port
4. Check database connectivity

### **If transactions still aren't appearing:**
1. Run the debug script: `node scripts/debug-subscription-payments.js`
2. Check database schema
3. Verify environment variables
4. Test with a simple webhook event 