# Mobile OAuth with App Links/Universal Links - Complete Guide

## 📚 Table of Contents

1. [Understanding App Links vs Custom Schemes](#understanding-app-links-vs-custom-schemes)
2. [How It Works](#how-it-works)
3. [Backend Implementation](#backend-implementation)
4. [Mobile App Configuration](#mobile-app-configuration)
5. [Testing Guide](#testing-guide)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Understanding App Links vs Custom Schemes

### What are Custom Schemes?

Custom schemes are like `gameofcreators://auth/callback`

**Problems:**
- ❌ Google OAuth doesn't accept them
- ❌ YouTube OAuth doesn't accept them
- ❌ Less secure (any app can register the same scheme)
- ❌ No fallback to website
- ❌ Requires user to have app installed

### What are App Links / Universal Links?

App Links (Android) and Universal Links (iOS) use **HTTPS URLs** like:
```
https://www.gameofcreators.com/mobile/auth/callback
```

**Benefits:**
- ✅ Google OAuth accepts them
- ✅ YouTube OAuth accepts them
- ✅ More secure (cryptographically verified)
- ✅ Fallback to website if app not installed
- ✅ Better user experience
- ✅ Works with all OAuth providers

### How App Links Work

```
┌─────────────────────────────────────────────────────────────┐
│ User clicks OAuth link                                       │
│ OAuth provider redirects to:                                │
│ https://www.gameofcreators.com/mobile/auth/callback?code=123│
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Operating System checks:                                     │
│ "Does any app claim www.gameofcreators.com?"                │
└─────────────────────────────────────────────────────────────┘
                            ↓
                     ┌─────────────┐
                     │ App installed│
                     │ and verified?│
                     └──────┬──────┘
                  Yes ┌─────┴─────┐ No
                      │           │
                      ↓           ↓
        ┌──────────────────┐  ┌──────────────────┐
        │ Opens in App     │  │ Opens in Browser │
        │ (Deep Link)      │  │ (Website)        │
        └──────────────────┘  └──────────────────┘
```

**Key Point:** The SAME URL works for both app and web! 🎉

---

## 🔧 How It Works - Complete Flow

### Example: Google Sign-In Flow

```
Step 1: User in Flutter App
├─ WebView shows: https://www.gameofcreators.com/auth/signin
├─ User clicks "Sign in with Google"
└─ JavaScript detects mobile: navigator.userAgent includes 'GameOfCreators-Mobile'

Step 2: OAuth Initiation
├─ Frontend calls: supabase.auth.signInWithOAuth()
├─ redirectTo: 'https://www.gameofcreators.com/mobile/auth/callback'
└─ Opens Chrome Custom Tab with Google OAuth

Step 3: Google Authentication
├─ User signs in to Google
├─ Grants permissions
└─ Google redirects to: https://www.gameofcreators.com/mobile/auth/callback?code=ABC123

Step 4: Operating System Intercepts
├─ Android/iOS checks: "Does app claim www.gameofcreators.com?"
├─ Verifies digital signature
├─ Finds Flutter app is verified owner
└─ Opens URL in app instead of browser

Step 5: Flutter App Handles Deep Link
├─ Deep link handler catches: https://www.gameofcreators.com/mobile/auth/callback?code=ABC123
├─ Extracts code parameter
└─ Navigates WebView to: https://www.gameofcreators.com/auth/callback?code=ABC123

Step 6: Backend Processes
├─ /auth/callback exchanges code for session
├─ Creates/updates user
└─ Redirects to: /dashboard

Step 7: User is Signed In
└─ WebView shows dashboard, user authenticated ✅
```

**Why the extra `/mobile/` path?**
- Helps backend identify mobile requests
- Can show app-specific UI if needed
- Keeps mobile and web flows separate
- Allows different handling for edge cases

---

## 🛠️ Backend Implementation

### Step 1: Create Digital Asset Links for Android

This file **proves you own the app** and allows Android to open your URLs in the app.

**Create: `public/.well-known/assetlinks.json`**

First, get your app's SHA-256 fingerprint:

```bash
# For debug build (during development)
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA256

# For release build (for production)
keytool -list -v -keystore /path/to/your/release-keystore.jks -alias your-key-alias
```

You'll get something like:
```
SHA256: AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90
```

Now create the file:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.gameofcreators.app",
    "sha256_cert_fingerprints": [
      "AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90"
    ]
  }
}]
```

**⚠️ Important:** 
- Replace `com.gameofcreators.app` with your actual package name
- Replace the fingerprint with your actual SHA-256
- For production, add BOTH debug and release fingerprints

**Why?** This file tells Android: "Yes, this app is allowed to handle links to www.gameofcreators.com"

**Test it works:**
```bash
# This should return your JSON file
curl https://www.gameofcreators.com/.well-known/assetlinks.json
```

---

### Step 2: Create Apple App Site Association for iOS

This file does the same thing for iOS.

**Create: `public/.well-known/apple-app-site-association`**

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.gameofcreators.app",
        "paths": [
          "/mobile/auth/*",
          "/mobile/instagram/*",
          "/mobile/youtube/*"
        ]
      }
    ]
  }
}
```

**How to find your TEAM_ID:**
1. Go to [Apple Developer Account](https://developer.apple.com/account)
2. Click "Membership"
3. Your Team ID is shown there (e.g., `AB12CD34EF`)

**⚠️ Important:**
- No `.json` extension for this file!
- Must be served with `Content-Type: application/json`
- Replace `TEAM_ID` with your actual Apple Team ID
- Replace `com.gameofcreators.app` with your bundle identifier

**Why?** This tells iOS: "URLs matching these paths should open in the app"

**Test it works:**
```bash
# This should return your JSON file
curl https://www.gameofcreators.com/.well-known/apple-app-site-association
```

---

### Step 3: Configure Next.js to Serve These Files

**Update: `next.config.js`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... your existing config ...
  
  async headers() {
    return [
      {
        // Serve assetlinks.json for Android
        source: '/.well-known/assetlinks.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600', // Cache for 1 hour
          },
        ],
      },
      {
        // Serve apple-app-site-association for iOS
        source: '/.well-known/apple-app-site-association',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

**Why?** Ensures proper Content-Type headers and caching for verification files.

---

### Step 4: Create Mobile Callback Routes

These routes handle the OAuth callbacks from the mobile app.

**Create: `app/mobile/auth/callback/route.ts`**

```typescript
import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * Mobile OAuth callback handler for Google Sign-In/Sign-Up
 * 
 * Flow:
 * 1. Google redirects to this URL after OAuth
 * 2. OS opens this URL in the app (via App Links)
 * 3. This handler processes and redirects to regular callback
 * 4. WebView completes authentication
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  
  console.log('Mobile auth callback received:', { code: !!code, error });

  // Handle OAuth error
  if (error) {
    console.error('OAuth error:', error);
    const errorUrl = `${origin}/auth/signin?error=oauth_error&message=${encodeURIComponent(error)}`;
    
    // Return HTML that redirects to error page
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Error</title>
          <meta http-equiv="refresh" content="0;url=${errorUrl}">
        </head>
        <body>
          <p>Authentication failed. Redirecting...</p>
          <script>window.location.href = '${errorUrl}';</script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!code) {
    console.error('No code received in mobile callback');
    const errorUrl = `${origin}/auth/signin?error=no_code`;
    return NextResponse.redirect(errorUrl);
  }

  // For mobile app: redirect to regular callback route
  // The app's WebView will handle this and complete authentication
  const callbackUrl = `${origin}/auth/callback?code=${code}`;
  
  console.log('Redirecting to regular callback:', callbackUrl);

  // Return HTML that immediately redirects
  // This ensures the app's WebView catches and processes the redirect
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Completing Sign In...</title>
        <meta http-equiv="refresh" content="0;url=${callbackUrl}">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #000825;
            color: white;
          }
          .loader {
            text-align: center;
          }
          .spinner {
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 3px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loader">
          <div class="spinner"></div>
          <p>Completing sign in...</p>
        </div>
        <script>
          // Immediate redirect for app WebView
          window.location.href = '${callbackUrl}';
        </script>
      </body>
    </html>
  `, {
    headers: { 
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
```

**Create: `app/mobile/instagram/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * Mobile OAuth callback handler for Instagram
 * Similar to auth callback but for Instagram connection
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  
  console.log('Mobile Instagram callback received:', { code: !!code, error });

  if (error) {
    console.error('Instagram OAuth error:', error, errorDescription);
    const errorUrl = `${origin}/dashboard/settings?error=instagram_auth_failed&message=${encodeURIComponent(errorDescription || error)}`;
    
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Instagram Connection Error</title>
          <meta http-equiv="refresh" content="0;url=${errorUrl}">
        </head>
        <body>
          <p>Instagram connection failed. Redirecting...</p>
          <script>window.location.href = '${errorUrl}';</script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!code) {
    console.error('No code received in Instagram mobile callback');
    const errorUrl = `${origin}/dashboard/settings?error=instagram_no_code`;
    return NextResponse.redirect(errorUrl);
  }

  // Redirect to regular Instagram callback route
  const callbackUrl = `${origin}/api/instagram/callback?code=${code}`;
  
  console.log('Redirecting to Instagram callback:', callbackUrl);

  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Connecting Instagram...</title>
        <meta http-equiv="refresh" content="0;url=${callbackUrl}">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
            color: white;
          }
          .loader {
            text-align: center;
          }
          .spinner {
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 3px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loader">
          <div class="spinner"></div>
          <p>Connecting Instagram...</p>
        </div>
        <script>
          window.location.href = '${callbackUrl}';
        </script>
      </body>
    </html>
  `, {
    headers: { 
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
```

**Create: `app/mobile/youtube/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * Mobile OAuth callback handler for YouTube
 * Similar to auth callback but for YouTube connection
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  
  console.log('Mobile YouTube callback received:', { code: !!code, state: !!state, error });

  if (error) {
    console.error('YouTube OAuth error:', error);
    const errorUrl = `${origin}/dashboard/settings?error=youtube_auth_failed&message=${encodeURIComponent(error)}`;
    
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>YouTube Connection Error</title>
          <meta http-equiv="refresh" content="0;url=${errorUrl}">
        </head>
        <body>
          <p>YouTube connection failed. Redirecting...</p>
          <script>window.location.href = '${errorUrl}';</script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!code) {
    console.error('No code received in YouTube mobile callback');
    const errorUrl = `${origin}/dashboard/settings?error=youtube_no_code`;
    return NextResponse.redirect(errorUrl);
  }

  // Redirect to regular YouTube callback route with state parameter
  const callbackUrl = state 
    ? `${origin}/api/youtube/callback?code=${code}&state=${state}`
    : `${origin}/api/youtube/callback?code=${code}`;
  
  console.log('Redirecting to YouTube callback:', callbackUrl);

  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Connecting YouTube...</title>
        <meta http-equiv="refresh" content="0;url=${callbackUrl}">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #FF0000;
            color: white;
          }
          .loader {
            text-align: center;
          }
          .spinner {
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 3px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loader">
          <div class="spinner"></div>
          <p>Connecting YouTube...</p>
        </div>
        <script>
          window.location.href = '${callbackUrl}';
        </script>
      </body>
    </html>
  `, {
    headers: { 
      'Content-Type': 'text/html',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
```

**Why these routes?**
- They act as a "bridge" between OAuth provider and your app
- OS intercepts these URLs and opens in app
- They immediately redirect to your regular callback routes
- Provides loading UI in case redirect is slow
- Handles errors gracefully

---

### Step 5: Update Frontend OAuth Handlers

**Update: `components/auth/SignInPage.tsx` and `SignUpPage.tsx`**

```typescript
const handleGoogleSignIn = async () => {
  setError(null);
  setIsGoogleLoading(true);

  try {
    // Detect if running in mobile WebView
    const isMobile = /gameofcreators-mobile/i.test(navigator.userAgent);
    const origin = window.location.origin;
    
    // Use /mobile/ path for mobile app (App Links)
    // Use regular path for web
    const redirectTo = isMobile 
      ? `${origin}/mobile/auth/callback`
      : `${origin}/auth/callback`;

    console.log('Google OAuth - Platform:', isMobile ? 'mobile' : 'web');
    console.log('Google OAuth - Redirect URI:', redirectTo);

    const { data, error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (signInError) {
      throw signInError;
    }

    // OAuth redirect will handle the rest
  } catch (err: any) {
    console.error("Google sign-in error:", err);
    setError(err.message || "Failed to sign in with Google");
    toast({
      variant: "destructive",
      title: "Google Access Failed",
      description: err.message || "Failed to sign in with Google. Please try again.",
      duration: TOAST_DURATION_MEDIUM,
    });
    setIsGoogleLoading(false);
  }
};
```

**Update: `app/dashboard/settings/client.tsx`**

```typescript
const handleInstagramConnect = async () => {
  setInstagramConnecting(true);
  try {
    const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
    
    if (!clientId) {
      throw new Error("Instagram Client ID not configured");
    }

    // Detect if running in mobile WebView
    const isMobile = /gameofcreators-mobile/i.test(navigator.userAgent);
    const origin = window.location.origin;
    
    // Use /mobile/ path for mobile app
    const redirectUri = isMobile
      ? `${origin}/mobile/instagram/callback`
      : `${origin}/api/instagram/callback`;

    console.log('Instagram - Platform:', isMobile ? 'mobile' : 'web');
    console.log('Instagram - Redirect URI:', redirectUri);

    const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=user_profile,user_media&response_type=code`;

    sessionStorage.setItem("instagram_auth_pending", "true");
    window.location.href = authUrl;
  } catch (error: any) {
    console.error("Error connecting Instagram:", error);
    toast({
      title: "Connection Failed",
      description: error.message || "Failed to connect Instagram account",
      variant: "destructive",
    });
    setInstagramConnecting(false);
  }
};

const handleYouTubeConnect = async () => {
  setYoutubeConnecting(true);
  try {
    // Detect if running in mobile WebView
    const isMobile = /gameofcreators-mobile/i.test(navigator.userAgent);
    const origin = window.location.origin;

    console.log('YouTube - Platform:', isMobile ? 'mobile' : 'web');

    const response = await fetch("/api/youtube/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform: isMobile ? 'mobile' : 'web',
        // Pass origin so backend can construct mobile callback URL
        redirectUri: isMobile ? `${origin}/mobile/youtube/callback` : undefined,
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to initiate YouTube connection");
    }

    const { authUrl } = await response.json();

    sessionStorage.setItem("youtube_auth_pending", "true");
    window.location.href = authUrl;
  } catch (error: any) {
    console.error("Error connecting YouTube:", error);
    toast({
      title: "Connection Failed",
      description: error.message || "Failed to connect YouTube account",
      variant: "destructive",
    });
    setYoutubeConnecting(false);
  }
};
```

**Update: `app/api/youtube/auth/route.ts`**

```typescript
import { createOAuthClient } from '@/lib/youtube-api';
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const platform = body.platform || 'web';
    const customRedirectUri = body.redirectUri; // From frontend

    console.log('YouTube auth request:', { platform, customRedirectUri });

    const oauth2Client = await createOAuthClient();
    
    // Set redirect URI based on platform
    let redirectUri: string;
    if (customRedirectUri) {
      // Use custom URI from frontend (for mobile)
      redirectUri = customRedirectUri;
    } else if (platform === 'mobile') {
      // Fallback for mobile
      const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://www.gameofcreators.com';
      redirectUri = `${origin}/mobile/youtube/callback`;
    } else {
      // Web
      redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/callback`;
    }
    
    console.log('YouTube - Using redirect URI:', redirectUri);

    // Update OAuth client with correct redirect URI
    oauth2Client.redirectUri = redirectUri;

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    const cookieStore = await cookies();
    
    cookieStore.set({
      name: 'youtube_oauth_state',
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/'
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.readonly'],
      prompt: 'consent',
      state: state
    });

    console.log('YouTube - Generated auth URL (with state)');

    return NextResponse.json({ authUrl });
  } catch (error: any) {
    console.error('Error generating YouTube auth URL:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
```

---

### Step 6: Update OAuth Provider Settings

**Google Cloud Console:**

Add these redirect URIs:

```
http://localhost:3000/auth/callback
https://www.gameofcreators.com/auth/callback
https://go-viral-eight.vercel.app/auth/callback
https://rjprmbjqetxkramwbrqo.supabase.co/auth/v1/callback

For mobile (NEW):
https://www.gameofcreators.com/mobile/auth/callback
https://www.gameofcreators.com/mobile/youtube/callback
```

**Meta for Developers (Instagram):**

Add these redirect URIs:

```
https://www.gameofcreators.com/api/instagram/callback

For mobile (NEW):
https://www.gameofcreators.com/mobile/instagram/callback
```

**Supabase:**

Add these redirect URLs in Auth > URL Configuration:

```
https://www.gameofcreators.com/auth/callback
https://www.gameofcreators.com/mobile/auth/callback
https://www.gameofcreators.com/mobile/instagram/callback
https://www.gameofcreators.com/mobile/youtube/callback
```

---

## 📱 Mobile App Configuration

### Step 1: Update Android Configuration

**File: `android/app/src/main/AndroidManifest.xml`**

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.gameofcreators.app">

    <application ...>
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            
            <!-- Regular app launch -->
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>

            <!-- App Links for OAuth (HTTPS-based deep links) -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                
                <!-- Your domain -->
                <data android:scheme="https" />
                <data android:host="www.gameofcreators.com" />
                
                <!-- Mobile OAuth paths -->
                <data android:pathPrefix="/mobile/auth" />
                <data android:pathPrefix="/mobile/instagram" />
                <data android:pathPrefix="/mobile/youtube" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

**What this does:**
- `android:autoVerify="true"` - Tells Android to verify you own the domain
- `scheme="https"` - Only HTTPS URLs (secure)
- `host="www.gameofcreators.com"` - Your domain
- `pathPrefix="/mobile/*"` - Only mobile OAuth paths

**Why `/mobile/` prefix?**
- Prevents app from opening ALL URLs from your domain
- Only opens OAuth-related URLs
- Keeps web browsing separate from app deep links

---

### Step 2: Update iOS Configuration

**File: `ios/Runner/Info.plist`**

Add these keys:

```xml
<dict>
    <!-- Existing keys... -->
    
    <!-- Associated Domains for Universal Links -->
    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>applinks:www.gameofcreators.com</string>
    </array>
    
    <!-- Allow OAuth URLs to be opened -->
    <key>LSApplicationQueriesSchemes</key>
    <array>
        <string>https</string>
        <string>http</string>
    </array>
</dict>
```

**In Xcode:**

1. Open `ios/Runner.xcworkspace` in Xcode
2. Select Runner project
3. Select Runner target
4. Go to "Signing & Capabilities" tab
5. Click "+ Capability"
6. Add "Associated Domains"
7. Add domain: `applinks:www.gameofcreators.com`

**What this does:**
- Registers your app to handle links from www.gameofcreators.com
- iOS verifies ownership using the apple-app-site-association file
- Only opens paths specified in that file

---

### Step 3: Update Flutter Dependencies

**File: `pubspec.yaml`**

```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_inappwebview: ^6.0.0
  url_launcher: ^6.2.0
  # Note: uni_links not needed for App Links, but keep if you want custom schemes too
```

---

### Step 4: Update Deep Link Handler

**File: `lib/services/deep_link_service.dart`**

```dart
import 'dart:async';
import 'package:flutter/services.dart';

class DeepLinkService {
  static const platform = MethodChannel('com.gameofcreators.app/deeplink');
  
  // Callback functions
  Function(Uri)? onAuthCallback;
  Function(Uri)? onInstagramCallback;
  Function(Uri)? onYouTubeCallback;
  
  /// Initialize deep link listener for App Links
  Future<void> initialize() async {
    // Listen for deep links on Android
    platform.setMethodCallHandler(_handleMethodCall);
    
    // Check if app was opened with a deep link
    try {
      final String? initialLink = await platform.invokeMethod('getInitialLink');
      if (initialLink != null) {
        final uri = Uri.parse(initialLink);
        print('App opened with deep link: $uri');
        _handleDeepLink(uri);
      }
    } on PlatformException catch (e) {
      print('Failed to get initial link: ${e.message}');
    }
  }

  Future<dynamic> _handleMethodCall(MethodCall call) async {
    if (call.method == 'onNewIntent') {
      final String? url = call.arguments;
      if (url != null) {
        final uri = Uri.parse(url);
        print('Received deep link: $uri');
        _handleDeepLink(uri);
      }
    }
  }

  void _handleDeepLink(Uri uri) {
    print('Processing deep link:');
    print('  Scheme: ${uri.scheme}');
    print('  Host: ${uri.host}');
    print('  Path: ${uri.path}');
    print('  Query: ${uri.query}');
    
    // Check the path to route appropriately
    if (uri.path.contains('/mobile/auth/')) {
      print('→ Routing to auth callback');
      onAuthCallback?.call(uri);
    } else if (uri.path.contains('/mobile/instagram/')) {
      print('→ Routing to Instagram callback');
      onInstagramCallback?.call(uri);
    } else if (uri.path.contains('/mobile/youtube/')) {
      print('→ Routing to YouTube callback');
      onYouTubeCallback?.call(uri);
    } else {
      print('→ Unknown deep link path');
    }
  }

  void dispose() {
    // Cleanup if needed
  }
}
```

**For iOS, create: `ios/Runner/AppDelegate.swift`**

```swift
import UIKit
import Flutter

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  private let CHANNEL = "com.gameofcreators.app/deeplink"
  private var deepLinkChannel: FlutterMethodChannel?
  
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let controller : FlutterViewController = window?.rootViewController as! FlutterViewController
    deepLinkChannel = FlutterMethodChannel(name: CHANNEL, binaryMessenger: controller.binaryMessenger)
    
    deepLinkChannel?.setMethodCallHandler({ [weak self] (call: FlutterMethodCall, result: @escaping FlutterResult) -> Void in
      if call.method == "getInitialLink" {
        // Handle initial link if app was opened with deep link
        result(nil)
      } else {
        result(FlutterMethodNotImplemented)
      }
    })
    
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  
  // Handle Universal Links
  override func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    if userActivity.activityType == NSUserActivityTypeBrowsingWeb {
      if let url = userActivity.webpageURL {
        print("Universal Link opened: \(url.absoluteString)")
        deepLinkChannel?.invokeMethod("onNewIntent", arguments: url.absoluteString)
        return true
      }
    }
    return false
  }
}
```

**For Android, create: `android/app/src/main/kotlin/com/gameofcreators/app/MainActivity.kt`**

```kotlin
package com.gameofcreators.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.gameofcreators.app/deeplink"
    private var methodChannel: MethodChannel? = null
    
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        
        methodChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
        methodChannel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "getInitialLink" -> {
                    val initialLink = intent?.data?.toString()
                    result.success(initialLink)
                }
                else -> result.notImplemented()
            }
        }
    }
    
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val data: Uri? = intent.data
        if (data != null) {
            val url = data.toString()
            println("App Link received: $url")
            methodChannel?.invokeMethod("onNewIntent", url)
        }
    }
}
```

---

### Step 5: Update WebView Screen

**File: `lib/screens/webview_screen.dart`**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:io' show Platform;
import '../services/deep_link_service.dart';

class WebViewScreen extends StatefulWidget {
  final String initialUrl;
  
  const WebViewScreen({Key? key, required this.initialUrl}) : super(key: key);

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  InAppWebViewController? webViewController;
  final DeepLinkService _deepLinkService = DeepLinkService();
  bool _isLoading = true;
  double _progress = 0;

  @override
  void initState() {
    super.initState();
    _initializeDeepLinks();
  }

  void _initializeDeepLinks() {
    _deepLinkService.initialize();
    
    // Handle Google OAuth callback
    _deepLinkService.onAuthCallback = (uri) {
      print('📱 Auth deep link received: $uri');
      _handleAuthCallback(uri);
    };
    
    // Handle Instagram callback
    _deepLinkService.onInstagramCallback = (uri) {
      print('📱 Instagram deep link received: $uri');
      _handleSocialCallback(uri, 'Instagram');
    };
    
    // Handle YouTube callback
    _deepLinkService.onYouTubeCallback = (uri) {
      print('📱 YouTube deep link received: $uri');
      _handleSocialCallback(uri, 'YouTube');
    };
  }

  Future<void> _handleAuthCallback(Uri uri) async {
    print('🔐 Processing auth callback...');
    
    // The URL is already being handled by the mobile callback route
    // We just need to wait for it to redirect to the actual callback
    // The WebView will automatically load the redirected URL
    
    print('✅ Auth callback processed');
  }

  Future<void> _handleSocialCallback(Uri uri, String platform) async {
    print('🔗 Processing $platform callback...');
    
    // Show success message
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle, color: Colors.white),
              const SizedBox(width: 12),
              Text('$platform connected successfully!'),
            ],
          ),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 3),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
    
    // Wait a moment for the callback to process
    await Future.delayed(const Duration(seconds: 1));
    
    // Reload settings page to show connected account
    print('🔄 Reloading settings page...');
    await webViewController?.loadUrl(
      urlRequest: URLRequest(
        url: Uri.parse('https://www.gameofcreators.com/dashboard/settings')
      )
    );
    
    print('✅ $platform callback processed');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            InAppWebView(
              initialUrlRequest: URLRequest(
                url: Uri.parse(widget.initialUrl),
              ),
              initialOptions: InAppWebViewGroupOptions(
                crossPlatform: InAppWebViewOptions(
                  useShouldOverrideUrlLoading: true,
                  mediaPlaybackRequiresUserGesture: false,
                  javaScriptEnabled: true,
                  // Custom user agent to identify mobile app
                  userAgent: 'GameOfCreators-Mobile/${Platform.isAndroid ? "Android" : "iOS"}/1.0.0',
                ),
                android: AndroidInAppWebViewOptions(
                  useHybridComposition: true,
                  domStorageEnabled: true,
                  thirdPartyCookiesEnabled: true,
                ),
                ios: IOSInAppWebViewOptions(
                  allowsInlineMediaPlayback: true,
                  sharedCookiesEnabled: true,
                ),
              ),
              onWebViewCreated: (controller) {
                webViewController = controller;
                print('✅ WebView created');
              },
              onLoadStart: (controller, url) {
                print('📄 Loading: $url');
                setState(() {
                  _isLoading = true;
                });
              },
              onLoadStop: (controller, url) async {
                print('✅ Loaded: $url');
                setState(() {
                  _isLoading = false;
                });
              },
              onProgressChanged: (controller, progress) {
                setState(() {
                  _progress = progress / 100;
                });
              },
              shouldOverrideUrlLoading: (controller, navigationAction) async {
                final uri = navigationAction.request.url!;
                
                print('🔗 Intercepted URL: $uri');
                
                // Check if this is an OAuth URL that should open externally
                if (_isOAuthUrl(uri)) {
                  print('🌐 OAuth URL detected, opening in external browser');
                  if (await canLaunchUrl(uri)) {
                    await launchUrl(
                      uri,
                      mode: LaunchMode.externalApplication,
                    );
                    return NavigationActionPolicy.CANCEL;
                  }
                }
                
                // Check if this is a mobile deep link path
                if (uri.path.startsWith('/mobile/')) {
                  print('📱 Mobile deep link path, allowing WebView to handle');
                  // Let WebView handle it, will be processed by mobile callback routes
                  return NavigationActionPolicy.ALLOW;
                }
                
                return NavigationActionPolicy.ALLOW;
              },
              onLoadError: (controller, url, code, message) {
                print('❌ Load error: $message (code: $code)');
              },
            ),
            
            // Loading indicator
            if (_isLoading)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: LinearProgressIndicator(
                  value: _progress,
                  backgroundColor: Colors.grey[200],
                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF7F39EC)),
                ),
              ),
            
            if (_isLoading && _progress == 0)
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    CircularProgressIndicator(
                      color: Color(0xFF7F39EC),
                    ),
                    SizedBox(height: 16),
                    Text('Loading...'),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  bool _isOAuthUrl(Uri uri) {
    // Check if URL is an OAuth provider URL
    final oauthDomains = [
      'accounts.google.com',
      'api.instagram.com',
      'www.instagram.com',
    ];
    
    return oauthDomains.any((domain) => uri.host.contains(domain));
  }

  @override
  void dispose() {
    _deepLinkService.dispose();
    super.dispose();
  }
}
```

---

## 🧪 Testing Guide

### Step 1: Deploy Backend Changes

```bash
# Commit your changes
git add .
git commit -m "feat: Add App Links for mobile OAuth"
git push origin main

# Deploy to Vercel/your hosting
# Make sure all files are deployed including .well-known/
```

### Step 2: Verify Verification Files

```bash
# Test Android verification file
curl https://www.gameofcreators.com/.well-known/assetlinks.json

# Should return your JSON with package name and fingerprint

# Test iOS verification file
curl https://www.gameofcreators.com/.well-known/apple-app-site-association

# Should return your JSON with Team ID and paths
```

### Step 3: Test on Android

```bash
# Build debug version
cd mobile_app
flutter build apk --debug

# Install on device
adb install build/app/outputs/flutter-apk/app-debug.apk

# Test deep link manually
adb shell am start -W -a android.intent.action.VIEW \
  -d "https://www.gameofcreators.com/mobile/auth/callback?code=test123"

# Should open your app!
```

**Verify App Links are working:**

```bash
# Check if App Links are verified
adb shell pm get-app-links com.gameofcreators.app

# Should show: verified
```

### Step 4: Test on iOS

```bash
# Build for iOS
flutter build ios --debug

# Open in Xcode
open ios/Runner.xcworkspace

# Run on device or simulator
# Then test Universal Link:

# On simulator:
xcrun simctl openurl booted "https://www.gameofcreators.com/mobile/auth/callback?code=test123"

# On physical device, send link via Messages or Notes app
```

### Step 5: Test Full OAuth Flow

**Google Sign-In:**

1. Open app
2. Go to sign-in page
3. Click "Sign in with Google"
4. Complete Google authentication
5. Should return to app automatically
6. Check console logs for deep link being caught
7. Verify user is signed in

**Instagram Connection:**

1. Sign in to app
2. Go to Settings
3. Click "Connect Instagram"
4. Complete Instagram authentication
5. Should return to app
6. Check that Instagram account shows as connected

**YouTube Connection:**

1. Sign in to app
2. Go to Settings
3. Click "Connect YouTube"
4. Complete Google authentication and grant YouTube permissions
5. Should return to app
6. Check that YouTube channel shows as connected

---

## 🐛 Troubleshooting

### Issue: App Link not opening app

**Check:**

```bash
# Android: Verify domain association
adb shell pm get-app-links com.gameofcreators.app

# If not verified, check:
1. assetlinks.json is accessible
2. SHA-256 fingerprint matches
3. Package name matches
4. File has correct Content-Type header
```

**Fix:**
```bash
# Force re-verification (Android 12+)
adb shell pm verify-app-links --re-verify com.gameofcreators.app
```

### Issue: Deep link opens in browser instead of app

**Причины:**
1. Domain verification failed
2. App not installed
3. User chose "Always open in browser"

**Fix:**
```bash
# Android: Reset app preferences
adb shell pm clear-default-app-links com.gameofcreators.app
```

### Issue: OAuth completes but doesn't return to app

**Check:**
1. Redirect URI in OAuth provider matches exactly
2. Mobile callback routes are deployed
3. WebView is handling redirects properly

**Debug:**
```dart
// Add logging in WebView
onLoadStart: (controller, url) {
  print('Loading: $url');
  if (url.toString().contains('/mobile/')) {
    print('Mobile callback detected!');
  }
},
```

---

## ✅ Checklist

### Backend Deployment
- [ ] Created `public/.well-known/assetlinks.json`
- [ ] Created `public/.well-known/apple-app-site-association`
- [ ] Updated `next.config.js` with headers
- [ ] Created `/mobile/auth/callback` route
- [ ] Created `/mobile/instagram/callback` route
- [ ] Created `/mobile/youtube/callback` route
- [ ] Updated frontend OAuth handlers
- [ ] Updated YouTube auth API
- [ ] Added redirect URIs to Google Cloud Console
- [ ] Added redirect URIs to Instagram app
- [ ] Added redirect URIs to Supabase
- [ ] Deployed to production
- [ ] Verified assetlinks.json is accessible
- [ ] Verified apple-app-site-association is accessible

### Mobile App
- [ ] Updated AndroidManifest.xml with App Links intent filter
- [ ] Added package name to assetlinks.json
- [ ] Added SHA-256 fingerprint to assetlinks.json
- [ ] Updated Info.plist with Associated Domains
- [ ] Added Team ID to apple-app-site-association
- [ ] Created/updated MainActivity.kt for Android
- [ ] Created/updated AppDelegate.swift for iOS
- [ ] Updated DeepLinkService
- [ ] Updated WebViewScreen
- [ ] Set custom user agent in WebView
- [ ] Built and installed app
- [ ] Tested deep link opens app
- [ ] Tested Google OAuth flow
- [ ] Tested Instagram OAuth flow
- [ ] Tested YouTube OAuth flow

---

## 🎉 Success!

Once everything is working, you'll have:

✅ **Seamless OAuth** - Users stay in app during authentication
✅ **Universal Support** - Works on Android and iOS
✅ **Secure** - Cryptographically verified domain ownership
✅ **Fallback** - Opens in browser if app not installed
✅ **Google-Compatible** - Works with all OAuth providers

---

**Last Updated**: December 13, 2025
**Version**: 1.0.0
