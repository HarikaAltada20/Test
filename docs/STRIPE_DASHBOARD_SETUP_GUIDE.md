# GoViral Stripe Dashboard Setup Guide
**Manual Product & Price Creation (No CLI Required)**

Since you have a **GOC sandbox** set up, let's create everything through the visual interface!

---

## Step 1: Access Your Stripe Dashboard

1. Go to **https://dashboard.stripe.com**
2. Make sure you're in **Test Mode** (you should see "Test" in top left)
3. Navigate to **Products** in the left sidebar

---

## Step 2: Create Products (4 Products Total)

### Product 1: EXPLORER (Free Plan)

1. **Click "Add Product" button**
2. **Fill in the form:**
   - **Name:** `EXPLORER`
   - **Description:** `Entry-level users, startups, or small businesses wanting to test the platform`
   - **Images:** (Skip for now)
   - **Statement descriptor:** (Leave empty)
   - **Unit label:** (Leave empty)

3. **Click "Save Product"**
4. **📝 IMPORTANT:** Copy the Product ID that appears (starts with `prod_`)
   - Example: `prod_ABC123XYZ`
   - **Write this down!**

### Product 2: STARTER Plan

1. **Click "Add Product" button**
2. **Fill in the form:**
   - **Name:** `STARTER`
   - **Description:** `Small to medium-sized businesses that want to run more contests and grow their presence`

3. **Click "Save Product"**
4. **📝 Copy Product ID:** `prod_DEF456UVW`

### Product 3: BUILDER Plan

1. **Click "Add Product" button**
2. **Fill in the form:**
   - **Name:** `BUILDER`
   - **Description:** `Medium to large brands scaling their presence and want more contests and flexibility`

3. **Click "Save Product"**
4. **📝 Copy Product ID:** `prod_GHI789RST`

### Product 4: CHAMPION Plan

1. **Click "Add Product" button**
2. **Fill in the form:**
   - **Name:** `CHAMPION`
   - **Description:** `Large businesses, agencies, and enterprises looking to run high-volume campaigns with premium support`

3. **Click "Save Product"**
4. **📝 Copy Product ID:** `prod_JKL012MNO`

---

## Step 3: Create Prices (7 Prices Total)

Now you need to add pricing to each product. **Click on each product** to add prices.

### EXPLORER Product - Add 1 Price

1. **Click on "EXPLORER" product**
2. **Click "Add another price"**
3. **Fill in pricing details:**
   - **Pricing model:** `Standard pricing`
   - **Price:** `$0.00` (Free!)
   - **Billing period:** `Monthly`
   - **Currency:** `USD`
4. **Click "Save"**
5. **📝 Copy Price ID:** `price_ABC123free`

### STARTER Product - Add 2 Prices

**Price 1: Monthly**
1. **Click on "STARTER" product**
2. **Click "Add another price"**
3. **Fill in:**
   - **Price:** `$100.00`
   - **Billing period:** `Monthly`
   - **Currency:** `USD`
4. **Click "Save"**
5. **📝 Copy Price ID:** `price_DEF456monthly`

**Price 2: Yearly**
1. **Click "Add another price"** (still in STARTER product)
2. **Fill in:**
   - **Price:** `$1000.00`
   - **Billing period:** `Yearly`
   - **Currency:** `USD`
3. **Click "Save"**
4. **📝 Copy Price ID:** `price_DEF456yearly`

### BUILDER Product - Add 2 Prices

**Price 1: Monthly**
1. **Click on "BUILDER" product**
2. **Click "Add another price"**
3. **Fill in:**
   - **Price:** `$250.00`
   - **Billing period:** `Monthly`
   - **Currency:** `USD`
4. **📝 Copy Price ID:** `price_GHI789monthly`

**Price 2: Yearly**
1. **Click "Add another price"**
2. **Fill in:**
   - **Price:** `$2500.00`
   - **Billing period:** `Yearly`
   - **Currency:** `USD`
3. **📝 Copy Price ID:** `price_GHI789yearly`

### CHAMPION Product - Add 2 Prices

**Price 1: Monthly**
1. **Click on "CHAMPION" product**
2. **Click "Add another price"**
3. **Fill in:**
   - **Price:** `$500.00`
   - **Billing period:** `Monthly`
   - **Currency:** `USD`
4. **📝 Copy Price ID:** `price_JKL012monthly`

**Price 2: Yearly**
1. **Click "Add another price"**
2. **Fill in:**
   - **Price:** `$5000.00`
   - **Billing period:** `Yearly`
   - **Currency:** `USD`
3. **📝 Copy Price ID:** `price_JKL012yearly`

---

## Step 4: Track Your Real IDs

**Create this file:** `stripe_real_ids.txt`

```
=== GoViral Real Stripe IDs (Test Mode) ===

PRODUCTS:
EXPLORER: prod_[your_actual_id_here]
STARTER:  prod_[your_actual_id_here]
BUILDER:  prod_[your_actual_id_here]
CHAMPION: prod_[your_actual_id_here]

PRICES:
EXPLORER Monthly (Free): price_[your_actual_id_here]
STARTER Monthly ($100):  price_[your_actual_id_here]
STARTER Yearly ($1000):  price_[your_actual_id_here]
BUILDER Monthly ($250):  price_[your_actual_id_here]
BUILDER Yearly ($2500):  price_[your_actual_id_here]
CHAMPION Monthly ($500): price_[your_actual_id_here]
CHAMPION Yearly ($5000): price_[your_actual_id_here]
```

---

## Step 5: Verify Your Setup

1. **Go to Products page** in Stripe Dashboard
2. **You should see 4 products:**
   - EXPLORER
   - STARTER  
   - BUILDER
   - CHAMPION

3. **Click each product** to verify prices:
   - EXPLORER: 1 price ($0/month)
   - STARTER: 2 prices ($100/month, $1000/year)
   - BUILDER: 2 prices ($250/month, $2500/year)
   - CHAMPION: 2 prices ($500/month, $5000/year)

---

## Step 6: Copy All Your IDs

**CRITICAL:** You need to copy **11 total IDs:**
- ✅ 4 Product IDs (prod_xxx)
- ✅ 7 Price IDs (price_xxx)

**Where to find IDs:**
1. **Product IDs:** On the main Products page, click product name, ID is in the URL or top of page
2. **Price IDs:** Click product → you'll see all prices listed with their IDs

---

## Step 7: Ready for Database Integration

Once you have **all 11 IDs**, I'll help you:

1. ✅ **Update database migration** with your real IDs
2. ✅ **Create API endpoints** for subscription management
3. ✅ **Build React pricing page** that uses real Stripe data
4. ✅ **Setup webhook handling** for payment events

---

## Visual Guide Summary

```
Dashboard → Products → Add Product (4x) → Add Prices (7x) → Copy IDs (11x)
```

## Troubleshooting

**Can't find Product ID?**
- Click product name → URL will show: `https://dashboard.stripe.com/products/prod_ABC123XYZ`

**Can't find Price ID?**
- Click product → scroll down to "Pricing" section → IDs are listed there

**Made a mistake?**
- You can edit products/prices anytime
- You can archive (soft delete) if needed

---

## Next Steps

🚀 **After you create everything:**
1. Send me your **stripe_real_ids.txt** file
2. I'll update the database migration with your real IDs
3. We'll continue building the subscription system!

**Need help during creation?** Let me know where you get stuck! 