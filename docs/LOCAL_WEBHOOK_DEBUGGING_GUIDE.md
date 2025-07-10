# Local Webhook Debugging Guide

## 🚨 **Issue: Double Wallet Top-up in Local Environment**

### **Problem Description**
- **Deployed version**: Wallet top-up works correctly (correct amount added)
- **Local environment**: Double the amount gets added to wallet

### **Root Cause**
Multiple Stripe CLI webhook listeners running simultaneously, causing the same `payment_intent.succeeded` event to be processed twice.

---

## 🔍 **Diagnosis Steps**

### **Step 1: Check Running Stripe CLI Processes**

On Windows PowerShell:
```powershell
# List all running stripe processes
Get-Process | Where-Object {$_.ProcessName -like "*stripe*"}

# Or check for CLI listeners specifically
netstat -an | findstr :3000
```

On Mac/Linux:
```bash
# Check for running stripe CLI processes
ps aux | grep "stripe listen"

# Kill all stripe processes
pkill -f "stripe listen"
```

### **Step 2: Check Your Current Webhook Setup**

Look for these files in your project:
- `webhook-configuration-guide.md` - Shows dual webhook setup
- Check if you have both webhook endpoints running

---

## ✅ **Solution 1: Proper Local Webhook Setup**

### **For Wallet Testing (Recommended)**

Run **ONLY** the payment webhook:

```bash
# Kill any existing stripe processes first
pkill -f "stripe listen"

# Run ONLY payment webhook for wallet testing
stripe listen --forward-to localhost:3000/api/payments/webhook --events payment_intent.succeeded,payment_intent.payment_failed

# You should see output like:
# Ready! Your webhook signing secret is whsec_1234...
# Listening for events matching: payment_intent.succeeded, payment_intent.payment_failed
```

### **For Subscription Testing**

Run **ONLY** the subscription webhook:

```bash
# Kill any existing stripe processes first  
pkill -f "stripe listen"

# Run ONLY subscription webhook
stripe listen --forward-to localhost:3000/api/subscriptions/webhook --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_succeeded,invoice.payment_failed
```

### **❌ Never Run Both Simultaneously**

This causes the duplicate issue:
```bash
# DON'T DO THIS - causes duplicates
stripe listen --forward-to localhost:3000/api/payments/webhook &
stripe listen --forward-to localhost:3000/api/subscriptions/webhook &
```

---

## ✅ **Solution 2: Idempotency Protection (Applied)**

I've added idempotency checks to prevent duplicate processing:

**For Wallet Top-ups:**
- Checks if `payment_intent_id` already exists in `money_transactions` with `status = 'success'`
- Skips processing if already done
- Logs warning about duplicate webhook

**For Contest Payments:**
- Same idempotency protection
- Prevents double charging or double wallet deductions

---

## 🧪 **Testing the Fix**

### **Step 1: Clean Up Local Environment**

```bash
# 1. Kill all stripe processes
pkill -f "stripe listen"

# 2. Restart your development server
npm run dev

# 3. Check your wallet balance before testing
```

### **Step 2: Test Wallet Top-up**

```bash
# Start ONLY payment webhook
stripe listen --forward-to localhost:3000/api/payments/webhook --events payment_intent.succeeded

# In another terminal, test wallet top-up:
# 1. Go to Dashboard → Billing
# 2. Click "Top Up Wallet"  
# 3. Enter $25.00
# 4. Use test card: 4242424242424242
# 5. Complete payment

# Check logs for:
# ✅ "Payment intent xyz is new, proceeding with processing..."
# ❌ Should NOT see "DUPLICATE WEBHOOK" message
```

### **Step 3: Verify Single Processing**

Check your browser console and terminal logs:
- Should see exactly ONE "✅ Balance update successful" message
- Should see exactly ONE "Deposit successful" message  
- Wallet balance should increase by exactly $25.00, not $50.00

---

## 🔧 **Advanced Debugging**

### **Check Database Transactions**

```sql
-- Check recent money transactions
SELECT 
    payment_intent_id,
    type,
    status,
    amount,
    created_at,
    description
FROM money_transactions 
WHERE user_id = 'your_user_id'
ORDER BY created_at DESC 
LIMIT 10;
```

### **Enable Extra Logging**

Add to your local `.env.local`:
```bash
# Enable detailed webhook logging
DEBUG_WEBHOOKS=true
STRIPE_CLI_LOGGING=verbose
```

### **Monitor Real-time Logs**

In separate terminals:
```bash
# Terminal 1: Stripe CLI with verbose logging
stripe listen --forward-to localhost:3000/api/payments/webhook --log-level debug

# Terminal 2: Your Next.js app logs
npm run dev

# Terminal 3: Database logs (if using local DB)
tail -f /path/to/your/db/logs
```

---

## 📋 **Environment Comparison**

### **Deployed Version (Working)**
- Uses Stripe Dashboard webhook endpoints
- Single webhook per event type
- Proper event filtering
- No CLI forwarding

### **Local Version (Fixed)**
- Uses Stripe CLI forwarding
- Must run ONE listener at a time
- Now has idempotency protection
- Proper event filtering required

---

## 🚀 **Best Practices for Local Development**

### **1. Use Specific Event Filtering**
```bash
# Good: Specific events only
stripe listen --forward-to localhost:3000/api/payments/webhook --events payment_intent.succeeded

# Bad: All events (can cause conflicts)
stripe listen --forward-to localhost:3000/api/payments/webhook
```

### **2. Use Separate Scripts**
Create these npm scripts in `package.json`:

```json
{
  "scripts": {
    "webhook:payments": "stripe listen --forward-to localhost:3000/api/payments/webhook --events payment_intent.succeeded,payment_intent.payment_failed",
    "webhook:subscriptions": "stripe listen --forward-to localhost:3000/api/subscriptions/webhook --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_succeeded,invoice.payment_failed",
    "webhook:stop": "pkill -f 'stripe listen'"
  }
}
```

Then use:
```bash
# For wallet testing
npm run webhook:stop && npm run webhook:payments

# For subscription testing  
npm run webhook:stop && npm run webhook:subscriptions
```

### **3. Always Check Running Processes**
Before testing, always check:
```bash
# Should show ONLY ONE stripe listen process
ps aux | grep "stripe listen"
```

---

## 🎯 **Summary**

**The issue was**: Multiple Stripe CLI listeners causing duplicate webhook processing

**The solution**:
1. ✅ **Immediate**: Added idempotency protection (prevents duplicates)
2. ✅ **Process**: Run only ONE webhook listener at a time
3. ✅ **Monitoring**: Check for running processes before testing

**To test wallet top-ups locally**:
```bash
pkill -f "stripe listen"
stripe listen --forward-to localhost:3000/api/payments/webhook --events payment_intent.succeeded
```

Your deployed version works correctly because it uses proper Stripe Dashboard webhooks without CLI forwarding conflicts. 