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
