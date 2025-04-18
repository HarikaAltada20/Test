# GoViral: Full Integration Guide for Cursor (Step-by-Step)

> This document outlines the step-by-step technical instructions Cursor should follow to implement the GoViral platform features using the new Supabase schema and buckets already created.

---

## ✅ Step 1: Authentication Flow (Signup + OTP + Username Setup)

### 🔹 1.1 Signup Page
- Fields to collect:
  - `full_name`
  - `email`
  - `password`
  - `user_type`: 'creator' or 'advertiser'
  - `referral_code` (optional)

- Action:
  - Call `supabase.auth.signUp({ email, password })`
  - Supabase will send an **OTP** (not magic link)
  - Save user_type and referral_code temporarily (local/session state)
  - Redirect user to `/verify-otp?email=<user_email>`

---

### 🔹 1.2 OTP Verification Page `/verify-otp`
- Input field for 6-digit OTP
- Use this call:
```ts
supabase.auth.verifyOtp({
  email,
  token: otp,
  type: 'signup'
})
```
- On success:
  - Redirect to `/choose-username`

---

### 🔹 1.3 Choose Username Page `/choose-username`
- Single input: `username`
- Validation:
  - Must be unique in `users.username`
- On submission:
  - Call RPC to:
    - Update `users.username`
    - Set `referral_code = username`
    - If `referral_code` was provided and valid:
      - Increment referral stats for referrer:
        - `coins += 100`
        - If referred a creator, `creators_referred += 1`
        - If referred an advertiser, `advertisers_referred += 1`
      - Add `coin_transactions` for both referrer and new user
    - Create profile in:
      - `creator_profiles` if user_type is `creator`
      - `advertiser_profiles` if user_type is `advertiser`
  - Redirect to `/login` with success message: `Account created successfully!`

> ⚠️ `username` must remain permanent (used as referral_code). No option to change it later.

---

## ✅ Step 2: Wallet & Coins Display on Dashboard

### 🔹 2.1 Creator Dashboard
- Show:
  - Coins from `users.coins`
  - Money (withdrawable_balance from `creator_profiles`)
  - Buttons: "View Coin History", "View Transaction History"

### 🔹 2.2 Advertiser Dashboard
- Show:
  - Coins from `users.coins`
  - Money (withdrawable_balance + deposit_balance from `advertiser_profiles`)
  - Buttons: "View Coin History", "View Transaction History"

### 🔹 2.3 History Pages
- Coin Transactions: from `coin_transactions` sorted by `created_at`
- Money Transactions: from `money_transactions` sorted by `created_at`

---

## ✅ Step 3: Settings Page

### 🔹 Display Info:
- Common:
  - Full name
  - Email (readonly)
  - Username / Referral code
  - user_type
  - referral_code used (readonly if exists)
  - coins
  - IP address (can be tracked at registration)

- Creators:
  - Total contests participated
  - Total contests won
  - Total money won
  - Withdrawable balance

- Advertisers:
  - Total contests run
  - Total money spent
  - Withdrawable balance
  - Deposit balance

### 🔹 Actionable:
- Add referral code (if none exists)
  - One-time only
  - Validate before storing in `users.referred_by`
  - Trigger coin bonus logic for both users





Great! Here's a well-structured **prompt** that you can directly provide to **Cursor** to implement **Step 1 to Step 3**, based on your codebase and the new schema we finalized:

---


