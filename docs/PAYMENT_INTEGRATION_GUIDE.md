# Payment Gateway Integration Guide

## Overview

This guide explains how to set up, test, and use the payment system integration for the Game of Creators platform. The system supports wallet top-ups, contest payments, and subscription management using Stripe.

## 🔧 Setup Instructions

### 1. Environment Configuration

Create a `.env.local` file in your project root with the following variables:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Your existing Supabase variables should already be configured
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Get Stripe API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)
4. Replace the placeholder values in your `.env.local` file

### 3. Set Up Stripe Webhook

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. Set endpoint URL to: `https://your-domain.com/api/payments/webhook`
4. Select these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the webhook secret and add it to your `.env.local` file

## 🧪 Testing the Payment System

### Test Wallet Top-Up

1. Go to Dashboard → Billing
2. Click "Top Up Wallet" button
3. Use Stripe test card numbers:
   - **Success**: `4242424242424242`
   - **Declined**: `4000000000000002`
   - **Requires authentication**: `4000002500003155`

### Test Contest Creation with Payment

1. Go to Dashboard → Contests → Create Contest
2. Fill out all contest details (basics, brief, resources, prize)
3. Click "Submit for Review" on the final step
4. **Payment modal will appear** with options:
   - **Wallet**: Pay from available balance
   - **Stripe**: Pay with credit card  
   - **Split**: Partial wallet + partial card payment
5. Complete payment to finalize contest submission

### Test Contest Payment API Directly

1. Create a contest with a prize amount
2. Use the `/api/payments/contest` endpoint
3. The system will automatically detect your wallet balance
4. Choose payment method:
   - **Wallet**: Pay from available balance
   - **Stripe**: Pay with credit card
   - **Split**: Partial wallet + partial card payment

## 💳 Payment Flow Details

### Deposit Balance Management

- Each advertiser has an `available_deposit_balance` field stored in **cents** (INTEGER format)
- All `money_transactions` amounts are also stored in **cents** for full consistency
- No conversion needed between balance and transaction amounts
- Contest payments are deducted from the balance

### Transaction Logging

All transactions are logged in the `money_transactions` table with:
- Transaction type (`deposit`, `contest_payment`, `refund`)
- Amount and currency (amounts stored in **cents**)
- Status (`pending`, `success`, `failed`)
- Description and metadata

### Currency Conversion Pattern

The system uses this **consistent** conversion pattern:
- **Database**: Both `available_deposit_balance` and `money_transactions.amount` in **cents**
- **Frontend APIs**: Always work in cents internally
- **UI Display**: Convert cents to dollars using `centsToDollars()` utility for user display
- **Payment Processing**: Stripe amounts are in cents, stored directly without conversion

### Payment Methods

#### 1. Wallet Payment
- Fastest option when sufficient balance is available
- Immediate deduction from `available_deposit_balance`
- No additional fees

#### 2. Stripe Payment
- Credit card processing via Stripe
- Secure payment handling
- Transaction fees apply

#### 3. Split Payment
- Combines wallet balance + credit card
- Maximizes use of available balance
- Reduces card charges

## 🔌 API Endpoints

### GET `/api/payments/balance`
Returns the current deposit balance for the authenticated advertiser.

### POST `/api/payments/deposit`
Creates a Stripe payment intent for wallet top-up.

**Body:**
```json
{
  "amount": 50.00
}
```

### POST `/api/payments/contest`
Processes contest payment using selected method.

**Body:**
```json
{
  "contestId": "uuid",
  "amount": 100.00,
  "paymentMethod": "wallet|stripe|split",
  "walletAmount": 50.00  // Only for split payments
}
```

### POST `/api/payments/webhook`
Stripe webhook handler for payment confirmations.

## 🎨 UI Components

### WalletTopUp Component
- Pre-built amount selection ($25, $50, $100, etc.)
- Custom amount input
- Stripe Elements integration
- Real-time balance updates

### ContestPaymentSelection Component
- Automatic payment method detection
- Balance checking
- Split payment configuration
- Stripe checkout integration

## 🛡️ Security Features

- Server-side payment validation
- User authentication checks
- Contest ownership verification
- Transaction integrity logging
- Stripe webhook signature verification

## 🔄 Refund Handling

When contests are cancelled or not launched:
1. Amount is automatically refunded to the deposit balance
2. Transaction is logged as a refund
3. Balance is immediately available for future contests

## 📊 Integration with Billing Page

The billing page now includes:
- Real-time balance display
- Top-up wallet functionality
- Transaction history
- Payment method management

## 🔄 Migration Required: Convert to Cents-Based System

**IMPORTANT**: If you have existing data, you must run this migration to convert `available_deposit_balance` from dollars to cents for consistency.

### Running the Migration

```bash
# 1. Make sure you have the required environment variables
export NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"

# 2. Run the migration script
node scripts/apply-cents-migration.js
```

### Manual Migration (Alternative)

If you prefer to run the SQL directly:

```bash
# Apply the SQL migration file
psql your_database < sql/convert_balance_to_cents.sql
```

### What the Migration Does

- Converts existing `available_deposit_balance` from dollars (DECIMAL) to cents (INTEGER)
- Updates the column type for better performance and consistency
- Ensures both balance and transaction amounts use the same unit (cents)
- Adds proper indexing and constraints

## 🚀 Deployment Checklist

Before deploying to production:

1. ✅ **Run the cents migration** (see above)
2. ✅ Set up production Stripe keys
3. ✅ Configure production webhook endpoint
4. ✅ Test all payment flows thoroughly
5. ✅ Verify webhook signature validation
6. ✅ Set up monitoring for failed payments
7. ✅ Configure proper error handling
8. ✅ Test refund functionality

## 🐛 Troubleshooting

### Common Issues

**"Invalid signature" webhook errors:**
- Verify webhook secret matches Stripe dashboard
- Check endpoint URL is correct
- Ensure webhook is enabled

**Payment not reflecting in balance:**
- Check webhook endpoint is receiving events
- Verify transaction logging in database
- Check for webhook processing errors

**Insufficient balance errors:**
- Verify balance calculation logic
- Check for pending transactions
- Ensure proper balance updates

### Debug Mode

Add these console logs for debugging:
```javascript
console.log('Current balance:', currentBalance);
console.log('Contest amount:', contestAmount);
console.log('Selected payment method:', paymentMethod);
```

## 📞 Support

For payment-related issues:
1. Check Stripe dashboard for payment status
2. Review transaction logs in database
3. Check webhook delivery attempts
4. Verify API endpoint responses 