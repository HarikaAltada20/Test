# Customer Linking System

## Overview

The Customer Linking System ensures that **every new transaction** (top-ups, deposits, refunds, contest payments, etc.) is linked to a specific Stripe customer, providing clear transaction history and customer segmentation in Stripe.

## How It Works

### 1. **Automatic Customer Creation**
- When a user makes their first payment, a Stripe customer is automatically created
- Customer ID is stored in the `customers` table
- All subsequent transactions are linked to this customer

### 2. **Payment Intent Creation**
All new payment intents now include customer linking:

```typescript
// Top-up payments
const paymentIntent = await stripe().paymentIntents.create({
  amount: formatAmountForStripe(amount),
  currency: 'usd',
  customer: customerId, // ✅ Linked to customer
  metadata: {
    userId,
    type: 'wallet_topup',
    amount: amount.toString(),
  },
  automatic_payment_methods: {
    enabled: true,
  },
});

// Contest payments
const paymentIntent = await stripe().paymentIntents.create({
  amount: amount,
  currency: 'usd',
  customer: customerId, // ✅ Linked to customer
  metadata: {
    userId,
    contestId,
    type: 'contest_payment',
    amount: amount.toString(),
  },
  automatic_payment_methods: {
    enabled: true,
  },
});
```

### 3. **Transaction Logging**
All new transactions include customer information:

```typescript
await logTransaction(
  userId,
  'deposit',
  amountInCents,
  'pending',
  description,
  paymentIntentId,
  remarks,
  paymentMethod,
  metadata,
  stripeInvoiceId,
  stripeSubscriptionId,
  stripeCustomerId // ✅ Customer ID for tracking
);
```

## Benefits

### ✅ **Clear Transaction History in Stripe**
- All new transactions are linked to specific customers
- Easy to view customer payment history in Stripe Dashboard
- Better customer segmentation and analytics

### ✅ **Improved Customer Management**
- Single customer record per user across all transaction types
- Consistent customer experience
- Better support and dispute resolution

### ✅ **Enhanced Analytics**
- Track customer lifetime value
- Analyze payment patterns per customer
- Better reporting and insights

## Implementation Status

### ✅ **Completed**
- Customer table exists and is properly structured
- All payment intent creation functions include customer linking
- Transaction logging includes customer information
- Webhook processing logs customer information
- Utility functions for customer management

### 🎯 **Result**
From now onwards, **every new transaction** will be automatically linked to a Stripe customer, just like subscription transactions.

## Monitoring

### Webhook Logs
Customer information is logged in webhook processing:
```
=== WEBHOOK DEBUG ===
Payment Intent ID: pi_xxx
Customer ID: cus_xxx  ✅ Customer linked
Metadata: {...}
```

### Transaction Logs
Customer information is included in transaction logging:
```
📝 Logging transaction: {
  userId: "xxx",
  customerId: "cus_xxx",  ✅ Customer linked
  paymentIntentId: "pi_xxx",
  ...
}
```

## Verification

To verify that new transactions are properly linked:

1. **Make a new top-up payment**
2. **Check Stripe Dashboard** - Transaction should appear under the customer
3. **Check webhook logs** - Should show customer ID
4. **Check transaction metadata** - Should include customer information

## Database Schema

### Customers Table
```sql
CREATE TABLE public.customers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Money Transactions Table
New transactions include customer information in the `metadata` field:
```json
{
  "stripe_customer_id": "cus_xxx",
  "customer_updated_at": "2024-01-01T00:00:00Z"
}
```

## Summary

✅ **Mission Accomplished**: All new transactions (top-ups, deposits, contest payments, refunds) are now linked to Stripe customers, just like subscription transactions.

✅ **No Migration Needed**: Existing transactions remain unchanged.

✅ **Automatic Process**: New transactions automatically get customer linking without any additional steps.