# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication alongside email/password authentication, allowing users to sign in with either method using the same email address.

## 1. Google Cloud Console Setup

### Step 1: Create or Configure Google OAuth Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client IDs"
5. Configure the OAuth consent screen if you haven't already
6. For Application type, select "Web application"
7. Add your authorized redirect URIs:
   - For development: `http://localhost:3000/auth/callback`
   - For production: `https://yourdomain.com/auth/callback`
8. Save and note down your Client ID and Client Secret

## 2. Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Google OAuth (you already have these for YouTube)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Supabase (you should already have these)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## 3. Supabase Configuration

### Step 1: Enable Google Provider in Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to "Authentication" > "Providers"
4. Find "Google" and click "Enable"
5. Enter your Google Client ID and Client Secret
6. Set the redirect URL to: `https://your-project-ref.supabase.co/auth/v1/callback`
7. Save the configuration

### Step 2: Configure Auth Settings

In your Supabase dashboard, go to "Authentication" > "Settings":

1. **Site URL**: Set to your production domain (e.g., `https://yourdomain.com`)
2. **Redirect URLs**: Add your callback URLs:
   - `http://localhost:3000/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)

## 4. Database Schema Updates

The current implementation should work with your existing schema, but ensure your `auth.users` table can handle OAuth users. Supabase handles this automatically.

## 5. Testing the Implementation

### Test Scenarios:

1. **New User with Google OAuth**:
   - Click "Continue with Google" on sign-up page
   - Complete Google authentication
   - Should redirect to profile setup page
   - Complete profile setup
   - Should redirect to username selection
   - Access dashboard

2. **Existing Email User Signs in with Google**:
   - If a user has an account with email/password and tries to sign in with Google using the same email
   - Supabase will link the accounts automatically
   - User can then use either method to sign in

3. **Google User Sets Password**:
   - Sign up with Google
   - Go to Settings page
   - Should see "Set Password" option
   - Set a password
   - Sign out and try signing in with email/password
   - Should work with the same account

4. **Password User Signs in with Google**:
   - Create account with email/password
   - Sign out
   - Try signing in with Google using same email
   - Should access the same account

## 6. Key Features Implemented

### Unified Authentication Flow
- Users can sign in with Google OR email/password
- Same email address works for both methods
- Seamless account linking

### Smart Password Management
- Google users can set a password later
- Password users can add Google authentication
- Settings page adapts based on authentication method

### Profile Management
- Google users complete profile setup after OAuth
- Maintains referral code and user type preferences
- Proper profile creation for both user types

## 7. Security Considerations

- OAuth tokens are handled securely by Supabase
- Password requirements enforced (minimum 6 characters)
- Proper session management
- CSRF protection through Supabase

## 8. Troubleshooting

### Common Issues:

1. **"OAuth Error" on callback**:
   - Check redirect URLs in Google Console and Supabase
   - Ensure URLs match exactly (including http/https)

2. **"Profile creation error"**:
   - Check database permissions
   - Verify RLS policies allow user creation

3. **"Google sign-in not working"**:
   - Verify Google Client ID in environment variables
   - Check OAuth consent screen configuration
   - Ensure Google OAuth is enabled in Supabase

4. **"Password set but can't sign in with email"**:
   - Check if email provider is properly linked
   - Verify Supabase auth configuration

## 9. Next Steps

After setup:
1. Test all authentication flows thoroughly
2. Monitor authentication logs in Supabase
3. Consider adding additional OAuth providers if needed
4. Implement proper error handling for edge cases

## 10. Support

If you encounter issues:
1. Check Supabase auth logs
2. Verify environment variables
3. Test with different browsers/incognito mode
4. Check network requests in browser dev tools 