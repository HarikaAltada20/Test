# Solana Payment System Setup Guide

Complete guide to setting up and using the Phantom Wallet USDC/USDT payment system for brand wallet top-ups.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setup Instructions](#setup-instructions)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Webhook Monitoring Setup](#webhook-monitoring-setup)
7. [Testing](#testing)
8. [Production Deployment](#production-deployment)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Solana Payment System allows brands to top-up their wallet balance using USDC or USDT on the Solana blockchain via Phantom Wallet. Key features:

- ✅ Support for both USDC and USDT stablecoins
- ✅ Automatic payment verification and balance updates
- ✅ Unique reference ID tracking system
- ✅ Email notifications for payment confirmation
- ✅ Real-time webhook monitoring (1-minute polling)
- ✅ Fraud prevention with memo validation
- ✅ Network-agnostic (Devnet/Mainnet-beta)

---

## Prerequisites

### 1. Phantom Wallet Setup

You need a Phantom Wallet to receive payments. Follow these steps:

#### **Option A: Mobile App (Recommended for Production)**

1. Download Phantom Wallet from:
   - iOS: [App Store](https://apps.apple.com/app/phantom-solana-wallet/1598432977)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=app.phantom.android)

2. Create a new wallet or import existing:
   - Open the app → "Create a new wallet"
   - **IMPORTANT**: Write down your Secret Recovery Phrase securely
   - Set a strong password/PIN

3. Get your wallet address:
   - Tap on your wallet name at the top
   - Copy your wallet address (starts with uppercase letters/numbers)
   - Example: `Bxp7f...9xK2` (Base58 format)

#### **Option B: Browser Extension (For Testing)**

1. Install Phantom Extension:
   - Chrome/Brave: [Chrome Web Store](https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa)
   - Firefox: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/phantom-app/)

2. Create wallet same as mobile steps above

3. Get your wallet address from extension

#### **Network Selection**

- **Devnet (Testing)**: Switch to Devnet in Phantom settings for testing
- **Mainnet-beta (Production)**: Keep on Mainnet for live payments

### 2. Get Test Tokens (Devnet Only)

If testing on Devnet, you'll need test USDC:

```bash
# Use Solana faucet to get test SOL (for transaction fees)
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet

# Get test USDC from:
# https://spl-token-faucet.com/
```

### 3. RPC Provider Setup (Optional but Recommended)

For better reliability and rate limits, sign up for a dedicated RPC provider:

#### **Helius (Recommended)**

1. Sign up at [https://helius.dev](https://helius.dev)
2. Create a new project
3. Copy your API key
4. Benefits:
   - Higher rate limits
   - Faster transaction processing
   - Webhook support (future enhancement)

#### **QuickNode**

1. Sign up at [https://quicknode.com](https://quicknode.com)
2. Create Solana endpoint
3. Copy your endpoint URL

---

## Setup Instructions

### Step 1: Install Dependencies

Dependencies are already installed in your project:

```json
{
  "@solana/web3.js": "^1.x.x",
  "@solana/spl-token": "^0.x.x",
  "bs58": "^5.x.x"
}
```

### Step 2: Database Setup

Run the SQL migration to create required tables:

```bash
# Apply the Solana payment schema
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d YOUR_DB_NAME -f SUPABASE/solana_payments.sql
```

Or in Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `SUPABASE/solana_payments.sql`
3. Run the query

This creates:
- `solana_payment_requests` table
- `solana_transactions` table
- Indexes for performance
- RLS policies for security

### Step 3: Configure Environment Variables

Add these variables to your `.env.local` file:

```env
# ================================
# SOLANA PAYMENT CONFIGURATION
# ================================

# Network: 'devnet' for testing, 'mainnet-beta' for production
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# Your Phantom Wallet address for receiving payments
PHANTOM_WALLET_ADDRESS=Your_Wallet_Address_Here

# RPC Endpoint (Optional - uses public endpoints if not set)
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
# Or use Helius:
# NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://rpc-devnet.helius.xyz/?api-key=YOUR_KEY

# Helius API Key (Optional but recommended)
HELIUS_API_KEY=your_helius_api_key_here

# Webhook Security (Required for production)
SOLANA_WEBHOOK_API_KEY=generate_random_secure_key_here

# Email Configuration (Already set up with Resend)
RESEND_API_KEY=your_existing_resend_key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App URL for email links
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Step 4: Generate Webhook API Key

For securing your webhook endpoint:

```bash
# Generate a secure random key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add this to `SOLANA_WEBHOOK_API_KEY` in your environment variables.

---

## Environment Variables

### Complete Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SOLANA_NETWORK` | Yes | `devnet` | Solana network: `devnet` or `mainnet-beta` |
| `PHANTOM_WALLET_ADDRESS` | Yes | - | Your receiving wallet address |
| `NEXT_PUBLIC_SOLANA_RPC_ENDPOINT` | No | Public RPC | Custom RPC endpoint URL |
| `HELIUS_API_KEY` | No | - | Helius API key for enhanced RPC |
| `SOLANA_WEBHOOK_API_KEY` | Yes (Prod) | - | API key for webhook security |
| `RESEND_API_KEY` | Yes | - | Resend API key for emails |
| `RESEND_FROM_EMAIL` | Yes | - | Sender email address |
| `NEXT_PUBLIC_APP_URL` | Yes | - | Your application URL |

---

## Webhook Monitoring Setup

The system uses QStash (or similar) to poll for new transactions every minute.

### Option A: Using QStash (Recommended)

1. **Sign up for QStash**:
   - Go to [https://upstash.com/](https://upstash.com/)
   - Create account and get QStash credentials

2. **Create a Schedule**:
   ```bash
   # Using QStash API
   curl -X POST https://qstash.upstash.io/v1/schedules \
     -H "Authorization: Bearer YOUR_QSTASH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "destination": "https://yourdomain.com/api/solana/webhook-monitor",
       "cron": "* * * * *",
       "headers": {
         "Authorization": "Bearer YOUR_SOLANA_WEBHOOK_API_KEY"
       }
     }'
   ```

3. **Verify webhook is working**:
   ```bash
   # Check logs in your application
   # You should see: "🔍 Starting Solana wallet monitoring..."
   ```

### Option B: Using Vercel Cron Jobs

If deployed on Vercel, add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/solana/webhook-monitor",
      "schedule": "* * * * *"
    }
  ]
}
```

### Option C: Manual Polling Script

For development/testing:

```bash
# Create a simple polling script
while true; do
  curl -X POST https://localhost:3000/api/solana/webhook-monitor \
    -H "Authorization: Bearer YOUR_SOLANA_WEBHOOK_API_KEY"
  sleep 60
done
```

---

## Testing

### 1. Test on Devnet

1. **Set environment to devnet**:
   ```env
   NEXT_PUBLIC_SOLANA_NETWORK=devnet
   ```

2. **Get test tokens**:
   - Use faucet to get test SOL and USDC
   - Ensure wallet has sufficient balance

3. **Create a test payment request**:
   - Go to Dashboard → Billing
   - Click "Top Up Wallet" → Select "Solana (USDC/USDT)" tab
   - Enter test amount (e.g., $10)
   - Follow payment instructions

4. **Send test payment from Phantom**:
   - Copy wallet address
   - Copy memo exactly
   - Send exact amount
   - Wait 1-2 minutes

5. **Verify payment**:
   - Check transaction on [Solscan Devnet](https://solscan.io/?cluster=devnet)
   - Verify balance updated in dashboard
   - Check email notification received

### 2. Test Webhook Monitoring

```bash
# Manually trigger webhook
curl -X POST http://localhost:3000/api/solana/webhook-monitor \
  -H "Authorization: Bearer YOUR_SOLANA_WEBHOOK_API_KEY" \
  -H "Content-Type: application/json"

# Expected response:
{
  "success": true,
  "message": "Wallet monitoring completed",
  "stats": {
    "totalTransactions": 0,
    "processedCount": 0,
    "successCount": 0,
    "errorCount": 0
  }
}
```

### 3. Test Email Notifications

Emails are sent automatically when:
- Payment request created (optional)
- Payment verified and balance updated

Check your email inbox for:
- Payment instructions email
- Payment confirmation email

---

## Production Deployment

### Pre-deployment Checklist

- [ ] Phantom Wallet created and secured
- [ ] Secret Recovery Phrase backed up securely
- [ ] Network set to `mainnet-beta`
- [ ] Wallet address verified and added to env vars
- [ ] RPC provider configured (Helius/QuickNode)
- [ ] Webhook API key generated and set
- [ ] QStash/Cron monitoring configured
- [ ] Email system tested and working
- [ ] Database migrations applied
- [ ] Test payment completed on devnet

### Deployment Steps

1. **Update environment variables**:
   ```env
   NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
   PHANTOM_WALLET_ADDRESS=YOUR_MAINNET_WALLET
   HELIUS_API_KEY=your_mainnet_api_key
   ```

2. **Deploy application**:
   ```bash
   # Deploy to Vercel
   vercel --prod

   # Or your deployment method
   npm run build
   ```

3. **Set up monitoring**:
   - Configure QStash schedule for production URL
   - Set up error alerting (Sentry, etc.)
   - Monitor webhook logs

4. **Test live payment**:
   - Send small test payment ($1-5)
   - Verify end-to-end flow
   - Check all emails received

### Security Best Practices

1. **Never commit private keys**:
   - Keep Secret Recovery Phrase offline
   - Use hardware wallet for large amounts
   - Regularly rotate webhook API keys

2. **Monitor wallet balance**:
   - Set up alerts for incoming payments
   - Regularly withdraw to cold storage
   - Keep only operational balance in hot wallet

3. **Rate limiting**:
   - Implement rate limits on payment requests
   - Monitor for suspicious activity
   - Set maximum payment amounts

4. **Audit logging**:
   - Log all payment requests
   - Track failed verifications
   - Monitor webhook activity

---

## Troubleshooting

### Common Issues

#### 1. "Wallet not configured" error

**Problem**: `PHANTOM_WALLET_ADDRESS` not set or invalid

**Solution**:
```bash
# Verify wallet address is set
echo $PHANTOM_WALLET_ADDRESS

# Test wallet address validity
# Should be base58 encoded, 32-44 characters
```

#### 2. Transaction not detected

**Problem**: Payment sent but not showing in dashboard

**Possible causes**:
- Memo missing or incorrect format
- Wrong token type (USDC vs USDT)
- Wrong network (devnet vs mainnet)
- Webhook not running
- Payment request expired

**Solution**:
```bash
# Check webhook is running
curl https://yourdomain.com/api/solana/webhook-monitor \
  -H "Authorization: Bearer YOUR_API_KEY"

# Manually trigger webhook
# Check transaction on Solscan
# Verify memo format exactly matches
```

#### 3. "Amount mismatch" error

**Problem**: Sent amount doesn't match requested amount

**Solution**:
- Send exact amount including decimals
- Account for 1 cent tolerance
- Check token has correct number of decimals (USDC/USDT = 6)

#### 4. Email notifications not working

**Problem**: Emails not being sent or received

**Solution**:
```bash
# Verify Resend API key
# Check email logs
# Test email delivery

# Manually test email
curl -X POST /api/test-email \
  -d '{"to":"test@example.com"}'
```

#### 5. RPC rate limit exceeded

**Problem**: Too many requests to public RPC

**Solution**:
- Sign up for Helius or QuickNode
- Add API key to environment variables
- Implement request caching

### Getting Help

If you encounter issues:

1. **Check logs**:
   ```bash
   # Application logs
   vercel logs

   # Webhook logs
   # Look for "🔍 Starting Solana wallet monitoring..."
   ```

2. **Verify transaction on blockchain**:
   - Devnet: https://solscan.io/?cluster=devnet
   - Mainnet: https://solscan.io/

3. **Contact support**:
   - Email: support@gameofcreators.com
   - Include: transaction signature, error message, logs

---

## API Reference

### Endpoints

#### `POST /api/solana/payment-request`
Create a new payment request

**Request**:
```json
{
  "amount": 50.00,
  "tokenType": "USDC"
}
```

**Response**:
```json
{
  "success": true,
  "paymentRequest": {
    "referenceId": "AB12CD34",
    "amount": 50.00,
    "tokenType": "USDC",
    "memo": "Username: brand123 Amount: 50 ReferenceID: AB12CD34",
    "walletAddress": "Bxp7f...9xK2",
    "expiresAt": "2024-01-20T12:00:00Z"
  }
}
```

#### `POST /api/solana/verify-payment`
Verify a transaction manually

**Request**:
```json
{
  "transactionSignature": "5j7s...",
  "referenceId": "AB12CD34"
}
```

#### `POST /api/solana/webhook-monitor`
Monitor wallet for new transactions (called by webhook)

**Headers**:
```
Authorization: Bearer YOUR_WEBHOOK_API_KEY
```

#### `GET /api/solana/transactions`
Get user's Solana transaction history

---

## Token Mint Addresses

### USDC
- **Mainnet**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **Devnet**: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`

### USDT
- **Mainnet**: `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
- **Devnet**: `EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS`

---

## Additional Resources

- [Solana Documentation](https://docs.solana.com/)
- [Phantom Wallet Docs](https://docs.phantom.app/)
- [SPL Token Program](https://spl.solana.com/token)
- [Helius Documentation](https://docs.helius.dev/)
- [Solscan Explorer](https://solscan.io/)

---

## License

Internal documentation for Game of Creators platform.

Last Updated: 2024

