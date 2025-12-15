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
