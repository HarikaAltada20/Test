# Stripe Payment Gateway Setup Guide

## Step 1: Get Your Stripe API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`)

## Step 2: Create Environment File

Create a `.env.local` file in your project root and add these variables:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key_here

# Stripe Webhook Secret (you'll get this later when setting up webhooks)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Step 3: Replace the Placeholder Values

Replace the placeholder values with your actual Stripe keys:
- `sk_test_your_actual_secret_key_here` → Your actual secret key
- `pk_test_your_actual_publishable_key_here` → Your actual publishable key

## Step 4: Restart Your Development Server

After adding the environment variables, restart your Next.js development server:

```bash
npm run dev
```

## Important Notes

- Keep your secret key secure and never commit it to version control
- Use test keys during development
- Switch to live keys only when ready for production
- The `.env.local` file is already in `.gitignore` so it won't be committed

## What's Next?

Once you've completed these steps, we'll continue with implementing the payment integration features. 