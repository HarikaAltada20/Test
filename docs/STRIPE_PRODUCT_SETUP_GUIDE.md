# GoViral Stripe Products & Prices Setup Guide

## Prerequisites

### 1. Install Stripe CLI
```bash
# Windows (using Chocolatey)
choco install stripe-cli

# Or download from: https://github.com/stripe/stripe-cli/releases
```

### 2. Login to Stripe
```bash
# This will open browser for authentication
stripe login

# Verify connection
stripe config --list
```

### 3. Set Test Mode (Development)
```bash
# Work with test data initially
stripe config --set test_mode_default true
```

---

## Step 1: Create Products in Stripe

### EXPLORER Plan (Free)
```bash
stripe products create \
  --name="EXPLORER" \
  --description="Entry-level users, startups, or small businesses wanting to test the platform" \
  --metadata[display_name]="Explorer Plan" \
  --metadata[sort_order]="0" \
  --metadata[plan_type]="free"
```

**Expected Output:**
```json
{
  "id": "prod_ABC123XYZ",
  "name": "EXPLORER",
  ...
}
```
📝 **SAVE THIS ID**: `prod_ABC123XYZ` (your actual ID will be different)

### STARTER Plan  
```bash
stripe products create \
  --name="STARTER" \
  --description="Small to medium-sized businesses that want to run more contests and grow their presence" \
  --metadata[display_name]="Starter Plan" \
  --metadata[sort_order]="1" \
  --metadata[plan_type]="paid"
```
📝 **SAVE THIS ID**: `prod_DEF456UVW`

### BUILDER Plan
```bash
stripe products create \
  --name="BUILDER" \
  --description="Medium to large brands scaling their presence and want more contests and flexibility" \
  --metadata[display_name]="Builder Plan" \
  --metadata[sort_order]="2" \
  --metadata[plan_type]="paid"
```
📝 **SAVE THIS ID**: `prod_GHI789RST`

### CHAMPION Plan
```bash
stripe products create \
  --name="CHAMPION" \
  --description="Large businesses, agencies, and enterprises looking to run high-volume campaigns with premium support" \
  --metadata[display_name]="Champion Plan" \
  --metadata[sort_order]="3" \
  --metadata[plan_type]="enterprise"
```
📝 **SAVE THIS ID**: `prod_JKL012MNO`

---

## Step 2: Create Prices for Each Product

### EXPLORER Plan - Free Monthly
```bash
stripe prices create \
  --product="prod_ABC123XYZ" \
  --unit-amount=0 \
  --currency=usd \
  --recurring[interval]=month \
  --metadata[plan]="EXPLORER" \
  --metadata[billing]="monthly"
```
📝 **SAVE THIS ID**: `price_explorer_monthly_ABC`

### STARTER Plan Prices

**Monthly ($100)**
```bash
stripe prices create \
  --product="prod_DEF456UVW" \
  --unit-amount=10000 \
  --currency=usd \
  --recurring[interval]=month \
  --metadata[plan]="STARTER" \
  --metadata[billing]="monthly"
```
📝 **SAVE THIS ID**: `price_starter_monthly_DEF`

**Yearly ($1,000 - Save $200)**
```bash
stripe prices create \
  --product="prod_DEF456UVW" \
  --unit-amount=100000 \
  --currency=usd \
  --recurring[interval]=year \
  --metadata[plan]="STARTER" \
  --metadata[billing]="yearly" \
  --metadata[savings]="20000"
```
📝 **SAVE THIS ID**: `price_starter_yearly_GHI`

### BUILDER Plan Prices

**Monthly ($250)**
```bash
stripe prices create \
  --product="prod_GHI789RST" \
  --unit-amount=25000 \
  --currency=usd \
  --recurring[interval]=month \
  --metadata[plan]="BUILDER" \
  --metadata[billing]="monthly"
```
📝 **SAVE THIS ID**: `price_builder_monthly_JKL`

**Yearly ($2,500 - Save $500)**
```bash
stripe prices create \
  --product="prod_GHI789RST" \
  --unit-amount=250000 \
  --currency=usd \
  --recurring[interval]=year \
  --metadata[plan]="BUILDER" \
  --metadata[billing]="yearly" \
  --metadata[savings]="50000"
```
📝 **SAVE THIS ID**: `price_builder_yearly_MNO`

### CHAMPION Plan Prices

**Monthly ($500)**
```bash
stripe prices create \
  --product="prod_JKL012MNO" \
  --unit-amount=50000 \
  --currency=usd \
  --recurring[interval]=month \
  --metadata[plan]="CHAMPION" \
  --metadata[billing]="monthly"
```
📝 **SAVE THIS ID**: `price_champion_monthly_PQR`

**Yearly ($5,000 - Save $1,000)**
```bash
stripe prices create \
  --product="prod_JKL012MNO" \
  --unit-amount=500000 \
  --currency=usd \
  --recurring[interval]=year \
  --metadata[plan]="CHAMPION" \
  --metadata[billing]="yearly" \
  --metadata[savings]="100000"
```
📝 **SAVE THIS ID**: `price_champion_yearly_STU`

---

## Step 3: Verify Your Setup

### List All Products
```bash
stripe products list --limit=10
```

### List All Prices
```bash
stripe prices list --limit=20
```

### Get Specific Product Details
```bash
stripe products retrieve prod_ABC123XYZ
```

---

## Step 4: Export Your IDs

Create a file to track your real Stripe IDs:

```bash
# Create stripe_ids.txt
echo "=== GoViral Stripe IDs ===" > stripe_ids.txt
echo "" >> stripe_ids.txt
echo "PRODUCTS:" >> stripe_ids.txt
echo "EXPLORER: prod_ABC123XYZ" >> stripe_ids.txt
echo "STARTER:  prod_DEF456UVW" >> stripe_ids.txt  
echo "BUILDER:  prod_GHI789RST" >> stripe_ids.txt
echo "CHAMPION: prod_JKL012MNO" >> stripe_ids.txt
echo "" >> stripe_ids.txt
echo "PRICES:" >> stripe_ids.txt
echo "EXPLORER Monthly: price_explorer_monthly_ABC" >> stripe_ids.txt
echo "STARTER Monthly:  price_starter_monthly_DEF" >> stripe_ids.txt
echo "STARTER Yearly:   price_starter_yearly_GHI" >> stripe_ids.txt
echo "BUILDER Monthly:  price_builder_monthly_JKL" >> stripe_ids.txt
echo "BUILDER Yearly:   price_builder_yearly_MNO" >> stripe_ids.txt
echo "CHAMPION Monthly: price_champion_monthly_PQR" >> stripe_ids.txt
echo "CHAMPION Yearly:  price_champion_yearly_STU" >> stripe_ids.txt
```

---

## Step 5: Production Setup (Later)

When ready for production:

```bash
# Switch to live mode
stripe config --set test_mode_default false

# Re-run all the same commands above
# You'll get different IDs for production
```

---

## Troubleshooting

### View Recent API Calls
```bash
stripe logs tail
```

### Delete a Product (if needed)
```bash
stripe products delete prod_ABC123XYZ
```

### Update Product Metadata
```bash
stripe products update prod_ABC123XYZ \
  --metadata[updated]="true"
```

---

## Next Steps

1. ✅ Run these commands and collect your IDs
2. ✅ Update database migration with real IDs  
3. ✅ Test subscription creation flow
4. ✅ Implement webhook handling
5. ✅ Switch to production when ready

## Important Notes

- **Test Mode**: All commands above create test data
- **Real Money**: Switch to live mode only when ready
- **IDs Are Permanent**: Once created, use these IDs in your database
- **Webhooks**: You'll need webhook endpoints for subscription updates 