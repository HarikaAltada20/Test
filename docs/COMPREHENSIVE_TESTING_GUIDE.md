# Comprehensive Testing Guide - Game of Creators Platform

## 🎯 Overview

This guide provides a complete testing strategy for all implemented features including payment gateway integration, UI/UX improvements, and platform functionality.

## 📋 Pre-Testing Checklist

### Environment Setup
- [ ] `.env.local` file configured with Stripe keys
- [ ] Supabase database properly set up
- [ ] Development server running (`npm run dev`)
- [ ] Stripe webhook endpoint configured
- [ ] Test Stripe cards ready

### Required Test Data
- [ ] Test brand account (advertiser)
- [ ] Test creator account
- [ ] Admin account
- [ ] Sample contests in various states

---

## 🧪 1. Payment Gateway Integration Testing

### 1.1 Stripe Configuration Test

**Objective**: Verify Stripe is properly configured

**Steps**:
1. Check environment variables are loaded:
   ```bash
   # In browser console
   console.log(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
   ```

2. Verify Stripe client loads:
   ```javascript
   // In browser console
   import { getStripe } from '@/lib/stripe';
   getStripe().then(stripe => console.log('Stripe loaded:', !!stripe));
   ```

**Expected Result**: Stripe client loads without errors

### 1.2 Wallet Top-Up Testing

**Objective**: Test wallet deposit functionality

**Test Cases**:

#### A. Successful Top-Up
1. Go to Dashboard → Billing
2. Click "Top Up Wallet"
3. Enter amount: $50.00
4. Use test card: `4242424242424242`
5. Complete payment

**Expected Results**:
- ✅ Payment processes successfully
- ✅ Wallet balance updates immediately
- ✅ Transaction logged in `money_transactions`
- ✅ Success toast notification

#### B. Failed Payment
1. Use declined card: `4000000000000002`
2. Attempt payment

**Expected Results**:
- ✅ Payment fails gracefully
- ✅ Error message displayed
- ✅ No balance change
- ✅ Failed transaction logged

#### C. Authentication Required
1. Use card requiring 3D Secure: `4000002500003155`
2. Complete authentication flow

**Expected Results**:
- ✅ 3D Secure flow works
- ✅ Payment completes after authentication
- ✅ Balance updates correctly

### 1.3 Contest Payment Testing

**Objective**: Test contest creation with payment

**Test Cases**:

#### A. Wallet-Only Payment
1. Ensure wallet has sufficient balance
2. Create contest with prize amount
3. Submit for review
4. Select "Wallet" payment method

**Expected Results**:
- ✅ Payment processes instantly
- ✅ Contest status changes to "Pending Approval"
- ✅ Wallet balance deducted
- ✅ Transaction logged

#### B. Stripe-Only Payment
1. Create contest with insufficient wallet balance
2. Select "Credit Card" payment method
3. Use test card: `4242424242424242`

**Expected Results**:
- ✅ Stripe payment form appears
- ✅ Payment processes successfully
- ✅ Contest status updates
- ✅ Transaction logged

#### C. Split Payment
1. Create contest with partial wallet balance
2. Select "Split Payment" option
3. Complete both wallet and Stripe portions

**Expected Results**:
- ✅ Both payment methods work
- ✅ Correct amounts deducted from each
- ✅ Contest creation succeeds
- ✅ Both transactions logged

### 1.4 Webhook Testing

**Objective**: Verify Stripe webhook processing

**Steps**:
1. Use Stripe CLI to forward webhooks:
   ```bash
   stripe listen --forward-to localhost:3000/api/payments/webhook
   ```

2. Make a test payment
3. Check webhook logs in terminal

**Expected Results**:
- ✅ Webhook received and processed
- ✅ Transaction status updated
- ✅ No errors in webhook handler

### 1.5 Currency Conversion Testing

**Objective**: Verify cents/dollars conversion

**Test Cases**:
1. Enter amounts with decimals: $10.99, $100.50
2. Check database storage (should be in cents)
3. Verify UI display (should show dollars)

**Expected Results**:
- ✅ Database stores amounts in cents
- ✅ UI displays amounts in dollars
- ✅ No conversion errors

---

## 🎨 2. UI/UX Improvements Testing

### 2.1 Homepage Testing

**Objective**: Verify homepage improvements

**Test Cases**:

#### A. Rotating Taglines
1. Refresh homepage multiple times
2. Check tagline rotation

**Expected Results**:
- ✅ Taglines rotate on each refresh
- ✅ Professional, epic content
- ✅ Smooth transitions

#### B. Color Scheme Consistency
1. Check main heading colors
2. Verify button colors
3. Test responsive design

**Expected Results**:
- ✅ Creators: Orange theme
- ✅ Brands: Purple theme
- ✅ Buttons match theme colors
- ✅ Mobile responsive

#### C. Text Size Adjustments
1. Check heading sizes
2. Verify readability

**Expected Results**:
- ✅ Text sizes appropriate
- ✅ Good readability
- ✅ Visual balance maintained

### 2.2 Brands Page Testing

**Objective**: Verify brands page improvements

**Test Cases**:
1. Check headline layout (2-line format)
2. Verify color consistency
3. Test responsive design

**Expected Results**:
- ✅ Clean 2-line headline layout
- ✅ Purple theme for brands
- ✅ Mobile responsive

### 2.3 Creators Page Testing

**Objective**: Verify creators page improvements

**Test Cases**:
1. Check color consistency
2. Verify orange theme
3. Test responsive design

**Expected Results**:
- ✅ Orange theme throughout
- ✅ Consistent branding
- ✅ Mobile responsive

### 2.4 Pricing Page Testing

**Objective**: Verify pricing page improvements

**Test Cases**:
1. Check rotating taglines
2. Verify plan cards
3. Test color scheme
4. Check responsive design

**Expected Results**:
- ✅ Taglines rotate
- ✅ Plan cards look professional
- ✅ Consistent color scheme
- ✅ Mobile responsive

### 2.5 Footer Testing

**Objective**: Verify footer cleanup

**Test Cases**:
1. Check all links work
2. Verify no placeholder links
3. Confirm newsletter section removed

**Expected Results**:
- ✅ All links functional
- ✅ No broken links
- ✅ Clean, minimal footer

---

## 🔧 3. Platform Functionality Testing

### 3.1 Authentication Testing

**Objective**: Verify authentication system

**Test Cases**:

#### A. User Registration
1. Create new account
2. Verify email confirmation
3. Test username selection

**Expected Results**:
- ✅ Account creation works
- ✅ Email confirmation sent
- ✅ Username selection functional

#### B. User Login
1. Login with valid credentials
2. Test "Remember Me" functionality
3. Test logout

**Expected Results**:
- ✅ Login successful
- ✅ Session management works
- ✅ Logout clears session

#### C. Password Reset
1. Request password reset
2. Check email delivery
3. Complete reset process

**Expected Results**:
- ✅ Reset email sent
- ✅ Reset link works
- ✅ Password updated successfully

### 3.2 Contest Management Testing

**Objective**: Verify contest creation and management

**Test Cases**:

#### A. Contest Creation Flow
1. Complete contest creation wizard
2. Test all form validation
3. Verify file uploads
4. Test draft saving

**Expected Results**:
- ✅ All steps work
- ✅ Validation prevents errors
- ✅ Files upload successfully
- ✅ Drafts save properly

#### B. Contest Moderation
1. Submit contest for approval
2. Test admin approval/rejection
3. Verify status changes

**Expected Results**:
- ✅ Submission works
- ✅ Admin can moderate
- ✅ Status updates correctly

#### C. Contest Publishing
1. Publish approved contest
2. Verify public visibility
3. Test contest details page

**Expected Results**:
- ✅ Contest goes live
- ✅ Public page accessible
- ✅ All details display correctly

### 3.3 Creator Features Testing

**Objective**: Verify creator functionality

**Test Cases**:

#### A. Contest Discovery
1. Browse available contests
2. Test filtering and search
3. View contest details

**Expected Results**:
- ✅ Contests display correctly
- ✅ Filtering works
- ✅ Details page functional

#### B. Submission Process
1. Submit content to contest
2. Test file uploads
3. Verify submission tracking

**Expected Results**:
- ✅ Submission successful
- ✅ Files upload correctly
- ✅ Tracking works

#### C. Earnings Dashboard
1. Check earnings display
2. Test transaction history
3. Verify payout status

**Expected Results**:
- ✅ Earnings calculated correctly
- ✅ History displays properly
- ✅ Payout status accurate

---

## 🛠️ 4. Database and API Testing

### 4.1 Database Schema Testing

**Objective**: Verify database structure

**Steps**:
1. Run database verification script:
   ```bash
   node scripts/verify-database-setup.js
   ```

2. Check all required tables exist
3. Verify constraints and indexes

**Expected Results**:
- ✅ All tables present
- ✅ Constraints working
- ✅ Indexes optimized

### 4.2 API Endpoint Testing

**Objective**: Verify API functionality

**Test Cases**:

#### A. Payment APIs
1. Test `/api/payments/deposit`
2. Test `/api/payments/contest`
3. Test `/api/payments/webhook`

**Expected Results**:
- ✅ All endpoints respond
- ✅ Proper error handling
- ✅ Data validation works

#### B. Contest APIs
1. Test contest CRUD operations
2. Verify moderation endpoints
3. Check submission APIs

**Expected Results**:
- ✅ CRUD operations work
- ✅ Moderation functions
- ✅ Submissions process

#### C. User APIs
1. Test user profile updates
2. Verify authentication endpoints
3. Check balance queries

**Expected Results**:
- ✅ Profile updates work
- ✅ Auth endpoints secure
- ✅ Balance queries accurate

---

## 🚀 5. Performance Testing

### 5.1 Load Testing

**Objective**: Verify performance under load

**Test Cases**:
1. Multiple concurrent users
2. Large file uploads
3. Database query performance

**Expected Results**:
- ✅ Handles concurrent users
- ✅ File uploads complete
- ✅ Queries remain fast

### 5.2 Mobile Testing

**Objective**: Verify mobile responsiveness

**Test Cases**:
1. Test on various screen sizes
2. Check touch interactions
3. Verify mobile navigation

**Expected Results**:
- ✅ Responsive on all screens
- ✅ Touch-friendly interface
- ✅ Mobile navigation works

---

## 🔍 6. Security Testing

### 6.1 Authentication Security

**Objective**: Verify security measures

**Test Cases**:
1. Test unauthorized access
2. Verify session management
3. Check CSRF protection

**Expected Results**:
- ✅ Unauthorized access blocked
- ✅ Sessions secure
- ✅ CSRF protection active

### 6.2 Payment Security

**Objective**: Verify payment security

**Test Cases**:
1. Test webhook signature verification
2. Verify payment validation
3. Check fraud prevention

**Expected Results**:
- ✅ Webhook signatures verified
- ✅ Payment data validated
- ✅ Fraud prevention active

---

## 📊 7. Monitoring and Logging

### 7.1 Error Monitoring

**Objective**: Verify error tracking

**Steps**:
1. Check browser console for errors
2. Monitor server logs
3. Verify error notifications

**Expected Results**:
- ✅ No console errors
- ✅ Server logs clean
- ✅ Errors properly logged

### 7.2 Transaction Logging

**Objective**: Verify transaction tracking

**Steps**:
1. Check `money_transactions` table
2. Verify webhook logs
3. Test audit trail

**Expected Results**:
- ✅ All transactions logged
- ✅ Webhook events tracked
- ✅ Audit trail complete

---

## 🎯 8. Final Validation Checklist

### Payment System
- [ ] Wallet top-up works
- [ ] Contest payments process
- [ ] Split payments function
- [ ] Webhooks handle events
- [ ] Currency conversion accurate
- [ ] Transaction logging complete

### UI/UX
- [ ] Homepage improvements visible
- [ ] Color scheme consistent
- [ ] Text sizes appropriate
- [ ] Footer cleaned up
- [ ] Mobile responsive
- [ ] Loading states smooth

### Platform Features
- [ ] Authentication works
- [ ] Contest creation functional
- [ ] Moderation system active
- [ ] Creator features work
- [ ] Admin panel accessible
- [ ] File uploads successful

### Performance & Security
- [ ] No console errors
- [ ] API responses fast
- [ ] Security measures active
- [ ] Database optimized
- [ ] Mobile experience good
- [ ] Error handling robust

---

## 🚨 Troubleshooting Guide

### Common Issues

#### Payment Issues
- **Problem**: Stripe not loading
  - **Solution**: Check environment variables
- **Problem**: Webhook not receiving
  - **Solution**: Verify webhook endpoint URL
- **Problem**: Currency conversion errors
  - **Solution**: Check cents/dollars conversion

#### UI Issues
- **Problem**: Colors not consistent
  - **Solution**: Clear browser cache
- **Problem**: Mobile not responsive
  - **Solution**: Check CSS media queries
- **Problem**: Loading states not working
  - **Solution**: Verify component states

#### Database Issues
- **Problem**: Transaction not logging
  - **Solution**: Check database permissions
- **Problem**: Balance not updating
  - **Solution**: Verify RLS policies
- **Problem**: API errors
  - **Solution**: Check Supabase connection

### Debug Commands

```bash
# Check environment variables
node -e "console.log(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)"

# Verify database connection
node scripts/verify-database-setup.js

# Test Stripe webhook
stripe listen --forward-to localhost:3000/api/payments/webhook

# Check build errors
npm run build
```

---

## 📝 9. Test Report Template

After completing all tests, document your findings:

### Test Summary
- **Date**: [Date]
- **Tester**: [Name]
- **Environment**: [Development/Staging/Production]

### Results Summary
- **Total Tests**: [Number]
- **Passed**: [Number]
- **Failed**: [Number]
- **Success Rate**: [Percentage]

### Critical Issues Found
1. [Issue description]
2. [Issue description]

### Minor Issues Found
1. [Issue description]
2. [Issue description]

### Recommendations
1. [Recommendation]
2. [Recommendation]

### Ready for Production?
- [ ] Yes - All critical issues resolved
- [ ] No - Critical issues remain
- [ ] Conditional - Minor issues acceptable

---

This comprehensive testing guide ensures your Game of Creators platform is thoroughly tested and ready for production deployment. 