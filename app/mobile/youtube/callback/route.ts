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
