# Solana Payment System - Quick Start Guide

Get your Solana payment system up and running in 15 minutes.

---

## 🚀 Quick Setup (5 Steps)

### Step 1: Create Phantom Wallet (5 minutes)

1. **Download Phantom**:
   - Mobile: [iOS App Store](https://apps.apple.com/app/phantom-solana-wallet/1598432977) | [Android Play Store](https://play.google.com/store/apps/details?id=app.phantom.android)
   - Desktop: [Chrome Extension](https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa)

2. **Create New Wallet**:
   - Open app/extension → "Create new wallet"
   - ⚠️ **CRITICAL**: Write down your 12-word recovery phrase
   - Set password/PIN

3. **Get Wallet Address**:
   - Tap/click wallet name → Copy address
   - Format: `Bxp7fFjgPvP...HSxxsZ9xK2`
   - ✅ Save this address - you'll need it!

### Step 2: Add Environment Variables (2 minutes)

Add to `.env.local`:

```env
# For Testing (Devnet)
NEXT_PUBLIC_SOLANA_NETWORK=devnet
PHANTOM_WALLET_ADDRESS=YOUR_WALLET_ADDRESS_HERE

# For Production (Mainnet) - uncomment when ready
# NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
# PHANTOM_WALLET_ADDRESS=YOUR_WALLET_ADDRESS_HERE

# Security (generate using command below)
SOLANA_WEBHOOK_API_KEY=your_generated_key_here
```

**Generate webhook key by running this command:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste it as the value for `SOLANA_WEBHOOK_API_KEY` above

### Step 3: Setup Database (3 minutes)

Run SQL migration:

**Option A: Supabase Dashboard**
1. Go to SQL Editor in Supabase
2. Copy contents of `SUPABASE/solana_payments.sql`
3. Execute query

**Option B: Command Line**
```bash
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d YOUR_DB_NAME -f SUPABASE/solana_payments.sql
```

### Step 4: Test the System (3 minutes)

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to Dashboard → Billing**

3. **Click "Top Up Wallet" → Select "Solana (USDC/USDT)" tab**

4. **Create a test payment request**:
   - Enter amount: $10
   - Select token: USDC
   - Click "Continue to Payment"

5. **You should see**:
   - Payment instructions
   - Wallet address
   - Memo to include
   - Reference ID

✅ If you see this screen, setup is working!

### Step 5: Setup Webhook Monitoring (2 minutes)

**For Development (Manual Testing)**:
```bash
# In a new terminal, run this to manually trigger monitoring
curl -X POST http://localhost:3000/api/solana/webhook-monitor \
  -H "Authorization: Bearer YOUR_WEBHOOK_API_KEY"
```

**For Production (Automated - Choose One)**:

**Option A: QStash (Recommended)**
1. Sign up at [Upstash](https://upstash.com/)
2. Create schedule:
   ```bash
   curl -X POST https://qstash.upstash.io/v1/schedules \
     -H "Authorization: Bearer YOUR_QSTASH_TOKEN" \
     -d '{
       "destination": "https://yourdomain.com/api/solana/webhook-monitor",
       "cron": "* * * * *",
       "headers": {"Authorization": "Bearer YOUR_WEBHOOK_API_KEY"}
     }'
   ```

**Option B: Vercel Cron**
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/solana/webhook-monitor",
    "schedule": "* * * * *"
  }]
}
```

---

## ✅ Verification Checklist

Before going live:

- [ ] Phantom wallet created and backup phrase secured
- [ ] Wallet address added to environment variables
- [ ] Database tables created successfully
- [ ] Can see payment request creation screen
- [ ] Webhook API key generated
- [ ] Webhook monitoring configured
- [ ] Resend email configured (for notifications)

---

## 🧪 Testing on Devnet

### 1. Get Test Tokens

**Get test SOL** (for transaction fees):
```bash
solana airdrop 2 YOUR_WALLET_ADDRESS --url devnet
```

**Get test USDC**:
- Visit: [SPL Token Faucet](https://spl-token-faucet.com/)
- Connect Phantom wallet (set to Devnet)
- Request USDC tokens

### 2. Send Test Payment

1. **In your app, create payment request**:
   - Dashboard → Billing → Top Up → Solana tab
   - Amount: $10
   - Token: USDC

2. **Copy payment details**:
   - Wallet address
   - Memo (exact copy!)
   - Amount

3. **Send from Phantom**:
   - Open Phantom → Set network to Devnet
   - Click Send
   - Paste wallet address
   - Enter amount: 10 USDC
   - **Add memo** (click "Add memo" button)
   - Paste memo exactly
   - Send transaction

4. **Verify payment**:
   - Wait 1-2 minutes
   - Manually trigger webhook:
     ```bash
     curl -X POST http://localhost:3000/api/solana/webhook-monitor \
       -H "Authorization: Bearer YOUR_WEBHOOK_API_KEY"
     ```
   - Check dashboard balance updated
   - Check email notification received

5. **View on blockchain**:
   - Go to [Solscan Devnet](https://solscan.io/?cluster=devnet)
   - Search for transaction signature
   - Verify details

---

## 🚀 Going to Production

### 1. Switch to Mainnet

Update `.env.local`:
```env
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
PHANTOM_WALLET_ADDRESS=YOUR_MAINNET_WALLET
```

### 2. Use Enhanced RPC (Recommended)

Sign up for [Helius](https://helius.dev) and add:
```env
HELIUS_API_KEY=your_api_key_here
```

### 3. Deploy

```bash
vercel --prod
```

### 4. Test with Small Amount

Send a real $1-5 payment to verify everything works.

---

## 📊 Monitoring & Maintenance

### Check Webhook Status

```bash
curl https://yourdomain.com/api/solana/webhook-monitor \
  -H "Authorization: Bearer YOUR_WEBHOOK_API_KEY"
```

### View Transaction Logs

In your app:
- Dashboard → Billing → Solana Transactions section

### Monitor Wallet Balance

Regularly check your Phantom wallet and withdraw to cold storage.

---

## 🆘 Common Issues

### "Wallet not configured"
**Fix**: Check `PHANTOM_WALLET_ADDRESS` is set in environment variables

### "Transaction not detected"
**Fix**: 
1. Check memo was included exactly as shown
2. Manually trigger webhook
3. Verify on Solscan
4. Check correct network (devnet vs mainnet)

### "Amount mismatch"
**Fix**: Send exact amount including decimals (e.g., $50.00 not $50)

### Email not received
**Fix**: 
1. Check RESEND_API_KEY is set
2. Verify email in Resend dashboard
3. Check spam folder

---

## 📚 Next Steps

- [ ] Read full documentation: `DOCS/SOLANA_PAYMENT_SETUP.md`
- [ ] Set up monitoring alerts
- [ ] Configure rate limiting
- [ ] Implement withdrawal system
- [ ] Set up cold storage for large balances

---

## 🔗 Quick Links

- [Full Setup Guide](./SOLANA_PAYMENT_SETUP.md)
- [Phantom Wallet](https://phantom.app/)
- [Solscan Explorer](https://solscan.io/)
- [Solana Devnet Faucet](https://faucet.solana.com/)
- [SPL Token Faucet](https://spl-token-faucet.com/)
- [Helius RPC](https://helius.dev)

---

## 💬 Support

Questions? Issues?
- Email: support@gameofcreators.com
- Check logs in `/api/solana/webhook-monitor`
- Verify transactions on Solscan

---

**Ready to accept Solana payments in 15 minutes! 🎉**

