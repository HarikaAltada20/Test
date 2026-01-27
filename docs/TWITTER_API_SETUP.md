# Twitter API Setup Guide

This guide explains how to configure Twitter API (RapidAPI) for local development and production deployments.

## Environment Variables

The Twitter API integration uses RapidAPI. You need to configure one of these environment variables:

- `TWITTER_RAPIDAPI_KEYS` - Multiple keys separated by comma, semicolon, or space (recommended for production)
- `TWITTER_RAPIDAPI_KEY` - Single API key
- `RAPIDAPI_KEYS` - Legacy support for multiple keys
- `RAPIDAPI_KEY` - Legacy support for single key

## Local Development Setup

1. **Get RapidAPI Key**:
   - Go to [RapidAPI Dashboard](https://rapidapi.com/developer/dashboard)
   - Subscribe to the Twitter API (e.g., "Twitter API v2" or "Twitter API v1.1")
   - Copy your API key

2. **Configure `.env.local`**:
   ```env
   # Single key
   TWITTER_RAPIDAPI_KEY="your-rapidapi-key-here"
   
   # OR multiple keys (for key rotation)
   TWITTER_RAPIDAPI_KEYS="key1,key2,key3"
   ```

3. **Restart your dev server**:
   ```bash
   npm run dev
   ```

## Production/Staging Setup (Vercel)

### Step 1: Get Your RapidAPI Keys

1. Log in to [RapidAPI Dashboard](https://rapidapi.com/developer/dashboard)
2. Ensure you're subscribed to the Twitter API
3. Copy your API key(s)

### Step 2: Add Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add one of the following:

   **Option A: Single Key (Simplest)**
   - Name: `TWITTER_RAPIDAPI_KEY`
   - Value: `your-rapidapi-key-here`
   - Environment: Select **Production**, **Preview**, and **Development**

   **Option B: Multiple Keys (Recommended for Production)**
   - Name: `TWITTER_RAPIDAPI_KEYS`
   - Value: `key1,key2,key3` (comma-separated)
   - Environment: Select **Production**, **Preview**, and **Development**

### Step 3: Redeploy

After adding environment variables, you need to redeploy:

1. **Option A: Automatic Redeploy**
   - Push a new commit to trigger a redeploy
   - Vercel will automatically use the new environment variables

2. **Option B: Manual Redeploy**
   - Go to **Deployments** tab
   - Click the three dots (⋯) on the latest deployment
   - Select **Redeploy**

## Verification

After deployment, check the logs:

1. Go to **Deployments** → Select your deployment → **Functions** tab
2. Try connecting a Twitter account
3. Check the logs for:
   - ✅ `[rapidApiClient] RapidAPI keys configured` (success)
   - ❌ `[rapidApiClient] No RapidAPI keys configured` (failure - env vars not set)

## Troubleshooting

### Error: "Twitter RapidAPI keys are not configured on the server"

**Cause**: Environment variables are not set in your deployment platform.

**Solution**:
1. Verify environment variables are set in Vercel (or your hosting platform)
2. Ensure they're set for the correct environment (Production/Preview/Development)
3. Redeploy your application after adding environment variables
4. Check server logs to see which environment variables are missing

### Error: "You are not subscribed to this API"

**Cause**: Your RapidAPI key is not subscribed to the Twitter API.

**Solution**:
1. Go to [RapidAPI Dashboard](https://rapidapi.com/developer/dashboard)
2. Find the Twitter API you're using
3. Click **Subscribe** and choose a plan
4. Wait a few minutes for the subscription to activate
5. Try again

### Error: "Rate limit exceeded"

**Cause**: You've exceeded your RapidAPI quota.

**Solution**:
1. Wait for the rate limit to reset (usually hourly or daily)
2. Upgrade your RapidAPI plan for higher limits
3. Use multiple API keys with `TWITTER_RAPIDAPI_KEYS` for automatic rotation

## Environment-Specific Configuration

### Development (Local)
- Use `.env.local` file
- Single key is sufficient

### Preview/Staging
- Set environment variables in Vercel for "Preview" environment
- Can use same keys as production or separate test keys

### Production
- Set environment variables in Vercel for "Production" environment
- **Recommended**: Use multiple keys (`TWITTER_RAPIDAPI_KEYS`) for redundancy
- Ensure keys are subscribed to the Twitter API

## Security Best Practices

1. **Never commit API keys to git** - They're in `.gitignore` for a reason
2. **Use separate keys for production** - Don't use development keys in production
3. **Rotate keys regularly** - If a key is compromised, generate a new one
4. **Monitor usage** - Check RapidAPI dashboard for unusual activity
5. **Use multiple keys** - Provides redundancy if one key fails

## Quick Checklist

- [ ] RapidAPI account created
- [ ] Subscribed to Twitter API on RapidAPI
- [ ] API key(s) copied
- [ ] Environment variables set in Vercel (Production, Preview, Development)
- [ ] Application redeployed
- [ ] Tested Twitter connection in production
- [ ] Verified in server logs that keys are loaded
